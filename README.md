# TavernEscrow

**Deterministic multi-milestone `ugnot` bounty escrow realm & interactive workbench for Gno.land (`onyx-1` / `gnoland-1`).**

Built for the **Gnome Tavern Hackathon | Gno.land** (`https://dorahacks.io/hackathon/gnome-tavern/detail`).

---

## Why TavernEscrow?

Builders, DAOs, and grant programs on Gno.land need milestone-gated `ugnot` escrow that enforces strict interrealm payment boundaries, protects builders against arbitrary post-delivery cancellation, lets neutral arbiters resolve deadlocks, and exposes every state transition directly in `gnoweb` via `Render(path)`.

TavernEscrow ships two tightly coupled deliverables:

1. **Idiomatic Gno v0.9 Realm (`gno/r/cocvn157/tavernescrow/`)**
   - `gnomod.toml` — Gno `0.9` package manifest.
   - `types.gno` — Escrow structs, status enums, overflow-safe `int64` arithmetic, and value-copied snapshot types (`BountyView`, `RealmStats`).
   - `escrow.gno` — Crossing functions (`CreateBounty`, `ClaimBounty`, `SubmitMilestone`, `ApproveAndRelease`, `RejectMilestone`, `RaiseDispute`, `ResolveDispute`, `ReclaimExpired`) with EOA `IsUserCall()` + `OriginSend()` guards, checks-effects-interactions accounting, `chain/banker` payouts, and a chained SHA-256 audit log (`crypto/sha256` + `encoding/hex`).
   - `render.gno` — Deterministic `gnoweb` markdown router serving `/`, `bounty/<id>`, `audit`, and `safety`.
   - `escrow_test.gno` — Gno unit tests covering full lifecycle, dispute resolution, expiry reclaim, `Render()` output, and cross-realm `NewCodeRealm` MITM aborts.

2. **Interactive React 19 + TypeScript Workbench (`src/`)**
   - **Escrow Workbench**: Bit-for-bit TypeScript mirror of the Gno realm state machine with live actor switching (`Sponsor`, `Builder`, `Arbiter`, `Attacker CodeRealm`), wallet balances, block-height advancement (`testing.SkipHeights`), and milestone lifecycle execution.
   - **Deterministic `Render(path)` Explorer**: Live `gnoweb`-style markdown viewer and raw markdown inspector for `:`, `:bounty/<id>`, `:audit`, and `:safety`.
   - **Adversarial Safety Lab**: One-click execution of 6 Gno threat vectors (Cross-Realm MITM Coin Drain, Underfunded `-send` Mismatch, Worker Self-Release, Double-Release Replay, Expiry Hijack During Active Dispute, and `Int64` Overflow) proving invariant preservation.
   - **`gnokey` CLI & Source Inspector**: Generates copy-ready `gnokey maketx addpkg`, `gnokey maketx call`, and `gnokey query vm/qrender` commands for `onyx-1`, `latest`, and `gnoland-1`, inspects live `.gno` sources, and exports verifiable JSON Audit Proofs.

---

## Architecture & Security Invariants

Following Gno.land's **Interrealm v2** and **Gno Security Guide for Realm Authors**:

1. **EOA Payment Boundary (`cur.Previous().IsUserCall()` + `unsafe.OriginSend()`)**: Rejects intermediary code realms and ephemeral `MsgRun` scripts before trusting `-send` coin envelopes.
2. **Checks-Effects-Interactions**: Commits milestone status, bounty counters, global TVL totals, and chained SHA-256 audit entries prior to `banker.NewBanker(banker.BankerTypeRealmSend, cur).SendCoins(...)`.
3. **Zero Pointer Aliasing**: Exported query functions (`GetBountyView`, `GetRealmStats`, `GetBountySummary`) return defensive value snapshots rather than `*avl.Tree` or `*Bounty` pointers.
4. **Role Separation & Dispute Freeze Lock**: Sponsor, Worker, and Arbiter must be distinct addresses; `ReclaimExpired` cannot drain an active `DISPUTED` bounty even after `expiryHeight`.
5. **Overflow-Safe `int64` Accounting**: `safeAddInt64` / `safeSubInt64` guard all milestone sums and TVL transitions against signed `int64` wrapping.

---

## Local Verification

### Interactive Console & TypeScript Engine

```bash
npm.cmd install
npm.cmd run typecheck   # tsc --noEmit
npm.cmd test            # Vitest unit + UI suite
npm.cmd run build       # Vite production bundle
```

### Gno Realm Tests & Testnet Deployment (requires `gno` & `gnokey`)

```bash
# Run Gno unit tests locally
cd gno/r/cocvn157/tavernescrow
gno test -v .

# Fund your key via https://faucet.gno.land (Onyx testnet: onyx-1)
# On permissionless testnets, replace cocvn157 with your g1... address
# in gnomod.toml and -pkgpath if you do not hold a registered handle.

gnokey maketx addpkg \
  -pkgpath "gno.land/r/<your_g1_or_namespace>/tavernescrow" \
  -pkgdir "./gno/r/cocvn157/tavernescrow" \
  -max-deposit "50000000ugnot" \
  -gas-fee 100000ugnot \
  -gas-wanted 8000000 \
  -chainid onyx-1 \
  -remote "https://rpc.onyx.testnets.gno.land:443" \
  mykey
```

---

## License

[MIT](./LICENSE)
