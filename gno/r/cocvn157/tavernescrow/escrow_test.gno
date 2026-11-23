package tavernescrow_test

import (
	"chain"
	"chain/banker"
	"chain/runtime"
	"strings"
	"testing"

	"gno.land/r/cocvn157/tavernescrow"
)

const (
	sponsorAddr = address("g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5")
	workerAddr  = address("g1us8428u2a5satrlxzagqqa5m6vmuze025anjlj")
	arbiterAddr = address("g10p5yt46ypn5wey48zqevauwjlyaghh5vtdz7yg")
	stranger    = address("g1ecely4gjy0yl6s9kt409ll330q9hk2lj9ls3ec")
)

func realmAddr() address {
	return chain.PackageAddress("gno.land/r/cocvn157/tavernescrow")
}

func assertPanics(t *testing.T, label string, fn func()) {
	t.Helper()
	defer func() {
		if recover() == nil {
			t.Fatalf("expected panic for %s, but succeeded", label)
		}
	}()
	fn()
}

func TestBountyLifecycleHappyPath(t *testing.T) {
	expiry := runtime.ChainHeight() + 500
	testing.SetRealm(testing.NewUserRealm(sponsorAddr))
	testing.SetOriginCaller(sponsorAddr)
	testing.SetOriginSend(chain.NewCoins(chain.NewCoin("ugnot", 3000000)))
	testing.IssueCoins(realmAddr(), chain.NewCoins(chain.NewCoin("ugnot", 3000000)))

	id := tavernescrow.CreateBounty(
		cross,
		"GnoConnect Signing Kit",
		"Ship deterministic wallet signing adapter with unit tests",
		arbiterAddr.String(),
		"",
		"Spec & ABI,SDK Implementation",
		"1000000,2000000",
		expiry,
	)
	if id != 1 {
		t.Fatalf("expected bounty id 1, got %d", id)
	}

	// Open bounty claimed by worker
	testing.SetRealm(testing.NewUserRealm(workerAddr))
	testing.SetOriginSend(chain.Coins{})
	tavernescrow.ClaimBounty(cross, id)

	// Submit & approve milestone 0
	tavernescrow.SubmitMilestone(cross, id, 0, "https://github.com/cocvn157/pr/1", "sha256:abc1234")

	testing.SetRealm(testing.NewUserRealm(sponsorAddr))
	tavernescrow.ApproveAndRelease(cross, id, 0)

	// Reject then resubmit milestone 1
	testing.SetRealm(testing.NewUserRealm(workerAddr))
	tavernescrow.SubmitMilestone(cross, id, 1, "https://github.com/cocvn157/pr/2", "sha256:def5678")

	testing.SetRealm(testing.NewUserRealm(sponsorAddr))
	tavernescrow.RejectMilestone(cross, id, 1, "Missing edge test")

	testing.SetRealm(testing.NewUserRealm(workerAddr))
	tavernescrow.SubmitMilestone(cross, id, 1, "https://github.com/cocvn157/pr/3", "sha256:fff9999")

	testing.SetRealm(testing.NewUserRealm(sponsorAddr))
	tavernescrow.ApproveAndRelease(cross, id, 1)

	view := tavernescrow.GetBountyView(id)
	if view.Status != tavernescrow.StatusCompleted {
		t.Fatalf("expected COMPLETED, got %s", view.Status)
	}
	if view.ReleasedAmount != 3000000 || view.LockedUgnot != 0 {
		t.Fatalf("unexpected accounting: released=%d locked=%d", view.ReleasedAmount, view.LockedUgnot)
	}

	workerBal := banker.NewReadonlyBanker().GetCoin(workerAddr, "ugnot")
	if workerBal < 3000000 {
		t.Fatalf("expected worker balance >= 3000000, got %d", workerBal)
	}

	home := tavernescrow.Render("")
	if !strings.Contains(home, "GnoConnect Signing Kit") {
		t.Fatalf("expected Render home to contain bounty title")
	}
	detail := tavernescrow.Render("bounty/1")
	if !strings.Contains(detail, "COMPLETED") {
		t.Fatalf("expected Render bounty/1 to show COMPLETED")
	}
}

func TestDisputeAndArbiterResolution(t *testing.T) {
	expiry := runtime.ChainHeight() + 500
	testing.SetRealm(testing.NewUserRealm(sponsorAddr))
	testing.SetOriginSend(chain.NewCoins(chain.NewCoin("ugnot", 2500000)))
	testing.IssueCoins(realmAddr(), chain.NewCoins(chain.NewCoin("ugnot", 2500000)))

	id := tavernescrow.CreateBounty(
		cross,
		"Onyx Indexer",
		"Deterministic event indexer with gnoweb dashboard",
		arbiterAddr.String(),
		workerAddr.String(),
		"Parser,Dashboard",
		"1500000,1000000",
		expiry,
	)

	testing.SetRealm(testing.NewUserRealm(workerAddr))
	testing.SetOriginSend(chain.Coins{})
	tavernescrow.SubmitMilestone(cross, id, 0, "https://github.com/cocvn157/indexer", "sha256:11223344")
	tavernescrow.RaiseDispute(cross, id, 0, "Deliverable passes all vectors")

	// Sponsor cannot reclaim while dispute is active even if blocks skip past expiry
	testing.SkipHeights(600)
	testing.SetRealm(testing.NewUserRealm(sponsorAddr))
	assertPanics(t, "ReclaimExpired during active dispute", func() {
		tavernescrow.ReclaimExpired(cross, id)
	})

	// Non-arbiter cannot resolve dispute
	assertPanics(t, "Sponsor resolving dispute", func() {
		tavernescrow.ResolveDispute(cross, id, 0, false, "self favor")
	})

	// Arbiter releases milestone 0 to worker -> bounty unfreezes back to ACTIVE
	testing.SetRealm(testing.NewUserRealm(arbiterAddr))
	tavernescrow.ResolveDispute(cross, id, 0, true, "Tests verified by arbiter")

	view := tavernescrow.GetBountyView(id)
	if view.Status != tavernescrow.StatusActive || view.ReleasedAmount != 1500000 || view.LockedUgnot != 1000000 {
		t.Fatalf("unexpected dispute state: %+v", view)
	}

	// Now expired bounty remaining balance can be reclaimed by sponsor
	testing.SetRealm(testing.NewUserRealm(sponsorAddr))
	reclaimed := tavernescrow.ReclaimExpired(cross, id)
	if reclaimed != 1000000 {
		t.Fatalf("expected 1000000 reclaimed, got %d", reclaimed)
	}
	view = tavernescrow.GetBountyView(id)
	if view.Status != tavernescrow.StatusCancelled || view.LockedUgnot != 0 {
		t.Fatalf("expected CANCELLED with 0 locked, got %+v", view)
	}
}

func TestSecurityGuardsAndAdversarialAborts(t *testing.T) {
	expiry := runtime.ChainHeight() + 300

	// 1. CodeRealm MITM cannot spoof OriginSend payment
	testing.SetRealm(testing.NewCodeRealm("gno.land/r/evil/drain"))
	testing.SetOriginSend(chain.NewCoins(chain.NewCoin("ugnot", 1000000)))
	assertPanics(t, "CodeRealm CreateBounty", func() {
		tavernescrow.CreateBounty(
			cross,
			"MITM Attempt",
			"Should abort at IsUserCall boundary",
			arbiterAddr.String(),
			"",
			"Step 1",
			"1000000",
			expiry,
		)
	})

	// 2. Underfunded -send must abort
	testing.SetRealm(testing.NewUserRealm(sponsorAddr))
	testing.SetOriginSend(chain.NewCoins(chain.NewCoin("ugnot", 500)))
	assertPanics(t, "Underfunded CreateBounty", func() {
		tavernescrow.CreateBounty(
			cross,
			"Short Payment",
			"Milestone requires 1000000 ugnot",
			arbiterAddr.String(),
			"",
			"Step 1",
			"1000000",
			expiry,
		)
	})

	// 3. Create valid bounty to test unauthorized release & double-claim
	testing.SetOriginSend(chain.NewCoins(chain.NewCoin("ugnot", 1000000)))
	testing.IssueCoins(realmAddr(), chain.NewCoins(chain.NewCoin("ugnot", 1000000)))
	id := tavernescrow.CreateBounty(
		cross,
		"Guard Check Bounty",
		"Verify unauthorized transitions abort deterministically",
		arbiterAddr.String(),
		workerAddr.String(),
		"Audit",
		"1000000",
		expiry,
	)

	// Stranger cannot submit milestone
	testing.SetRealm(testing.NewUserRealm(stranger))
	testing.SetOriginSend(chain.Coins{})
	assertPanics(t, "Stranger SubmitMilestone", func() {
		tavernescrow.SubmitMilestone(cross, id, 0, "https://evil.invalid/pr", "deadbeef")
	})

	// Worker submits, then worker tries to self-approve
	testing.SetRealm(testing.NewUserRealm(workerAddr))
	tavernescrow.SubmitMilestone(cross, id, 0, "https://github.com/cocvn157/ok", "sha256:7777777")
	assertPanics(t, "Worker self-approve", func() {
		tavernescrow.ApproveAndRelease(cross, id, 0)
	})

	// Sponsor approves once, second approve must fail
	testing.SetRealm(testing.NewUserRealm(sponsorAddr))
	tavernescrow.ApproveAndRelease(cross, id, 0)
	assertPanics(t, "Double release", func() {
		tavernescrow.ApproveAndRelease(cross, id, 0)
	})

	if !strings.Contains(tavernescrow.Render("audit"), "MILESTONE_RELEASED") {
		t.Fatalf("expected audit route to record MILESTONE_RELEASED")
	}
	if !strings.Contains(tavernescrow.Render("safety"), "IsUserCall()") {
		t.Fatalf("expected safety route to document IsUserCall invariant")
	}
}
