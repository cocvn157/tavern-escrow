import React, { useState } from 'react';
import {
  CheckCircle2,
  Coins,
  Plus,
  Scale,
  Send,
  ShieldAlert,
  TimerReset,
  UserCheck,
  XCircle,
} from 'lucide-react';
import {
  Bounty,
  CallerContext,
  CreateBountyInput,
  DEMO_ACTORS,
  RealmState,
  bountyLockedRemaining,
} from '../engine/tavernRealm';

interface EscrowWorkbenchProps {
  state: RealmState;
  activeActor: CallerContext;
  selectedBountyId: number;
  onSelectBounty: (id: number) => void;
  onActorChange: (actorId: string) => void;
  onCreateBounty: (input: CreateBountyInput, sendUgnot: bigint) => void;
  onClaimBounty: (bountyId: number) => void;
  onSubmitMilestone: (
    bountyId: number,
    milestoneIdx: number,
    proofURI: string,
    commitDigest: string
  ) => void;
  onApproveRelease: (bountyId: number, milestoneIdx: number) => void;
  onRejectMilestone: (bountyId: number, milestoneIdx: number, reason: string) => void;
  onRaiseDispute: (bountyId: number, milestoneIdx: number, note: string) => void;
  onResolveDispute: (
    bountyId: number,
    milestoneIdx: number,
    releaseToWorker: boolean,
    note: string
  ) => void;
  onReclaimExpired: (bountyId: number) => void;
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'COMPLETED':
    case 'RELEASED':
      return 'pill pill-emerald';
    case 'DISPUTED':
    case 'REJECTED':
      return 'pill pill-red';
    case 'OPEN':
    case 'SUBMITTED':
      return 'pill pill-amber';
    case 'ACTIVE':
      return 'pill pill-sky';
    default:
      return 'pill';
  }
}

export function formatGnot(ugnot: bigint): string {
  const whole = ugnot / 1_000_000n;
  const frac = (ugnot % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '');
  return frac ? `${whole.toLocaleString()}.${frac} GNOT` : `${whole.toLocaleString()} GNOT`;
}

export const EscrowWorkbench: React.FC<EscrowWorkbenchProps> = ({
  state,
  activeActor,
  selectedBountyId,
  onSelectBounty,
  onActorChange,
  onCreateBounty,
  onClaimBounty,
  onSubmitMilestone,
  onApproveRelease,
  onRejectMilestone,
  onRaiseDispute,
  onResolveDispute,
  onReclaimExpired,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [title, setTitle] = useState('Tavern GRC20 Fee Splitter');
  const [summary, setSummary] = useState(
    'Deploy deterministic GRC20 revenue-split realm with automated test coverage.'
  );
  const [arbiterStr, setArbiterStr] = useState(DEMO_ACTORS[2].address);
  const [workerStr, setWorkerStr] = useState('');
  const [milestoneTitles, setMilestoneTitles] = useState('Realm Core,Unit Tests & Docs');
  const [milestoneAmounts, setMilestoneAmounts] = useState('1500000,1500000');
  const [expiryBlocksAhead, setExpiryBlocksAhead] = useState('2500');
  const [sendOverride, setSendOverride] = useState('3000000');

  const [proofURI, setProofURI] = useState('https://github.com/cocvn157/tavern-escrow/pull/4');
  const [commitDigest, setCommitDigest] = useState('sha256:c4f92e80ab12');
  const [actionNote, setActionNote] = useState('Verified deterministic output & tests');

  const selectedBounty: Bounty | undefined =
    state.bounties.find((b) => b.id === selectedBountyId) ?? state.bounties[0];

  const actorBalance = state.balances[activeActor.address] ?? 0n;

  const handleSubmitCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAhead = /^\d+$/.test(expiryBlocksAhead.trim())
      ? BigInt(expiryBlocksAhead.trim())
      : 1000n;
    const parsedSend = /^\d+$/.test(sendOverride.trim()) ? BigInt(sendOverride.trim()) : 0n;

    onCreateBounty(
      {
        title,
        summary,
        arbiterStr,
        workerStr,
        milestoneTitlesCSV: milestoneTitles,
        milestoneAmountsCSV: milestoneAmounts,
        expiryHeight: state.blockHeight + parsedAhead,
      },
      parsedSend
    );
    setShowCreateForm(false);
  };

  return (
    <div>
      {/* Actor Switcher Bar */}
      <div className="actor-bar">
        <div className="actor-controls">
          <label htmlFor="actor-select" className="field-label" style={{ marginBottom: 0 }}>
            Active Caller (`cur.Previous()`):
          </label>
          <select
            id="actor-select"
            className="select"
            value={activeActor.id}
            onChange={(e) => onActorChange(e.target.value)}
          >
            {DEMO_ACTORS.map((actor) => (
              <option key={actor.id} value={actor.id}>
                {actor.label}
              </option>
            ))}
          </select>
          <span className={activeActor.isUserCall ? 'pill pill-emerald' : 'pill pill-red'}>
            {activeActor.isUserCall ? 'EOA · IsUserCall=true' : 'CodeRealm · IsUserCall=false'}
          </span>
        </div>
        <div className="actor-controls">
          <span className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {activeActor.address.slice(0, 12)}...{activeActor.address.slice(-6)} ·{' '}
            <strong style={{ color: 'var(--amber-400)' }}>
              {actorBalance.toLocaleString()} ugnot
            </strong>
          </span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowCreateForm((v) => !v)}
          >
            <Plus size={15} />
            {showCreateForm ? 'Close Form' : 'New Escrow Bounty'}
          </button>
        </div>
      </div>

      {/* Create Bounty Drawer */}
      {showCreateForm && (
        <form className="panel" style={{ marginBottom: 16 }} onSubmit={handleSubmitCreate}>
          <div className="panel-header">
            <h3 className="panel-title">
              <Coins size={16} color="var(--amber-400)" />
              Fund New Escrow (`CreateBounty`)
            </h3>
            <span className="pill pill-amber">Caller: {activeActor.label}</span>
          </div>
          <div className="form-grid">
            <div>
              <label htmlFor="bounty-title" className="field-label">
                Title (3..96 chars)
              </label>
              <input
                id="bounty-title"
                className="input"
                style={{ width: '100%' }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bounty-arbiter" className="field-label">
                Arbiter Address (optional)
              </label>
              <input
                id="bounty-arbiter"
                className="input mono"
                style={{ width: '100%' }}
                value={arbiterStr}
                onChange={(e) => setArbiterStr(e.target.value)}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label htmlFor="bounty-summary" className="field-label">
                Scope Summary
              </label>
              <input
                id="bounty-summary"
                className="input"
                style={{ width: '100%' }}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bounty-worker" className="field-label">
                Pre-assigned Worker (leave blank for OPEN)
              </label>
              <input
                id="bounty-worker"
                className="input mono"
                style={{ width: '100%' }}
                placeholder="g1... or empty for open claim"
                value={workerStr}
                onChange={(e) => setWorkerStr(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bounty-expiry" className="field-label">
                Expiry Offset (blocks ahead of #{state.blockHeight.toString()})
              </label>
              <input
                id="bounty-expiry"
                className="input mono"
                style={{ width: '100%' }}
                value={expiryBlocksAhead}
                onChange={(e) => setExpiryBlocksAhead(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bounty-mtitles" className="field-label">
                Milestone Titles (CSV)
              </label>
              <input
                id="bounty-mtitles"
                className="input"
                style={{ width: '100%' }}
                value={milestoneTitles}
                onChange={(e) => setMilestoneTitles(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bounty-mamounts" className="field-label">
                Milestone Amounts in ugnot (CSV)
              </label>
              <input
                id="bounty-mamounts"
                className="input mono"
                style={{ width: '100%' }}
                value={milestoneAmounts}
                onChange={(e) => setMilestoneAmounts(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="bounty-send" className="field-label">
                Attached `-send` (ugnot, must equal exact sum)
              </label>
              <input
                id="bounty-send"
                className="input mono"
                style={{ width: '100%' }}
                value={sendOverride}
                onChange={(e) => setSendOverride(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <button type="submit" className="btn btn-primary">
                <Coins size={15} />
                Broadcast `CreateBounty`
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Main Two-Column Workbench */}
      <div className="two-col">
        {/* Left List */}
        <div className="panel">
          <div className="panel-header">
            <h3 className="panel-title">Escrow Bounties ({state.bounties.length})</h3>
            <span className="pill">Realm AVL</span>
          </div>
          <div className="bounty-list">
            {[...state.bounties].reverse().map((b) => (
              <button
                key={b.id}
                type="button"
                className={`bounty-item ${selectedBounty?.id === b.id ? 'selected' : ''}`}
                onClick={() => onSelectBounty(b.id)}
              >
                <div className="bounty-item-top">
                  <span className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Bounty #{b.id}
                  </span>
                  <span className={statusBadgeClass(b.status)}>{b.status}</span>
                </div>
                <p className="bounty-item-title">{b.title}</p>
                <div className="bounty-item-meta">
                  <span>{formatGnot(b.totalFunded)}</span>
                  <span>Locked: {bountyLockedRemaining(b).toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right Detail & Milestone Controls */}
        {selectedBounty ? (
          <div className="panel">
            <div className="panel-header">
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <h3 className="panel-title">
                    #{selectedBounty.id} · {selectedBounty.title}
                  </h3>
                  <span className={statusBadgeClass(selectedBounty.status)}>
                    {selectedBounty.status}
                  </span>
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                  {selectedBounty.summary}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {selectedBounty.status === 'OPEN' && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onClaimBounty(selectedBounty.id)}
                  >
                    <UserCheck size={14} />
                    Claim Bounty
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => onReclaimExpired(selectedBounty.id)}
                >
                  <TimerReset size={14} />
                  Reclaim Expired
                </button>
              </div>
            </div>

            <div
              className="form-grid"
              style={{
                padding: 12,
                borderRadius: 10,
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border-subtle)',
                marginBottom: 14,
                fontSize: '0.78rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Sponsor: </span>
                <code className="mono">{selectedBounty.sponsor}</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Builder: </span>
                <code className="mono">{selectedBounty.worker || 'OPEN FOR CLAIM'}</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Arbiter: </span>
                <code className="mono">{selectedBounty.arbiter || 'NONE'}</code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Expiry Height: </span>
                <code className="mono">
                  #{selectedBounty.expiryHeight.toString()} (
                  {state.blockHeight >= selectedBounty.expiryHeight
                    ? 'EXPIRED'
                    : `${(selectedBounty.expiryHeight - state.blockHeight).toString()} blocks left`}
                  )
                </code>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Locked Remaining: </span>
                <strong className="mono" style={{ color: 'var(--amber-400)' }}>
                  {bountyLockedRemaining(selectedBounty).toLocaleString()} ugnot
                </strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Released / Refunded: </span>
                <span className="mono">
                  {selectedBounty.releasedAmount.toLocaleString()} /{' '}
                  {selectedBounty.refundedAmount.toLocaleString()} ugnot
                </span>
              </div>
            </div>

            {/* Proof & Note Inputs for Milestone Actions */}
            <div className="form-grid" style={{ marginBottom: 14 }}>
              <div>
                <label htmlFor="proof-uri-input" className="field-label">
                  Deliverable Proof URI (`SubmitMilestone`)
                </label>
                <input
                  id="proof-uri-input"
                  className="input mono"
                  style={{ width: '100%' }}
                  value={proofURI}
                  onChange={(e) => setProofURI(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="commit-digest-input" className="field-label">
                  Commit / Artifact Digest
                </label>
                <input
                  id="commit-digest-input"
                  className="input mono"
                  style={{ width: '100%' }}
                  value={commitDigest}
                  onChange={(e) => setCommitDigest(e.target.value)}
                />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label htmlFor="action-note-input" className="field-label">
                  Rejection / Dispute / Arbiter Verdict Note
                </label>
                <input
                  id="action-note-input"
                  className="input"
                  style={{ width: '100%' }}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                />
              </div>
            </div>

            <div className="milestone-list">
              {selectedBounty.milestones.map((m) => (
                <div key={m.index} className="milestone-card">
                  <div className="milestone-head">
                    <div>
                      <strong>
                        Milestone #{m.index}: {m.title}
                      </strong>
                      <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--amber-400)' }}>
                        {m.amountUgnot.toLocaleString()} ugnot ({formatGnot(m.amountUgnot)})
                      </div>
                    </div>
                    <span className={statusBadgeClass(m.status)}>{m.status}</span>
                  </div>

                  {m.proofURI && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Proof: <code className="mono">{m.proofURI}</code> · Digest:{' '}
                      <code className="mono">{m.commitDigest}</code>
                    </div>
                  )}
                  {m.feedbackNote && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--amber-400)', marginTop: 4 }}>
                      Note: {m.feedbackNote}
                    </div>
                  )}

                  <div className="milestone-actions">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        onSubmitMilestone(selectedBounty.id, m.index, proofURI, commitDigest)
                      }
                    >
                      <Send size={13} />
                      Submit Proof
                    </button>
                    <button
                      type="button"
                      className="btn btn-emerald btn-sm"
                      onClick={() => onApproveRelease(selectedBounty.id, m.index)}
                    >
                      <CheckCircle2 size={13} />
                      Approve &amp; Release
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onRejectMilestone(selectedBounty.id, m.index, actionNote)}
                    >
                      <XCircle size={13} />
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      onClick={() => onRaiseDispute(selectedBounty.id, m.index, actionNote)}
                    >
                      <ShieldAlert size={13} />
                      Raise Dispute
                    </button>
                    {selectedBounty.status === 'DISPUTED' &&
                      selectedBounty.disputedIdx === m.index && (
                        <>
                          <button
                            type="button"
                            className="btn btn-emerald btn-sm"
                            onClick={() =>
                              onResolveDispute(selectedBounty.id, m.index, true, actionNote)
                            }
                          >
                            <Scale size={13} />
                            Arbiter: Release to Worker
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() =>
                              onResolveDispute(selectedBounty.id, m.index, false, actionNote)
                            }
                          >
                            <Scale size={13} />
                            Arbiter: Refund Sponsor
                          </button>
                        </>
                      )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="panel">No bounty selected.</div>
        )}
      </div>
    </div>
  );
};
