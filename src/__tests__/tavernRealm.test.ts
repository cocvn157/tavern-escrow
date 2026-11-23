import { describe, expect, it } from 'vitest';
import { isValidGnoAddress } from '../engine/bech32';
import { sha256Hex } from '../engine/sha256';
import {
  ATTACK_VECTORS,
  DEMO_ACTORS,
  MAX_INT64,
  REALM_ADDRESS,
  RealmPanicError,
  approveAndRelease,
  bountyLockedRemaining,
  claimBounty,
  createBounty,
  createEmptyRealm,
  createSeededTavernRealm,
  getRealmStats,
  raiseDispute,
  reclaimExpired,
  rejectMilestone,
  renderPath,
  resolveDispute,
  runAttackVector,
  safeAddInt64,
  safeSubInt64,
  skipHeights,
  submitMilestone,
  verifyAuditChain,
} from '../engine/tavernRealm';
import {
  buildAddPkgCommand,
  buildCallCommand,
  buildGnowebUrl,
  buildPkgPath,
  buildQueryRenderCommand,
  exportAuditProofJson,
} from '../engine/gnokeyCli';

const [sponsor, worker, arbiter, builder2, stranger, attackerRealm] = DEMO_ACTORS;

describe('SHA-256, Bech32 & Safe Int64 Primitives', () => {
  it('computes NIST SHA-256 vectors matching Go crypto/sha256', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('validates Gno bech32 g1 addresses with real BIP-173 checksums', () => {
    expect(isValidGnoAddress(sponsor.address)).toBe(true);
    expect(isValidGnoAddress(worker.address)).toBe(true);
    expect(isValidGnoAddress(arbiter.address)).toBe(true);
    expect(isValidGnoAddress(REALM_ADDRESS)).toBe(true);
    expect(isValidGnoAddress('g127j32325f8426u89e5w0q0l7r3x74d2c7n7e8a')).toBe(false);
    expect(isValidGnoAddress('cosmos1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5')).toBe(false);
    expect(isValidGnoAddress('G1JG8MTUTU9KHHFWC4NXMUHCPFTF0PAJDHFVSQF5')).toBe(true);
    expect(isValidGnoAddress('g1Jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5')).toBe(false);
  });

  it('guards int64 addition and subtraction against overflow, underflow, and negatives', () => {
    expect(safeAddInt64(100n, 250n)).toBe(350n);
    expect(safeSubInt64(500n, 200n)).toBe(300n);
    expect(() => safeAddInt64(-1n, 10n)).toThrow('negative ugnot amount not permitted');
    expect(() => safeAddInt64(MAX_INT64, 1n)).toThrow('int64 overflow in ugnot accounting');
    expect(() => safeSubInt64(10n, 11n)).toThrow('int64 underflow in ugnot accounting');
  });

  it('requires positive delta when advancing block heights via skipHeights', () => {
    const base = createEmptyRealm('onyx-1', 1000n);
    expect(skipHeights(base, 42n).blockHeight).toBe(1042n);
    expect(() => skipHeights(base, 0n)).toThrow('skip height delta must be positive');
  });
});

describe('TavernEscrow Lifecycle & Role Validation', () => {
  it('creates an OPEN bounty, claims it, handles rejection + resubmit, and completes payout', () => {
    const base = createEmptyRealm('onyx-1', 1000n);
    const created = createBounty(
      base,
      { ...sponsor, originSendUgnot: 3_000_000n },
      {
        title: 'GRC20 Splitter',
        summary: 'Revenue split contract with deterministic tests',
        arbiterStr: arbiter.address,
        workerStr: '',
        milestoneTitlesCSV: 'Core Logic,Test Suite',
        milestoneAmountsCSV: '1000000,2000000',
        expiryHeight: 1500n,
      }
    );

    expect(created.bountyId).toBe(1);
    expect(created.state.bounties[0].status).toBe('OPEN');
    expect(created.state.balances[REALM_ADDRESS]).toBe(3_000_000n);

    let s = claimBounty(created.state, worker, 1);
    expect(s.bounties[0].status).toBe('ACTIVE');
    expect(s.bounties[0].worker).toBe(worker.address);

    s = submitMilestone(s, worker, 1, 0, 'https://github.com/cocvn157/pr/1', 'sha256:aaa1111');
    s = approveAndRelease(s, sponsor, 1, 0);
    expect(s.balances[worker.address]).toBe(51_000_000n);
    expect(bountyLockedRemaining(s.bounties[0])).toBe(2_000_000n);

    s = submitMilestone(s, worker, 1, 1, 'https://github.com/cocvn157/pr/2', 'sha256:bbb2222');
    s = rejectMilestone(s, sponsor, 1, 1, 'Add boundary overflow check');
    expect(s.bounties[0].milestones[1].status).toBe('REJECTED');

    s = submitMilestone(s, worker, 1, 1, 'https://github.com/cocvn157/pr/3', 'sha256:ccc3333');
    s = approveAndRelease(s, sponsor, 1, 1);

    expect(s.bounties[0].status).toBe('COMPLETED');
    expect(s.totalLockedUgnot).toBe(0n);
    expect(s.totalReleasedUgnot).toBe(3_000_000n);
    expect(s.balances[REALM_ADDRESS]).toBe(0n);
    expect(verifyAuditChain(s)).toEqual({
      valid: true,
      checkedCount: s.audits.length,
      brokenAtSeq: null,
    });
  });

  it('prevents sponsor or arbiter from claiming an open bounty', () => {
    const base = createEmptyRealm('onyx-1', 1000n);
    const created = createBounty(
      base,
      { ...sponsor, originSendUgnot: 1_000_000n },
      {
        title: 'Role Separation Check',
        summary: 'Ensure sponsor and arbiter cannot claim',
        arbiterStr: arbiter.address,
        workerStr: '',
        milestoneTitlesCSV: 'Step 1',
        milestoneAmountsCSV: '1000000',
        expiryHeight: 1500n,
      }
    );

    expect(() => claimBounty(created.state, sponsor, 1)).toThrow(
      'sponsor cannot claim own bounty'
    );
    expect(() => claimBounty(created.state, arbiter, 1)).toThrow(
      'arbiter cannot claim assigned bounty'
    );
  });

  it('prevents claiming an expired open bounty or claiming twice', () => {
    const seeded = createSeededTavernRealm();
    const expired = skipHeights(seeded, 50_000n);
    expect(() => claimBounty(expired, builder2, 3)).toThrow('bounty already expired');

    const claimed = claimBounty(seeded, builder2, 3);
    expect(() => claimBounty(claimed, worker, 3)).toThrow('bounty is not open for claim');
  });

  it('rejects duplicate roles during CreateBounty (arbiter == sponsor or worker == arbiter)', () => {
    const base = createEmptyRealm('onyx-1', 1000n);
    expect(() =>
      createBounty(
        base,
        { ...sponsor, originSendUgnot: 1_000_000n },
        {
          title: 'Same Arbiter',
          summary: 'Sponsor cannot act as neutral arbiter',
          arbiterStr: sponsor.address,
          workerStr: '',
          milestoneTitlesCSV: 'Step 1',
          milestoneAmountsCSV: '1000000',
          expiryHeight: 2000n,
        }
      )
    ).toThrow('arbiter cannot be sponsor');

    expect(() =>
      createBounty(
        base,
        { ...sponsor, originSendUgnot: 1_000_000n },
        {
          title: 'Worker Equals Arbiter',
          summary: 'Worker cannot arbitrate their own dispute',
          arbiterStr: arbiter.address,
          workerStr: arbiter.address,
          milestoneTitlesCSV: 'Step 1',
          milestoneAmountsCSV: '1000000',
          expiryHeight: 2000n,
        }
      )
    ).toThrow('worker cannot be arbiter');
  });

  it('rejects RejectMilestone when caller is not sponsor or milestone is not SUBMITTED', () => {
    const seeded = createSeededTavernRealm();
    expect(() => rejectMilestone(seeded, worker, 1, 1, 'Self reject')).toThrow(
      'only sponsor can reject milestone'
    );
    expect(() => rejectMilestone(seeded, sponsor, 1, 2, 'Not yet submitted')).toThrow(
      'milestone must be SUBMITTED to reject'
    );
  });

  it('requires configured arbiter and SUBMITTED/REJECTED status before RaiseDispute', () => {
    const base = createEmptyRealm('onyx-1', 1000n);
    const created = createBounty(
      base,
      { ...sponsor, originSendUgnot: 1_000_000n },
      {
        title: 'No Arbiter Bounty',
        summary: 'Test bounty without arbiter configured',
        arbiterStr: '',
        workerStr: worker.address,
        milestoneTitlesCSV: 'Single',
        milestoneAmountsCSV: '1000000',
        expiryHeight: 2000n,
      }
    );

    const submitted = submitMilestone(
      created.state,
      worker,
      1,
      0,
      'https://github.com/cocvn157/pr/10',
      'sha256:abcd123'
    );
    expect(() => raiseDispute(submitted, worker, 1, 0, 'Need arbiter')).toThrow(
      'bounty has no arbiter configured'
    );

    const seeded = createSeededTavernRealm();
    expect(() => raiseDispute(seeded, worker, 1, 2, 'Not submitted yet')).toThrow(
      'dispute requires SUBMITTED or REJECTED milestone'
    );
  });

  it('settles disputes via neutral arbiter for both worker release and sponsor refund', () => {
    const base = createEmptyRealm('onyx-1', 2000n);
    const created = createBounty(
      base,
      { ...sponsor, originSendUgnot: 2_500_000n },
      {
        title: 'Dispute Resolution Test',
        summary: 'Two milestones tested with dispute split',
        arbiterStr: arbiter.address,
        workerStr: worker.address,
        milestoneTitlesCSV: 'Milestone A,Milestone B',
        milestoneAmountsCSV: '1500000,1000000',
        expiryHeight: 2600n,
      }
    );

    let s = submitMilestone(created.state, worker, 1, 0, 'https://git.io/proofA', 'sha256:1234567');
    s = raiseDispute(s, sponsor, 1, 0, 'Missing test coverage report');
    expect(s.bounties[0].status).toBe('DISPUTED');

    expect(() => approveAndRelease(s, sponsor, 1, 0)).toThrow(
      'bounty must be ACTIVE to approve milestone'
    );
    expect(() => resolveDispute(s, sponsor, 1, 0, false, 'not arbiter')).toThrow(
      'only configured arbiter can resolve dispute'
    );
    expect(() => resolveDispute(s, arbiter, 1, 1, false, 'wrong index')).toThrow(
      'milestoneIdx does not match active disputed milestone'
    );

    s = resolveDispute(s, arbiter, 1, 0, false, 'Tests incomplete; refunded sponsor');
    expect(s.bounties[0].status).toBe('ACTIVE');
    expect(s.bounties[0].milestones[0].status).toBe('REFUNDED');
    expect(s.totalRefundedUgnot).toBe(1_500_000n);

    s = submitMilestone(s, worker, 1, 1, 'https://git.io/proofB', 'sha256:890abcd');
    s = raiseDispute(s, worker, 1, 1, 'Milestone B verified');
    s = resolveDispute(s, arbiter, 1, 1, true, 'All acceptance vectors passed');

    expect(s.bounties[0].status).toBe('COMPLETED');
    expect(s.totalReleasedUgnot).toBe(1_000_000n);
    expect(s.totalLockedUgnot).toBe(0n);
    expect(s.balances[REALM_ADDRESS]).toBe(0n);
  });

  it('blocks ReclaimExpired before expiryHeight and allows it after expiry', () => {
    const base = createEmptyRealm('onyx-1', 5000n);
    const created = createBounty(
      base,
      { ...sponsor, originSendUgnot: 2_000_000n },
      {
        title: 'Expiry Reclaim Test',
        summary: 'Verify time-lock refund behavior',
        arbiterStr: arbiter.address,
        workerStr: '',
        milestoneTitlesCSV: 'Deliverable',
        milestoneAmountsCSV: '2000000',
        expiryHeight: 5200n,
      }
    );

    expect(() => reclaimExpired(created.state, sponsor, 1)).toThrow(
      'bounty has not reached expiryHeight'
    );

    const expiredState = skipHeights(created.state, 200n);
    expect(() => reclaimExpired(expiredState, stranger, 1)).toThrow(
      'only sponsor can reclaim expired bounty'
    );

    const reclaimed = reclaimExpired(expiredState, sponsor, 1);
    expect(reclaimed.reclaimed).toBe(2_000_000n);
    expect(reclaimed.state.bounties[0].status).toBe('CANCELLED');
    expect(reclaimed.state.totalLockedUgnot).toBe(0n);
    expect(reclaimed.state.balances[sponsor.address]).toBe(50_000_000n);
    expect(() => reclaimExpired(reclaimed.state, sponsor, 1)).toThrow(
      'cannot reclaim disputed, completed, or cancelled bounty'
    );
  });

  it('rejects negative/overflow amounts, mismatched CSV lengths, and invalid addresses', () => {
    const base = createEmptyRealm();
    expect(() =>
      createBounty(
        base,
        { ...sponsor, originSendUgnot: 100n },
        {
          title: 'Bad Addr',
          summary: 'Invalid bech32 checksum should abort',
          arbiterStr: 'g1badchecksum0000000000000000000000000000',
          workerStr: '',
          milestoneTitlesCSV: 'M1',
          milestoneAmountsCSV: '100',
          expiryHeight: 500_000n,
        }
      )
    ).toThrow(RealmPanicError);

    expect(() =>
      createBounty(
        base,
        { ...sponsor, originSendUgnot: 100n },
        {
          title: 'Mismatch CSV',
          summary: 'Two titles and one amount should panic',
          arbiterStr: '',
          workerStr: '',
          milestoneTitlesCSV: 'M1,M2',
          milestoneAmountsCSV: '100',
          expiryHeight: 500_000n,
        }
      )
    ).toThrow('milestone titles and amounts length mismatch');

    expect(() =>
      createBounty(
        base,
        { ...sponsor, originSendUgnot: 100n },
        {
          title: 'Overflow Check',
          summary: 'Overflow above MaxInt64 must abort',
          arbiterStr: '',
          workerStr: '',
          milestoneTitlesCSV: 'Max,Plus',
          milestoneAmountsCSV: `${MAX_INT64.toString()},10`,
          expiryHeight: 500_000n,
        }
      )
    ).toThrow('int64 overflow in ugnot accounting');
  });

  it('rejects CodeRealm IsUserCall bypasses on all state-mutating functions', () => {
    const seeded = createSeededTavernRealm();
    expect(() => claimBounty(seeded, attackerRealm, 3)).toThrow(
      'ClaimBounty must be called by an EOA'
    );
    expect(() =>
      submitMilestone(seeded, attackerRealm, 1, 2, 'https://evil.invalid', 'deadbeef')
    ).toThrow('SubmitMilestone must be called by an EOA');
    expect(() => approveAndRelease(seeded, attackerRealm, 1, 1)).toThrow(
      'ApproveAndRelease must be called by an EOA'
    );
    expect(() => resolveDispute(seeded, attackerRealm, 2, 0, true, 'hijack')).toThrow(
      'ResolveDispute must be called by an EOA'
    );
  });

  it('enforces CreateBounty title, summary, and expiryHeight bounds', () => {
    const base = createEmptyRealm('onyx-1', 1000n);
    expect(() =>
      createBounty(
        base,
        { ...sponsor, originSendUgnot: 100n },
        {
          title: 'Hi',
          summary: 'Valid summary text',
          arbiterStr: '',
          workerStr: '',
          milestoneTitlesCSV: 'M1',
          milestoneAmountsCSV: '100',
          expiryHeight: 1500n,
        }
      )
    ).toThrow('title must be 3..96 chars');

    expect(() =>
      createBounty(
        base,
        { ...sponsor, originSendUgnot: 100n },
        {
          title: 'Valid Title',
          summary: 'Bad',
          arbiterStr: '',
          workerStr: '',
          milestoneTitlesCSV: 'M1',
          milestoneAmountsCSV: '100',
          expiryHeight: 1500n,
        }
      )
    ).toThrow('summary must be 5..512 chars');

    expect(() =>
      createBounty(
        base,
        { ...sponsor, originSendUgnot: 100n },
        {
          title: 'Expired Immediately',
          summary: 'Expiry at current block should fail',
          arbiterStr: '',
          workerStr: '',
          milestoneTitlesCSV: 'M1',
          milestoneAmountsCSV: '100',
          expiryHeight: 1000n,
        }
      )
    ).toThrow('expiryHeight must exceed current chain height');
  });
});

describe('Adversarial Safety Lab & Audit Integrity', () => {
  it.each(ATTACK_VECTORS)('aborts attack vector "$id" while preserving audit digest', (vec) => {
    const seeded = createSeededTavernRealm();
    const report = runAttackVector(seeded, vec.id);
    expect(report.aborted).toBe(true);
    expect(report.invariantPreserved).toBe(true);
    expect(report.digestBefore).toBe(report.digestAfter);
    expect(report.panicMessage.length).toBeGreaterThan(3);
  });

  it('detects both payload tampering and prevDigest linkage breaks in audit ledger', () => {
    const seeded = createSeededTavernRealm();
    expect(verifyAuditChain(seeded).valid).toBe(true);

    const tamperedPayload = createSeededTavernRealm();
    tamperedPayload.audits[1].amountUgnot = 999_999_999n;
    const res1 = verifyAuditChain(tamperedPayload);
    expect(res1.valid).toBe(false);
    expect(res1.brokenAtSeq).toBe(2);

    const tamperedLink = createSeededTavernRealm();
    tamperedLink.audits[2].prevDigest = 'deadbeef'.repeat(8);
    const res2 = verifyAuditChain(tamperedLink);
    expect(res2.valid).toBe(false);
    expect(res2.brokenAtSeq).toBe(3);
  });
});

describe('Deterministic Render(path) & gnokey CLI Generator', () => {
  it('renders home, bounty detail, audit, safety, and 404 routes deterministically', () => {
    const seeded = createSeededTavernRealm();
    const home = renderPath(seeded, '');
    expect(home).toContain('# TavernEscrow — Milestone Bounty & Dispute Realm');
    expect(home).toContain('GnoConnect Ledger Hardware Signer');
    expect(renderPath(seeded, '/')).toBe(home);

    const detail = renderPath(seeded, 'bounty/2');
    expect(detail).toContain('# Bounty #2 — Onyx Event Stream Indexer');
    expect(detail).toContain('`DISPUTED`');

    const audit = renderPath(seeded, 'audit');
    expect(audit).toContain('# TavernEscrow — Tamper-Evident Audit Ledger');
    expect(audit).toContain('DISPUTE_RAISED');

    const safety = renderPath(seeded, 'safety');
    expect(safety).toContain('EOA Payment Boundary');

    expect(renderPath(seeded, 'bounty/999')).toContain('404 — Bounty #999 Not Found');
    expect(renderPath(seeded, 'bounty/abc')).toContain('404 — Invalid Bounty ID');
    expect(renderPath(seeded, 'invalid/route')).toContain('404 — Route Not Found');
  });

  it('renders empty-state home board cleanly when zero bounties exist', () => {
    const empty = createEmptyRealm('onyx-1', 100n);
    const md = renderPath(empty, '');
    expect(md).toContain('No bounties funded yet');
    expect(md).toContain('`onyx-1` @ `#100`');
  });

  it('generates valid single-dash gnokey commands with and without -send', () => {
    const cfg = {
      network: 'onyx-1' as const,
      namespace: builder2.address,
      keyName: 'tavern-key',
      gasFee: '100000ugnot',
      gasWanted: '8000000',
    };

    expect(buildPkgPath(builder2.address)).toBe(`gno.land/r/${builder2.address}/tavernescrow`);
    expect(buildGnowebUrl('onyx-1', 'cocvn157', 'bounty/1')).toBe(
      'https://onyx.testnets.gno.land/r/cocvn157/tavernescrow:bounty/1'
    );
    expect(buildGnowebUrl('gnoland-1', 'cocvn157')).toBe(
      'https://gno.land/r/cocvn157/tavernescrow'
    );

    const addPkg = buildAddPkgCommand(cfg);
    expect(addPkg).toContain('gnokey maketx addpkg');
    expect(addPkg).toContain(`-pkgpath "gno.land/r/${builder2.address}/tavernescrow"`);
    expect(addPkg).toContain('-chainid onyx-1');
    expect(addPkg).toContain('-remote "https://rpc.onyx.testnets.gno.land:443"');

    const callWithSend = buildCallCommand(
      cfg,
      'CreateBounty',
      ['Title "One"', 'Summary'],
      1_500_000n
    );
    expect(callWithSend).toContain('-func "CreateBounty"');
    expect(callWithSend).toContain('-args "Title \\"One\\""');
    expect(callWithSend).toContain('-send "1500000ugnot"');

    const callNoSend = buildCallCommand(cfg, 'ClaimBounty', ['3']);
    expect(callNoSend).not.toContain('-send');
    expect(callNoSend).toContain('-args "3"');

    const qCmd = buildQueryRenderCommand(cfg, 'audit');
    expect(qCmd).toContain('gnokey query vm/qrender');
    expect(qCmd).toContain(`-data "gno.land/r/${builder2.address}/tavernescrow:audit"`);
  });

  it('exports verifiable JSON audit proof matching RealmStats accounting', () => {
    const seeded = createSeededTavernRealm();
    const cfg = {
      network: 'onyx-1' as const,
      namespace: 'cocvn157',
      keyName: 'mykey',
      gasFee: '100000ugnot',
      gasWanted: '8000000',
    };
    const proof = JSON.parse(exportAuditProofJson(seeded, cfg));
    expect(proof.schema).toBe('tavern-escrow.audit-proof.v1');
    expect(proof.integrity.valid).toBe(true);
    expect(proof.bounties).toHaveLength(3);
    expect(proof.accounting.totalLockedUgnot).toBe(getRealmStats(seeded).totalLockedUgnot.toString());
  });
});
