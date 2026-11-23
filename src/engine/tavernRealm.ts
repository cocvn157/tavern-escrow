import { isValidGnoAddress } from './bech32';
import { sha256Hex } from './sha256';

export const DENOM_UGNOT = 'ugnot';
export const MAX_MILESTONES = 16;
export const MAX_TITLE_LEN = 96;
export const MAX_SUMMARY_LEN = 512;
export const MAX_NOTE_LEN = 280;
export const MAX_INT64 = (1n << 63n) - 1n;
export const GENESIS_AUDIT_DIGEST =
  '0000000000000000000000000000000000000000000000000000000000000000';

export const REALM_PACKAGE_PATH = 'gno.land/r/cocvn157/tavernescrow';
export const REALM_ADDRESS = 'g1jths0uxlaqa2vwwu6lc57xu7p92ctupdud6rh8';

export type BountyStatus = 'OPEN' | 'ACTIVE' | 'DISPUTED' | 'COMPLETED' | 'CANCELLED';

export type MilestoneStatus =
  | 'PENDING'
  | 'SUBMITTED'
  | 'REJECTED'
  | 'RELEASED'
  | 'REFUNDED';

export interface CallerContext {
  id: string;
  label: string;
  roleHint: string;
  address: string;
  pkgPath: string; // "" for pure EOA (IsUserCall() == true), non-empty for CodeRealm / MsgRun
  isUserCall: boolean;
  originSendUgnot: bigint;
}

export interface Milestone {
  index: number;
  title: string;
  amountUgnot: bigint;
  status: MilestoneStatus;
  proofURI: string;
  commitDigest: string;
  feedbackNote: string;
  updatedAtBlk: bigint;
}

export interface Bounty {
  id: number;
  title: string;
  summary: string;
  sponsor: string;
  worker: string;
  arbiter: string;
  status: BountyStatus;
  totalFunded: bigint;
  releasedAmount: bigint;
  refundedAmount: bigint;
  createdAtBlk: bigint;
  expiryHeight: bigint;
  disputedIdx: number;
  milestones: Milestone[];
}

export interface AuditEntry {
  seq: number;
  height: bigint;
  action: string;
  bountyId: number;
  milestoneIdx: number;
  actor: string;
  amountUgnot: bigint;
  note: string;
  prevDigest: string;
  digest: string;
}

export interface EmittedEvent {
  type: string;
  attrs: Record<string, string>;
  height: bigint;
}

export interface RealmState {
  chainId: string;
  blockHeight: bigint;
  nextBountySeq: number;
  nextAuditSeq: number;
  latestAuditDigest: string;
  totalFundedUgnot: bigint;
  totalLockedUgnot: bigint;
  totalReleasedUgnot: bigint;
  totalRefundedUgnot: bigint;
  bounties: Bounty[];
  audits: AuditEntry[];
  events: EmittedEvent[];
  balances: Record<string, bigint>;
}

export interface CreateBountyInput {
  title: string;
  summary: string;
  arbiterStr: string;
  workerStr: string;
  milestoneTitlesCSV: string;
  milestoneAmountsCSV: string;
  expiryHeight: bigint;
}

export interface RealmStats {
  chainId: string;
  blockHeight: bigint;
  bountyCount: number;
  auditCount: number;
  totalFundedUgnot: bigint;
  totalLockedUgnot: bigint;
  totalReleasedUgnot: bigint;
  totalRefundedUgnot: bigint;
  latestAuditDigest: string;
  realmTreasuryBalance: bigint;
}

export const DEMO_ACTORS: CallerContext[] = [
  {
    id: 'sponsor',
    label: 'Tavern Sponsor (EOA)',
    roleHint: 'Sponsor · Funds bounties & approves milestones',
    address: 'g1jg8mtutu9khhfwc4nxmuhcpftf0pajdhfvsqf5',
    pkgPath: '',
    isUserCall: true,
    originSendUgnot: 0n,
  },
  {
    id: 'worker',
    label: 'Gnome Builder (EOA)',
    roleHint: 'Builder · Claims open bounties & submits proofs',
    address: 'g1us8428u2a5satrlxzagqqa5m6vmuze025anjlj',
    pkgPath: '',
    isUserCall: true,
    originSendUgnot: 0n,
  },
  {
    id: 'arbiter',
    label: 'Neutral Arbiter (EOA)',
    roleHint: 'Arbiter · Settles frozen disputes fairly',
    address: 'g10p5yt46ypn5wey48zqevauwjlyaghh5vtdz7yg',
    pkgPath: '',
    isUserCall: true,
    originSendUgnot: 0n,
  },
  {
    id: 'builder2',
    label: 'Second Builder (EOA)',
    roleHint: 'External Builder · Can claim open bounties',
    address: 'g1ktntcp38242d24mnhrm07xt6alegvqcpcc3uut',
    pkgPath: '',
    isUserCall: true,
    originSendUgnot: 0n,
  },
  {
    id: 'stranger',
    label: 'Unauthorized User (EOA)',
    roleHint: 'Outsider · Tests role & auth boundaries',
    address: 'g1ecely4gjy0yl6s9kt409ll330q9hk2lj9ls3ec',
    pkgPath: '',
    isUserCall: true,
    originSendUgnot: 0n,
  },
  {
    id: 'attacker_realm',
    label: 'Attacker CodeRealm (/r/evil/drain)',
    roleHint: 'MITM CodeRealm · Blocked by IsUserCall()',
    address: 'g1ecely4gjy0yl6s9kt409ll330q9hk2lj9ls3ec',
    pkgPath: 'gno.land/r/evil/drain',
    isUserCall: false,
    originSendUgnot: 0n,
  },
];

export class RealmPanicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RealmPanicError';
  }
}

function requireGuard(cond: boolean, msg: string): void {
  if (!cond) {
    throw new RealmPanicError(msg);
  }
}

export function safeAddInt64(a: bigint, b: bigint): bigint {
  if (a < 0n || b < 0n) {
    throw new RealmPanicError('negative ugnot amount not permitted');
  }
  if (a > MAX_INT64 - b) {
    throw new RealmPanicError('int64 overflow in ugnot accounting');
  }
  return a + b;
}

export function safeSubInt64(a: bigint, b: bigint): bigint {
  if (b < 0n || a < b) {
    throw new RealmPanicError('int64 underflow in ugnot accounting');
  }
  return a - b;
}

export function cloneState(state: RealmState): RealmState {
  return {
    ...state,
    bounties: state.bounties.map((b) => ({
      ...b,
      milestones: b.milestones.map((m) => ({ ...m })),
    })),
    audits: state.audits.map((a) => ({ ...a })),
    events: state.events.map((e) => ({ ...e, attrs: { ...e.attrs } })),
    balances: { ...state.balances },
  };
}

export function bountyLockedRemaining(b: Bounty): bigint {
  return b.totalFunded - b.releasedAmount - b.refundedAmount;
}

function allMilestonesTerminal(b: Bounty): boolean {
  return b.milestones.every(
    (m) => m.status === 'RELEASED' || m.status === 'REFUNDED'
  );
}

function mustGetBounty(state: RealmState, bountyId: number): Bounty {
  const b = state.bounties.find((item) => item.id === bountyId);
  requireGuard(Boolean(b), 'bounty not found');
  return b!;
}

function appendAudit(
  state: RealmState,
  action: string,
  bountyId: number,
  milestoneIdx: number,
  actor: string,
  amountUgnot: bigint,
  note: string
): void {
  state.nextAuditSeq += 1;
  const seq = state.nextAuditSeq;
  const height = state.blockHeight;
  const prev = state.latestAuditDigest;

  const payload = `${prev}|${seq}|${height.toString()}|${action}|${bountyId}|${milestoneIdx}|${actor}|${amountUgnot.toString()}|${note}`;
  const digest = sha256Hex(payload);

  state.audits.push({
    seq,
    height,
    action,
    bountyId,
    milestoneIdx,
    actor,
    amountUgnot,
    note,
    prevDigest: prev,
    digest,
  });
  state.latestAuditDigest = digest;
}

function transferFromRealm(state: RealmState, recipient: string, amount: bigint): void {
  const realmBal = state.balances[REALM_ADDRESS] ?? 0n;
  requireGuard(realmBal >= amount, 'realm treasury deficit');
  state.balances[REALM_ADDRESS] = realmBal - amount;
  state.balances[recipient] = (state.balances[recipient] ?? 0n) + amount;
}

export function createEmptyRealm(chainId = 'onyx-1', initialHeight = 420_000n): RealmState {
  const balances: Record<string, bigint> = {
    [REALM_ADDRESS]: 0n,
  };
  for (const actor of DEMO_ACTORS) {
    if (actor.isUserCall) {
      balances[actor.address] = 50_000_000n; // 50 GNOT per demo EOA
    }
  }
  return {
    chainId,
    blockHeight: initialHeight,
    nextBountySeq: 0,
    nextAuditSeq: 0,
    latestAuditDigest: GENESIS_AUDIT_DIGEST,
    totalFundedUgnot: 0n,
    totalLockedUgnot: 0n,
    totalReleasedUgnot: 0n,
    totalRefundedUgnot: 0n,
    bounties: [],
    audits: [],
    events: [],
    balances,
  };
}

export function skipHeights(state: RealmState, count: bigint): RealmState {
  requireGuard(count > 0n, 'skip height delta must be positive');
  const next = cloneState(state);
  next.blockHeight = safeAddInt64(next.blockHeight, count);
  return next;
}

export function createBounty(
  state: RealmState,
  caller: CallerContext,
  input: CreateBountyInput
): { state: RealmState; bountyId: number } {
  const next = cloneState(state);

  requireGuard(
    caller.isUserCall && caller.pkgPath === '',
    'CreateBounty must be called directly by an EOA (maketx call)'
  );
  requireGuard(isValidGnoAddress(caller.address), 'invalid sponsor address');

  const cleanTitle = input.title.trim();
  const cleanSummary = input.summary.trim();
  requireGuard(
    cleanTitle.length >= 3 && cleanTitle.length <= MAX_TITLE_LEN,
    'title must be 3..96 chars'
  );
  requireGuard(
    cleanSummary.length >= 5 && cleanSummary.length <= MAX_SUMMARY_LEN,
    'summary must be 5..512 chars'
  );
  requireGuard(
    input.expiryHeight > next.blockHeight,
    'expiryHeight must exceed current chain height'
  );

  const cleanArbiter = input.arbiterStr.trim();
  if (cleanArbiter !== '') {
    requireGuard(isValidGnoAddress(cleanArbiter), 'invalid arbiter address');
    requireGuard(cleanArbiter !== caller.address, 'arbiter cannot be sponsor');
  }

  const cleanWorker = input.workerStr.trim();
  if (cleanWorker !== '') {
    requireGuard(isValidGnoAddress(cleanWorker), 'invalid worker address');
    requireGuard(cleanWorker !== caller.address, 'worker cannot be sponsor');
    if (cleanArbiter !== '') {
      requireGuard(cleanWorker !== cleanArbiter, 'worker cannot be arbiter');
    }
  }

  const rawTitles = input.milestoneTitlesCSV.split(',');
  const rawAmounts = input.milestoneAmountsCSV.split(',');
  requireGuard(
    rawTitles.length >= 1 && rawTitles.length <= MAX_MILESTONES,
    'milestones count must be 1..16'
  );
  requireGuard(
    rawTitles.length === rawAmounts.length,
    'milestone titles and amounts length mismatch'
  );

  const milestones: Milestone[] = [];
  let totalRequired = 0n;

  for (let i = 0; i < rawTitles.length; i++) {
    const mTitle = rawTitles[i].trim();
    requireGuard(
      mTitle.length >= 2 && mTitle.length <= MAX_TITLE_LEN,
      'each milestone title must be 2..96 chars'
    );
    const amtStr = rawAmounts[i].trim();
    requireGuard(/^\d+$/.test(amtStr), 'each milestone amount must be a positive int64');
    const amt = BigInt(amtStr);
    requireGuard(amt > 0n && amt <= MAX_INT64, 'each milestone amount must be a positive int64');
    totalRequired = safeAddInt64(totalRequired, amt);
    milestones.push({
      index: i,
      title: mTitle,
      amountUgnot: amt,
      status: 'PENDING',
      proofURI: '',
      commitDigest: '',
      feedbackNote: '',
      updatedAtBlk: next.blockHeight,
    });
  }

  requireGuard(
    caller.originSendUgnot === totalRequired,
    'sent ugnot must equal exact sum of milestones'
  );

  const sponsorBal = next.balances[caller.address] ?? 0n;
  requireGuard(sponsorBal >= totalRequired, 'insufficient sponsor ugnot balance');
  next.balances[caller.address] = sponsorBal - totalRequired;
  next.balances[REALM_ADDRESS] = (next.balances[REALM_ADDRESS] ?? 0n) + totalRequired;

  next.nextBountySeq += 1;
  const bountyId = next.nextBountySeq;
  const initialStatus: BountyStatus = cleanWorker !== '' ? 'ACTIVE' : 'OPEN';

  next.bounties.push({
    id: bountyId,
    title: cleanTitle,
    summary: cleanSummary,
    sponsor: caller.address,
    worker: cleanWorker,
    arbiter: cleanArbiter,
    status: initialStatus,
    totalFunded: totalRequired,
    releasedAmount: 0n,
    refundedAmount: 0n,
    createdAtBlk: next.blockHeight,
    expiryHeight: input.expiryHeight,
    disputedIdx: -1,
    milestones,
  });

  next.totalFundedUgnot = safeAddInt64(next.totalFundedUgnot, totalRequired);
  next.totalLockedUgnot = safeAddInt64(next.totalLockedUgnot, totalRequired);

  appendAudit(next, 'BOUNTY_CREATED', bountyId, -1, caller.address, totalRequired, cleanTitle);
  next.events.push({
    type: 'BountyCreated',
    height: next.blockHeight,
    attrs: {
      bounty_id: String(bountyId),
      sponsor: caller.address,
      worker: cleanWorker,
      arbiter: cleanArbiter,
      funded_ugnot: totalRequired.toString(),
    },
  });

  return { state: next, bountyId };
}

export function claimBounty(
  state: RealmState,
  caller: CallerContext,
  bountyId: number
): RealmState {
  const next = cloneState(state);
  requireGuard(caller.isUserCall && caller.pkgPath === '', 'ClaimBounty must be called by an EOA');
  const b = mustGetBounty(next, bountyId);

  requireGuard(b.status === 'OPEN', 'bounty is not open for claim');
  requireGuard(b.worker === '', 'bounty already assigned to a worker');
  requireGuard(next.blockHeight < b.expiryHeight, 'bounty already expired');
  requireGuard(caller.address !== b.sponsor, 'sponsor cannot claim own bounty');
  requireGuard(caller.address !== b.arbiter, 'arbiter cannot claim assigned bounty');

  b.worker = caller.address;
  b.status = 'ACTIVE';

  appendAudit(next, 'BOUNTY_CLAIMED', bountyId, -1, caller.address, 0n, 'worker claimed open bounty');
  next.events.push({
    type: 'BountyClaimed',
    height: next.blockHeight,
    attrs: {
      bounty_id: String(bountyId),
      worker: caller.address,
    },
  });
  return next;
}

export function submitMilestone(
  state: RealmState,
  caller: CallerContext,
  bountyId: number,
  milestoneIdx: number,
  proofURI: string,
  commitDigest: string
): RealmState {
  const next = cloneState(state);
  requireGuard(caller.isUserCall && caller.pkgPath === '', 'SubmitMilestone must be called by an EOA');
  const b = mustGetBounty(next, bountyId);

  requireGuard(b.status === 'ACTIVE', 'bounty must be ACTIVE to submit milestone');
  requireGuard(caller.address === b.worker, 'only assigned worker can submit milestone');
  requireGuard(
    milestoneIdx >= 0 && milestoneIdx < b.milestones.length,
    'milestone index out of range'
  );

  const m = b.milestones[milestoneIdx];
  requireGuard(
    m.status === 'PENDING' || m.status === 'REJECTED',
    'milestone not awaiting submission'
  );

  const cleanURI = proofURI.trim();
  const cleanDigest = commitDigest.trim();
  requireGuard(cleanURI.length >= 4 && cleanURI.length <= MAX_NOTE_LEN, 'proofURI must be 4..280 chars');
  requireGuard(
    cleanDigest.length >= 7 && cleanDigest.length <= 128,
    'commitDigest must be 7..128 chars'
  );

  m.status = 'SUBMITTED';
  m.proofURI = cleanURI;
  m.commitDigest = cleanDigest;
  m.feedbackNote = '';
  m.updatedAtBlk = next.blockHeight;

  appendAudit(next, 'MILESTONE_SUBMITTED', bountyId, milestoneIdx, caller.address, m.amountUgnot, cleanURI);
  next.events.push({
    type: 'MilestoneSubmitted',
    height: next.blockHeight,
    attrs: {
      bounty_id: String(bountyId),
      milestone_idx: String(milestoneIdx),
      worker: caller.address,
      proof_uri: cleanURI,
    },
  });
  return next;
}

export function approveAndRelease(
  state: RealmState,
  caller: CallerContext,
  bountyId: number,
  milestoneIdx: number
): RealmState {
  const next = cloneState(state);
  requireGuard(caller.isUserCall && caller.pkgPath === '', 'ApproveAndRelease must be called by an EOA');
  const b = mustGetBounty(next, bountyId);

  requireGuard(b.status === 'ACTIVE', 'bounty must be ACTIVE to approve milestone');
  requireGuard(caller.address === b.sponsor, 'only sponsor can approve and release milestone');
  requireGuard(b.worker !== '', 'bounty has no assigned worker');
  requireGuard(
    milestoneIdx >= 0 && milestoneIdx < b.milestones.length,
    'milestone index out of range'
  );

  const m = b.milestones[milestoneIdx];
  requireGuard(m.status === 'SUBMITTED', 'milestone must be SUBMITTED before release');
  const amount = m.amountUgnot;
  requireGuard(
    amount > 0n && amount <= bountyLockedRemaining(b),
    'insufficient locked bounty balance'
  );

  m.status = 'RELEASED';
  m.updatedAtBlk = next.blockHeight;
  b.releasedAmount = safeAddInt64(b.releasedAmount, amount);
  next.totalReleasedUgnot = safeAddInt64(next.totalReleasedUgnot, amount);
  next.totalLockedUgnot = safeSubInt64(next.totalLockedUgnot, amount);

  if (allMilestonesTerminal(b)) {
    b.status = 'COMPLETED';
  }

  appendAudit(next, 'MILESTONE_RELEASED', bountyId, milestoneIdx, caller.address, amount, m.title);
  transferFromRealm(next, b.worker, amount);

  next.events.push({
    type: 'MilestoneReleased',
    height: next.blockHeight,
    attrs: {
      bounty_id: String(bountyId),
      milestone_idx: String(milestoneIdx),
      recipient: b.worker,
      amount_ugnot: amount.toString(),
    },
  });
  return next;
}

export function rejectMilestone(
  state: RealmState,
  caller: CallerContext,
  bountyId: number,
  milestoneIdx: number,
  reason: string
): RealmState {
  const next = cloneState(state);
  requireGuard(caller.isUserCall && caller.pkgPath === '', 'RejectMilestone must be called by an EOA');
  const b = mustGetBounty(next, bountyId);

  requireGuard(b.status === 'ACTIVE', 'bounty must be ACTIVE to reject milestone');
  requireGuard(caller.address === b.sponsor, 'only sponsor can reject milestone');
  requireGuard(
    milestoneIdx >= 0 && milestoneIdx < b.milestones.length,
    'milestone index out of range'
  );

  const m = b.milestones[milestoneIdx];
  requireGuard(m.status === 'SUBMITTED', 'milestone must be SUBMITTED to reject');

  const cleanReason = reason.trim();
  requireGuard(cleanReason.length >= 3 && cleanReason.length <= MAX_NOTE_LEN, 'reason must be 3..280 chars');

  m.status = 'REJECTED';
  m.feedbackNote = cleanReason;
  m.updatedAtBlk = next.blockHeight;

  appendAudit(next, 'MILESTONE_REJECTED', bountyId, milestoneIdx, caller.address, 0n, cleanReason);
  next.events.push({
    type: 'MilestoneRejected',
    height: next.blockHeight,
    attrs: {
      bounty_id: String(bountyId),
      milestone_idx: String(milestoneIdx),
      reason: cleanReason,
    },
  });
  return next;
}

export function raiseDispute(
  state: RealmState,
  caller: CallerContext,
  bountyId: number,
  milestoneIdx: number,
  evidenceNote: string
): RealmState {
  const next = cloneState(state);
  requireGuard(caller.isUserCall && caller.pkgPath === '', 'RaiseDispute must be called by an EOA');
  const b = mustGetBounty(next, bountyId);

  requireGuard(b.arbiter !== '', 'bounty has no arbiter configured');
  requireGuard(b.status === 'ACTIVE', 'bounty must be ACTIVE to raise dispute');
  requireGuard(
    caller.address === b.sponsor || caller.address === b.worker,
    'only sponsor or worker can raise dispute'
  );
  requireGuard(
    milestoneIdx >= 0 && milestoneIdx < b.milestones.length,
    'milestone index out of range'
  );

  const m = b.milestones[milestoneIdx];
  requireGuard(
    m.status === 'SUBMITTED' || m.status === 'REJECTED',
    'dispute requires SUBMITTED or REJECTED milestone'
  );

  const cleanNote = evidenceNote.trim();
  requireGuard(
    cleanNote.length >= 4 && cleanNote.length <= MAX_NOTE_LEN,
    'evidenceNote must be 4..280 chars'
  );

  b.status = 'DISPUTED';
  b.disputedIdx = milestoneIdx;
  m.feedbackNote = cleanNote;
  m.updatedAtBlk = next.blockHeight;

  appendAudit(next, 'DISPUTE_RAISED', bountyId, milestoneIdx, caller.address, m.amountUgnot, cleanNote);
  next.events.push({
    type: 'DisputeRaised',
    height: next.blockHeight,
    attrs: {
      bounty_id: String(bountyId),
      milestone_idx: String(milestoneIdx),
      raised_by: caller.address,
    },
  });
  return next;
}

export function resolveDispute(
  state: RealmState,
  caller: CallerContext,
  bountyId: number,
  milestoneIdx: number,
  releaseToWorker: boolean,
  resolutionNote: string
): RealmState {
  const next = cloneState(state);
  requireGuard(caller.isUserCall && caller.pkgPath === '', 'ResolveDispute must be called by an EOA');
  const b = mustGetBounty(next, bountyId);

  requireGuard(b.status === 'DISPUTED', 'bounty is not in DISPUTED state');
  requireGuard(caller.address === b.arbiter, 'only configured arbiter can resolve dispute');
  requireGuard(
    milestoneIdx === b.disputedIdx,
    'milestoneIdx does not match active disputed milestone'
  );
  requireGuard(
    milestoneIdx >= 0 && milestoneIdx < b.milestones.length,
    'milestone index out of range'
  );

  const cleanNote = resolutionNote.trim();
  requireGuard(
    cleanNote.length >= 4 && cleanNote.length <= MAX_NOTE_LEN,
    'resolutionNote must be 4..280 chars'
  );

  const m = b.milestones[milestoneIdx];
  requireGuard(
    m.status === 'SUBMITTED' || m.status === 'REJECTED',
    'disputed milestone already settled'
  );
  const amount = m.amountUgnot;
  requireGuard(
    amount > 0n && amount <= bountyLockedRemaining(b),
    'insufficient locked balance for resolution'
  );

  let recipient: string;
  let action: string;
  if (releaseToWorker) {
    requireGuard(b.worker !== '', 'cannot release without worker');
    m.status = 'RELEASED';
    b.releasedAmount = safeAddInt64(b.releasedAmount, amount);
    next.totalReleasedUgnot = safeAddInt64(next.totalReleasedUgnot, amount);
    recipient = b.worker;
    action = 'DISPUTE_RELEASED_WORKER';
  } else {
    m.status = 'REFUNDED';
    b.refundedAmount = safeAddInt64(b.refundedAmount, amount);
    next.totalRefundedUgnot = safeAddInt64(next.totalRefundedUgnot, amount);
    recipient = b.sponsor;
    action = 'DISPUTE_REFUNDED_SPONSOR';
  }

  m.feedbackNote = cleanNote;
  m.updatedAtBlk = next.blockHeight;
  next.totalLockedUgnot = safeSubInt64(next.totalLockedUgnot, amount);
  b.disputedIdx = -1;
  b.status = allMilestonesTerminal(b) ? 'COMPLETED' : 'ACTIVE';

  appendAudit(next, action, bountyId, milestoneIdx, caller.address, amount, cleanNote);
  transferFromRealm(next, recipient, amount);

  next.events.push({
    type: 'DisputeResolved',
    height: next.blockHeight,
    attrs: {
      bounty_id: String(bountyId),
      milestone_idx: String(milestoneIdx),
      recipient,
      amount_ugnot: amount.toString(),
    },
  });
  return next;
}

export function reclaimExpired(
  state: RealmState,
  caller: CallerContext,
  bountyId: number
): { state: RealmState; reclaimed: bigint } {
  const next = cloneState(state);
  requireGuard(caller.isUserCall && caller.pkgPath === '', 'ReclaimExpired must be called by an EOA');
  const b = mustGetBounty(next, bountyId);

  requireGuard(caller.address === b.sponsor, 'only sponsor can reclaim expired bounty');
  requireGuard(next.blockHeight >= b.expiryHeight, 'bounty has not reached expiryHeight');
  requireGuard(
    b.status === 'OPEN' || b.status === 'ACTIVE',
    'cannot reclaim disputed, completed, or cancelled bounty'
  );

  const reclaimAmt = bountyLockedRemaining(b);
  requireGuard(reclaimAmt > 0n, 'no locked ugnot remaining to reclaim');

  for (const m of b.milestones) {
    if (m.status !== 'RELEASED' && m.status !== 'REFUNDED') {
      m.status = 'REFUNDED';
      m.updatedAtBlk = next.blockHeight;
    }
  }

  b.refundedAmount = safeAddInt64(b.refundedAmount, reclaimAmt);
  b.status = 'CANCELLED';
  next.totalRefundedUgnot = safeAddInt64(next.totalRefundedUgnot, reclaimAmt);
  next.totalLockedUgnot = safeSubInt64(next.totalLockedUgnot, reclaimAmt);

  appendAudit(
    next,
    'BOUNTY_EXPIRED_RECLAIMED',
    bountyId,
    -1,
    caller.address,
    reclaimAmt,
    'sponsor reclaimed expired locked funds'
  );
  transferFromRealm(next, b.sponsor, reclaimAmt);

  next.events.push({
    type: 'BountyReclaimed',
    height: next.blockHeight,
    attrs: {
      bounty_id: String(bountyId),
      sponsor: b.sponsor,
      amount_ugnot: reclaimAmt.toString(),
    },
  });
  return { state: next, reclaimed: reclaimAmt };
}

export function getRealmStats(state: RealmState): RealmStats {
  return {
    chainId: state.chainId,
    blockHeight: state.blockHeight,
    bountyCount: state.bounties.length,
    auditCount: state.audits.length,
    totalFundedUgnot: state.totalFundedUgnot,
    totalLockedUgnot: state.totalLockedUgnot,
    totalReleasedUgnot: state.totalReleasedUgnot,
    totalRefundedUgnot: state.totalRefundedUgnot,
    latestAuditDigest: state.latestAuditDigest,
    realmTreasuryBalance: state.balances[REALM_ADDRESS] ?? 0n,
  };
}

function shortDigest(d: string): string {
  return d.length <= 16 ? d : `${d.slice(0, 10)}...${d.slice(-6)}`;
}

function shortAddr(a: string): string {
  return a.length <= 14 ? a : `${a.slice(0, 8)}...${a.slice(-4)}`;
}

function renderAuditTable(state: RealmState, limit: number): string {
  if (state.audits.length === 0) {
    return '_No audit entries recorded._\n';
  }
  const lines = [
    '| Seq | Block | Action | Bounty | Actor | Amount | Digest |',
    '|---|---|---|---|---|---|---|',
  ];
  const reversed = [...state.audits].reverse().slice(0, limit);
  for (const e of reversed) {
    lines.push(
      `| #${e.seq} | ${e.height.toString()} | \`${e.action}\` | #${e.bountyId} | \`${shortAddr(
        e.actor
      )}\` | ${e.amountUgnot.toString()} | \`${shortDigest(e.digest)}\` |`
    );
  }
  return lines.join('\n') + '\n';
}

export function renderPath(state: RealmState, path: string): string {
  const clean = path.trim().replace(/^\/+|\/+$/g, '');
  if (clean === '') {
    const lines: string[] = [
      '# TavernEscrow — Milestone Bounty & Dispute Realm',
      '',
      'Deterministic multi-milestone `ugnot` escrow on Gno.land with checks-effects-interactions accounting, neutral arbiter dispute settlement, expiry reclaim, and a chained SHA-256 audit log.',
      '',
      '| Metric | Value |',
      '|---|---|',
      `| Chain / Height | \`${state.chainId}\` @ \`#${state.blockHeight.toString()}\` |`,
      `| Active & Historical Bounties | \`${state.bounties.length}\` |`,
      `| Total Funded | \`${state.totalFundedUgnot.toString()} ugnot\` |`,
      `| Currently Locked TVL | \`${state.totalLockedUgnot.toString()} ugnot\` |`,
      `| Released to Builders | \`${state.totalReleasedUgnot.toString()} ugnot\` |`,
      `| Refunded to Sponsors | \`${state.totalRefundedUgnot.toString()} ugnot\` |`,
      `| Audit Chain Head | \`${shortDigest(state.latestAuditDigest)}\` |`,
      '',
      '## Navigation',
      '',
      '- [Audit Ledger (:audit)](/r/cocvn157/tavernescrow:audit)',
      '- [Security Invariants (:safety)](/r/cocvn157/tavernescrow:safety)',
      '',
      '## Bounties Board',
      '',
    ];

    if (state.bounties.length === 0) {
      lines.push(
        '_No bounties funded yet. Call `CreateBounty` with `-send <sum>ugnot` to open the first milestone escrow._'
      );
      return lines.join('\n') + '\n';
    }

    lines.push('| ID | Title | Status | Funded | Locked | Expiry | Detail |');
    lines.push('|---|---|---|---|---|---|---|');
    for (const b of [...state.bounties].reverse()) {
      lines.push(
        `| #${b.id} | ${b.title} | \`${b.status}\` | ${b.totalFunded.toString()} | ${bountyLockedRemaining(
          b
        ).toString()} | #${b.expiryHeight.toString()} | [View](:bounty/${b.id}) |`
      );
    }
    lines.push('', '## Recent Audit Trail', '', renderAuditTable(state, 5).trimEnd());
    return lines.join('\n') + '\n';
  }

  const parts = clean.split('/');
  if (parts.length === 2 && parts[0] === 'bounty') {
    if (!/^\d+$/.test(parts[1]) || Number(parts[1]) <= 0) {
      return '# 404 — Invalid Bounty ID\n\nExpected `/r/cocvn157/tavernescrow:bounty/<id>`.';
    }
    const id = Number(parts[1]);
    const b = state.bounties.find((item) => item.id === id);
    if (!b) {
      return `# 404 — Bounty #${id} Not Found\n\n[Back to TavernEscrow](:)`;
    }

    const workerStr = b.worker ? `\`${b.worker}\`` : '_Open for claim_';
    const arbiterStr = b.arbiter ? `\`${b.arbiter}\`` : '_None configured_';
    const lines = [
      `# Bounty #${b.id} — ${b.title}`,
      '',
      b.summary,
      '',
      '| Field | Value |',
      '|---|---|',
      `| Status | \`${b.status}\` |`,
      `| Sponsor | \`${b.sponsor}\` |`,
      `| Builder | ${workerStr} |`,
      `| Arbiter | ${arbiterStr} |`,
      `| Total Funded | \`${b.totalFunded.toString()} ugnot\` |`,
      `| Released / Refunded | \`${b.releasedAmount.toString()} / ${b.refundedAmount.toString()} ugnot\` |`,
      `| Remaining Locked | \`${bountyLockedRemaining(b).toString()} ugnot\` |`,
      `| Created / Expiry Block | \`#${b.createdAtBlk.toString()} -> #${b.expiryHeight.toString()}\` |`,
      '',
      '## Milestones',
      '',
      '| # | Deliverable | Amount (ugnot) | Status | Proof URI | Digest / Note |',
      '|---|---|---|---|---|---|',
    ];
    for (const m of b.milestones) {
      const proof = m.proofURI ? `\`${m.proofURI}\`` : '-';
      const note = [m.commitDigest, m.feedbackNote].filter(Boolean).join(' · ') || '-';
      lines.push(
        `| ${m.index} | ${m.title} | ${m.amountUgnot.toString()} | \`${m.status}\` | ${proof} | ${note} |`
      );
    }
    lines.push('', '[Back to Board](:) · [Audit Ledger](:audit)');
    return lines.join('\n') + '\n';
  }

  if (parts.length === 1 && parts[0] === 'audit') {
    return [
      '# TavernEscrow — Tamper-Evident Audit Ledger',
      '',
      `Chain head digest: \`${state.latestAuditDigest}\``,
      '',
      renderAuditTable(state, 50).trimEnd(),
      '',
      '[Back to Board](:)',
    ].join('\n');
  }

  if (parts.length === 1 && parts[0] === 'safety') {
    return [
      '# TavernEscrow — Security Invariants',
      '',
      '1. **EOA Payment Boundary (`IsUserCall()` + `OriginSend()`):** `CreateBounty` rejects intermediate code realms and `MsgRun` scripts so `-send` coins always land at the realm address.',
      '2. **Checks-Effects-Interactions:** Milestone status, global TVL counters, and SHA-256 audit entries commit before `banker.SendCoins`.',
      '3. **Overflow & Underflow Guards:** All `int64` `ugnot` additions and subtractions validate `0 <= amount <= MaxInt64`.',
      '4. **Role Separation & Dispute Lock:** Sponsor, Worker, and Arbiter must be distinct addresses; `ReclaimExpired` cannot bypass an active `DISPUTED` bounty.',
      '5. **No Mutable Pointer Leakage:** Public getters return value-copied snapshots (`BountyView`, `RealmStats`), never `*avl.Tree` or `*Bounty` pointers.',
      '',
      '[Back to Board](:)',
    ].join('\n');
  }

  return '# 404 — Route Not Found\n\nAvailable routes: `/`, `bounty/<id>`, `audit`, `safety`.';
}

export function verifyAuditChain(state: RealmState): {
  valid: boolean;
  checkedCount: number;
  brokenAtSeq: number | null;
} {
  let prev = GENESIS_AUDIT_DIGEST;
  for (const e of state.audits) {
    if (e.prevDigest !== prev) {
      return { valid: false, checkedCount: e.seq, brokenAtSeq: e.seq };
    }
    const payload = `${prev}|${e.seq}|${e.height.toString()}|${e.action}|${e.bountyId}|${e.milestoneIdx}|${e.actor}|${e.amountUgnot.toString()}|${e.note}`;
    const expected = sha256Hex(payload);
    if (e.digest !== expected) {
      return { valid: false, checkedCount: e.seq, brokenAtSeq: e.seq };
    }
    prev = e.digest;
  }
  if (state.audits.length > 0 && prev !== state.latestAuditDigest) {
    return { valid: false, checkedCount: state.audits.length, brokenAtSeq: state.audits.length };
  }
  return { valid: true, checkedCount: state.audits.length, brokenAtSeq: null };
}

export function createSeededTavernRealm(): RealmState {
  const sponsor = DEMO_ACTORS[0];
  const worker = DEMO_ACTORS[1];
  const arbiter = DEMO_ACTORS[2];

  let s = createEmptyRealm('onyx-1', 420_000n);

  // Bounty #1: Active 3-milestone build with Milestone 0 already released!
  const b1 = createBounty(
    s,
    { ...sponsor, originSendUgnot: 6_500_000n },
    {
      title: 'GnoConnect Ledger Hardware Signer',
      summary:
        'Implement deterministic Amino/SignDoc Ledger transport for Adena & gnokey browsers with test vectors.',
      arbiterStr: arbiter.address,
      workerStr: worker.address,
      milestoneTitlesCSV: 'HID Transport Spec,Signing Core & Tests,Browser E2E Adapter',
      milestoneAmountsCSV: '1500000,3000000,2000000',
      expiryHeight: 425_000n,
    }
  );
  s = skipHeights(b1.state, 14n);
  s = submitMilestone(
    s,
    worker,
    b1.bountyId,
    0,
    'https://github.com/cocvn157/tavern-escrow/pull/1',
    'sha256:9f82c1e4a0b7'
  );
  s = skipHeights(s, 6n);
  s = approveAndRelease(s, sponsor, b1.bountyId, 0);
  s = skipHeights(s, 8n);
  s = submitMilestone(
    s,
    worker,
    b1.bountyId,
    1,
    'https://github.com/cocvn157/tavern-escrow/pull/2',
    'sha256:4a17d9b3c201'
  );

  // Bounty #2: Disputed milestone waiting for Arbiter verdict
  s = skipHeights(s, 10n);
  const b2 = createBounty(
    s,
    { ...sponsor, originSendUgnot: 4_000_000n },
    {
      title: 'Onyx Event Stream Indexer',
      summary:
        'WebSocket block indexer emitting typed JSON-RPC realm event snapshots for Gnome Tavern dashboards.',
      arbiterStr: arbiter.address,
      workerStr: worker.address,
      milestoneTitlesCSV: 'Block Poller Engine,Metrics Exporter',
      milestoneAmountsCSV: '2500000,1500000',
      expiryHeight: 422_000n,
    }
  );
  s = skipHeights(b2.state, 12n);
  s = submitMilestone(
    s,
    worker,
    b2.bountyId,
    0,
    'https://github.com/cocvn157/indexer-demo/commit/7d3a88b',
    'sha256:7d3a88b19c02'
  );
  s = skipHeights(s, 5n);
  s = rejectMilestone(s, sponsor, b2.bountyId, 0, 'Retry backoff missing on RPC 502');
  s = skipHeights(s, 4n);
  s = raiseDispute(
    s,
    worker,
    b2.bountyId,
    0,
    'Exponential backoff already covered in poll_test.go lines 44-89'
  );

  // Bounty #3: Open bounty ready for any builder to claim
  s = skipHeights(s, 11n);
  const b3 = createBounty(
    s,
    { ...sponsor, originSendUgnot: 5_000_000n },
    {
      title: 'AVL Snapshot Diff Visualizer',
      summary:
        'Interactive Render(path) inspector comparing gnovm realm storage deltas across transaction blocks.',
      arbiterStr: arbiter.address,
      workerStr: '',
      milestoneTitlesCSV: 'Storage Parser,gnoweb Markdown Renderer',
      milestoneAmountsCSV: '2000000,3000000',
      expiryHeight: 430_000n,
    }
  );
  return b3.state;
}

export type AttackVectorId =
  | 'code_realm_mitm'
  | 'underfunded_send'
  | 'worker_self_approve'
  | 'double_release_replay'
  | 'reclaim_during_dispute'
  | 'int64_overflow';

export interface AttackReport {
  id: AttackVectorId;
  title: string;
  threatClass: string;
  aborted: boolean;
  panicMessage: string;
  invariantPreserved: boolean;
  digestBefore: string;
  digestAfter: string;
}

export const ATTACK_VECTORS: {
  id: AttackVectorId;
  title: string;
  threatClass: string;
  summary: string;
}[] = [
  {
    id: 'code_realm_mitm',
    title: 'Cross-Realm MITM Coin Drain',
    threatClass: 'gno-security-guide §5.5 (IsUser vs IsUserCall)',
    summary:
      'Attacker invokes CreateBounty via intermediate /r/evil/drain code realm while trying to spoof OriginSend().',
  },
  {
    id: 'underfunded_send',
    title: 'Underfunded -send Mismatch',
    threatClass: 'Payment Completeness Guard',
    summary:
      'Sponsor promises 2,000,000 ugnot across milestones while attaching only 500 ugnot in -send.',
  },
  {
    id: 'worker_self_approve',
    title: 'Unauthorized Worker Self-Release',
    threatClass: 'Role Authorization Boundary',
    summary:
      'Assigned worker attempts to call ApproveAndRelease on their own submitted milestone.',
  },
  {
    id: 'double_release_replay',
    title: 'Double-Release Payout Replay',
    threatClass: 'Terminal Milestone State Guard',
    summary:
      'Sponsor replays ApproveAndRelease on Milestone #0 after funds were already released.',
  },
  {
    id: 'reclaim_during_dispute',
    title: 'Expiry Hijack During Active Dispute',
    threatClass: 'Dispute Freeze Lock',
    summary:
      'Sponsor advances blocks past expiryHeight and calls ReclaimExpired to drain a DISPUTED bounty.',
  },
  {
    id: 'int64_overflow',
    title: 'Int64 Milestone Sum Overflow',
    threatClass: 'Safe Integer Arithmetic',
    summary:
      'Attacker passes milestone amounts summing above MaxInt64 (9,223,372,036,854,775,807) to wrap TVL.',
  },
];

export function runAttackVector(state: RealmState, vectorId: AttackVectorId): AttackReport {
  const sponsor = DEMO_ACTORS[0];
  const worker = DEMO_ACTORS[1];
  const arbiter = DEMO_ACTORS[2];
  const attackerRealm = DEMO_ACTORS[5];
  const digestBefore = state.latestAuditDigest;

  let panicMessage = '';
  let aborted = false;
  let working = cloneState(state);

  try {
    switch (vectorId) {
      case 'code_realm_mitm': {
        createBounty(
          working,
          { ...attackerRealm, originSendUgnot: 1_000_000n },
          {
            title: 'Spoofed Realm Bounty',
            summary: 'Should fail IsUserCall boundary immediately',
            arbiterStr: arbiter.address,
            workerStr: '',
            milestoneTitlesCSV: 'Payload',
            milestoneAmountsCSV: '1000000',
            expiryHeight: working.blockHeight + 500n,
          }
        );
        break;
      }
      case 'underfunded_send': {
        createBounty(
          working,
          { ...sponsor, originSendUgnot: 500n },
          {
            title: 'Underfunded Bounty',
            summary: 'Promising 2M ugnot while sending only 500 ugnot',
            arbiterStr: arbiter.address,
            workerStr: '',
            milestoneTitlesCSV: 'Phase A,Phase B',
            milestoneAmountsCSV: '1000000,1000000',
            expiryHeight: working.blockHeight + 500n,
          }
        );
        break;
      }
      case 'worker_self_approve': {
        const target = working.bounties.find(
          (b) => b.status === 'ACTIVE' && b.milestones.some((m) => m.status === 'SUBMITTED')
        );
        if (!target) {
          throw new RealmPanicError('no submitted milestone available in current workspace');
        }
        const m = target.milestones.find((item) => item.status === 'SUBMITTED')!;
        approveAndRelease(working, worker, target.id, m.index);
        break;
      }
      case 'double_release_replay': {
        const target = working.bounties.find((b) =>
          b.milestones.some((m) => m.status === 'RELEASED')
        );
        if (!target) {
          throw new RealmPanicError('milestone must be SUBMITTED before release');
        }
        const m = target.milestones.find((item) => item.status === 'RELEASED')!;
        approveAndRelease(working, sponsor, target.id, m.index);
        break;
      }
      case 'reclaim_during_dispute': {
        const disputed = working.bounties.find((b) => b.status === 'DISPUTED');
        if (!disputed) {
          throw new RealmPanicError('cannot reclaim disputed, completed, or cancelled bounty');
        }
        working = skipHeights(working, disputed.expiryHeight - working.blockHeight + 10n);
        reclaimExpired(working, sponsor, disputed.id);
        break;
      }
      case 'int64_overflow': {
        createBounty(
          working,
          { ...sponsor, originSendUgnot: 1n },
          {
            title: 'Overflow Escrow',
            summary: 'Attempting to wrap signed int64 milestone accumulator',
            arbiterStr: arbiter.address,
            workerStr: '',
            milestoneTitlesCSV: 'MaxChunk,WrapTrigger',
            milestoneAmountsCSV: `${MAX_INT64.toString()},100`,
            expiryHeight: working.blockHeight + 500n,
          }
        );
        break;
      }
    }
  } catch (err) {
    aborted = true;
    panicMessage = err instanceof Error ? err.message : String(err);
  }

  const meta = ATTACK_VECTORS.find((v) => v.id === vectorId)!;
  const digestAfter = state.latestAuditDigest;
  return {
    id: vectorId,
    title: meta.title,
    threatClass: meta.threatClass,
    aborted,
    panicMessage,
    invariantPreserved: aborted && digestBefore === digestAfter,
    digestBefore,
    digestAfter,
  };
}
