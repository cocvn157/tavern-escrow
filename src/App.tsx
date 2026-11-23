import React, { useMemo, useState } from 'react';
import {
  Blocks,
  FastForward,
  Flame,
  Globe,
  RotateCcw,
  ShieldAlert,
  Terminal,
  Wallet,
} from 'lucide-react';
import {
  CreateBountyInput,
  DEMO_ACTORS,
  RealmPanicError,
  RealmState,
  approveAndRelease,
  claimBounty,
  createBounty,
  createSeededTavernRealm,
  getRealmStats,
  raiseDispute,
  reclaimExpired,
  rejectMilestone,
  resolveDispute,
  skipHeights,
  submitMilestone,
  verifyAuditChain,
} from './engine/tavernRealm';
import { EscrowWorkbench, formatGnot } from './components/EscrowWorkbench';
import { RenderExplorer } from './components/RenderExplorer';
import { SafetyLab } from './components/SafetyLab';
import { DeployAuditHub } from './components/DeployAuditHub';

type TabKey = 'workbench' | 'render' | 'safety' | 'deploy';

export const App: React.FC = () => {
  const [realmState, setRealmState] = useState<RealmState>(() => createSeededTavernRealm());
  const [activeTab, setActiveTab] = useState<TabKey>('workbench');
  const [activeActorId, setActiveActorId] = useState<string>('sponsor');
  const [selectedBountyId, setSelectedBountyId] = useState<number>(1);
  const [renderRoute, setRenderRoute] = useState<string>('');
  const [banner, setBanner] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const activeActor = useMemo(
    () => DEMO_ACTORS.find((a) => a.id === activeActorId) ?? DEMO_ACTORS[0],
    [activeActorId]
  );

  const stats = useMemo(() => getRealmStats(realmState), [realmState]);
  const auditCheck = useMemo(() => verifyAuditChain(realmState), [realmState]);
  const selectedBounty = useMemo(
    () => realmState.bounties.find((b) => b.id === selectedBountyId) ?? realmState.bounties[0],
    [realmState, selectedBountyId]
  );

  const runMutation = (fn: () => { next: RealmState; message: string; selectId?: number }) => {
    try {
      const result = fn();
      setRealmState(result.next);
      if (result.selectId !== undefined) {
        setSelectedBountyId(result.selectId);
      }
      setBanner({ kind: 'ok', text: result.message });
    } catch (err) {
      const msg =
        err instanceof RealmPanicError
          ? `GnoVM Abort · panic("${err.message}")`
          : err instanceof Error
            ? err.message
            : String(err);
      setBanner({ kind: 'err', text: msg });
    }
  };

  const handleCreateBounty = (input: CreateBountyInput, sendUgnot: bigint) => {
    runMutation(() => {
      const caller = { ...activeActor, originSendUgnot: sendUgnot };
      const { state, bountyId } = createBounty(realmState, caller, input);
      return {
        next: state,
        selectId: bountyId,
        message: `Funded Bounty #${bountyId} with ${sendUgnot.toLocaleString()} ugnot at block #${state.blockHeight.toString()}.`,
      };
    });
  };

  const handleClaim = (bountyId: number) => {
    runMutation(() => ({
      next: claimBounty(realmState, activeActor, bountyId),
      message: `${activeActor.label} claimed Bounty #${bountyId}.`,
    }));
  };

  const handleSubmitMilestone = (
    bountyId: number,
    milestoneIdx: number,
    proofURI: string,
    commitDigest: string
  ) => {
    runMutation(() => ({
      next: submitMilestone(realmState, activeActor, bountyId, milestoneIdx, proofURI, commitDigest),
      message: `Submitted proof for Bounty #${bountyId} Milestone #${milestoneIdx}.`,
    }));
  };

  const handleApproveRelease = (bountyId: number, milestoneIdx: number) => {
    runMutation(() => ({
      next: approveAndRelease(realmState, activeActor, bountyId, milestoneIdx),
      message: `Approved & released Bounty #${bountyId} Milestone #${milestoneIdx} payout.`,
    }));
  };

  const handleRejectMilestone = (bountyId: number, milestoneIdx: number, reason: string) => {
    runMutation(() => ({
      next: rejectMilestone(realmState, activeActor, bountyId, milestoneIdx, reason),
      message: `Rejected Bounty #${bountyId} Milestone #${milestoneIdx} back to worker.`,
    }));
  };

  const handleRaiseDispute = (bountyId: number, milestoneIdx: number, note: string) => {
    runMutation(() => ({
      next: raiseDispute(realmState, activeActor, bountyId, milestoneIdx, note),
      message: `Dispute raised on Bounty #${bountyId} Milestone #${milestoneIdx} — escrow frozen.`,
    }));
  };

  const handleResolveDispute = (
    bountyId: number,
    milestoneIdx: number,
    releaseToWorker: boolean,
    note: string
  ) => {
    runMutation(() => ({
      next: resolveDispute(realmState, activeActor, bountyId, milestoneIdx, releaseToWorker, note),
      message: releaseToWorker
        ? `Arbiter released Bounty #${bountyId} Milestone #${milestoneIdx} to worker.`
        : `Arbiter refunded Bounty #${bountyId} Milestone #${milestoneIdx} to sponsor.`,
    }));
  };

  const handleReclaimExpired = (bountyId: number) => {
    runMutation(() => {
      const { state, reclaimed } = reclaimExpired(realmState, activeActor, bountyId);
      return {
        next: state,
        message: `Reclaimed ${reclaimed.toLocaleString()} ugnot from expired Bounty #${bountyId}.`,
      };
    });
  };

  const handleSkipBlocks = (delta: bigint) => {
    runMutation(() => {
      const next = skipHeights(realmState, delta);
      return {
        next,
        message: `Advanced simulated chain height by +${delta.toString()} -> #${next.blockHeight.toString()}.`,
      };
    });
  };

  const handleReset = () => {
    setRealmState(createSeededTavernRealm());
    setSelectedBountyId(1);
    setRenderRoute('');
    setBanner({ kind: 'ok', text: 'Reset TavernEscrow realm to seeded Onyx state.' });
  };

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="top-header">
        <div className="brand-wrap">
          <div className="brand-badge">
            <Flame size={24} />
          </div>
          <div>
            <h1 className="brand-title">
              TavernEscrow
              <span className="pill pill-amber">Gno.land v0.9 · {stats.chainId}</span>
            </h1>
            <p className="brand-sub">
              Deterministic milestone bounty escrow, arbiter dispute settlement &amp; SHA-256 audit
              workbench
            </p>
          </div>
        </div>

        <div className="header-controls">
          <div className="block-chip mono">
            <Blocks size={15} color="var(--amber-400)" />
            Height #{stats.blockHeight.toString()}
          </div>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => handleSkipBlocks(100n)}
            title="Mirror testing.SkipHeights(100)"
          >
            <FastForward size={14} />
            +100 blks
          </button>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => handleSkipBlocks(2500n)}
            title="Mirror testing.SkipHeights(2500)"
          >
            <FastForward size={14} />
            +2,500 blks
          </button>
          <button type="button" className="btn btn-sm" onClick={handleReset}>
            <RotateCcw size={14} />
            Reset
          </button>
        </div>
      </header>

      {/* KPI Strip */}
      <section className="stats-grid" aria-label="Realm Accounting Metrics">
        <div className="stat-card">
          <div className="stat-label">Locked Escrow TVL</div>
          <div className="stat-value">{formatGnot(stats.totalLockedUgnot)}</div>
          <div className="stat-sub">
            Treasury: {stats.realmTreasuryBalance.toLocaleString()} ugnot
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Released to Builders</div>
          <div className="stat-value" style={{ color: 'var(--emerald-400)' }}>
            {formatGnot(stats.totalReleasedUgnot)}
          </div>
          <div className="stat-sub">Total Funded: {formatGnot(stats.totalFundedUgnot)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bounties &amp; Refunds</div>
          <div className="stat-value">{stats.bountyCount} Active/Hist</div>
          <div className="stat-sub">Refunded: {formatGnot(stats.totalRefundedUgnot)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Audit Chain Integrity</div>
          <div className="stat-value" style={{ fontSize: '0.95rem' }}>
            {auditCheck.valid ? 'VERIFIED SHA-256' : 'BROKEN'}
          </div>
          <div className="stat-sub audit-chain-pill">
            #{stats.auditCount} · {stats.latestAuditDigest.slice(0, 12)}...
          </div>
        </div>
      </section>

      {/* Feedback Banner */}
      {banner && (
        <div
          role="status"
          className={`banner ${banner.kind === 'ok' ? 'banner-ok' : 'banner-err'}`}
        >
          <span className="mono">{banner.text}</span>
          <button type="button" className="btn btn-sm" onClick={() => setBanner(null)}>
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <nav className="nav-tabs" aria-label="Primary Views">
        <button
          type="button"
          className={`nav-tab ${activeTab === 'workbench' ? 'active' : ''}`}
          onClick={() => setActiveTab('workbench')}
        >
          <Wallet size={16} />
          Escrow Workbench
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'render' ? 'active' : ''}`}
          onClick={() => setActiveTab('render')}
        >
          <Globe size={16} />
          Render(path) Explorer
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'safety' ? 'active' : ''}`}
          onClick={() => setActiveTab('safety')}
        >
          <ShieldAlert size={16} />
          Adversarial Safety Lab
        </button>
        <button
          type="button"
          className={`nav-tab ${activeTab === 'deploy' ? 'active' : ''}`}
          onClick={() => setActiveTab('deploy')}
        >
          <Terminal size={16} />
          gnokey CLI &amp; Gno Source
        </button>
      </nav>

      {/* Active View */}
      <main>
        {activeTab === 'workbench' && (
          <EscrowWorkbench
            state={realmState}
            activeActor={activeActor}
            selectedBountyId={selectedBountyId}
            onSelectBounty={setSelectedBountyId}
            onActorChange={setActiveActorId}
            onCreateBounty={handleCreateBounty}
            onClaimBounty={handleClaim}
            onSubmitMilestone={handleSubmitMilestone}
            onApproveRelease={handleApproveRelease}
            onRejectMilestone={handleRejectMilestone}
            onRaiseDispute={handleRaiseDispute}
            onResolveDispute={handleResolveDispute}
            onReclaimExpired={handleReclaimExpired}
          />
        )}
        {activeTab === 'render' && (
          <RenderExplorer
            state={realmState}
            route={renderRoute}
            onChangeRoute={setRenderRoute}
          />
        )}
        {activeTab === 'safety' && <SafetyLab state={realmState} />}
        {activeTab === 'deploy' && (
          <DeployAuditHub state={realmState} selectedBounty={selectedBounty} />
        )}
      </main>
    </div>
  );
};
