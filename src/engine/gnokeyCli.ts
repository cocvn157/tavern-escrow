import { RealmState, getRealmStats, verifyAuditChain } from './tavernRealm';

export type GnoNetworkKey = 'onyx-1' | 'latest' | 'gnoland-1';

export interface GnoNetworkProfile {
  key: GnoNetworkKey;
  label: string;
  chainId: string;
  rpcEndpoint: string;
  gnowebBase: string;
  hasFaucet: boolean;
}

export const GNO_NETWORKS: Record<GnoNetworkKey, GnoNetworkProfile> = {
  'onyx-1': {
    key: 'onyx-1',
    label: 'Onyx Testnet (Test17)',
    chainId: 'onyx-1',
    rpcEndpoint: 'https://rpc.onyx.testnets.gno.land:443',
    gnowebBase: 'https://onyx.testnets.gno.land',
    hasFaucet: true,
  },
  latest: {
    key: 'latest',
    label: 'Latest Testnet Alias',
    chainId: 'onyx-1',
    rpcEndpoint: 'https://rpc.latest.testnets.gno.land:443',
    gnowebBase: 'https://onyx.testnets.gno.land',
    hasFaucet: true,
  },
  'gnoland-1': {
    key: 'gnoland-1',
    label: 'Gno.land Mainnet',
    chainId: 'gnoland-1',
    rpcEndpoint: 'https://rpc.gno.land:443',
    gnowebBase: 'https://gno.land',
    hasFaucet: false,
  },
};

export interface CliConfig {
  network: GnoNetworkKey;
  namespace: string;
  keyName: string;
  gasFee: string;
  gasWanted: string;
}

export function buildPkgPath(namespace: string): string {
  const cleanNs = namespace.trim().replace(/^\/+|\/+$/g, '') || 'cocvn157';
  return `gno.land/r/${cleanNs}/tavernescrow`;
}

export function buildGnowebUrl(network: GnoNetworkKey, namespace: string, route = ''): string {
  const net = GNO_NETWORKS[network];
  const pkgPath = buildPkgPath(namespace).replace(/^gno\.land/, '');
  const cleanRoute = route.trim().replace(/^\/+/, '');
  return cleanRoute ? `${net.gnowebBase}${pkgPath}:${cleanRoute}` : `${net.gnowebBase}${pkgPath}`;
}

export function buildAddPkgCommand(cfg: CliConfig): string {
  const net = GNO_NETWORKS[cfg.network];
  const pkgPath = buildPkgPath(cfg.namespace);
  const key = cfg.keyName.trim() || 'mykey';
  return [
    'gnokey maketx addpkg \\',
    `  -pkgpath "${pkgPath}" \\`,
    '  -pkgdir "./gno/r/cocvn157/tavernescrow" \\',
    '  -max-deposit "50000000ugnot" \\',
    `  -gas-fee ${cfg.gasFee.trim() || '100000ugnot'} \\`,
    `  -gas-wanted ${cfg.gasWanted.trim() || '8000000'} \\`,
    `  -chainid ${net.chainId} \\`,
    `  -remote "${net.rpcEndpoint}" \\`,
    `  ${key}`,
  ].join('\n');
}

export function buildCallCommand(
  cfg: CliConfig,
  funcName: string,
  args: string[],
  sendUgnot?: bigint
): string {
  const net = GNO_NETWORKS[cfg.network];
  const pkgPath = buildPkgPath(cfg.namespace);
  const key = cfg.keyName.trim() || 'mykey';
  const lines = [
    'gnokey maketx call \\',
    `  -pkgpath "${pkgPath}" \\`,
    `  -func "${funcName}" \\`,
  ];
  for (const arg of args) {
    lines.push(`  -args "${arg.replace(/"/g, '\\"')}" \\`);
  }
  if (sendUgnot && sendUgnot > 0n) {
    lines.push(`  -send "${sendUgnot.toString()}ugnot" \\`);
  }
  lines.push(
    `  -gas-fee ${cfg.gasFee.trim() || '25000ugnot'} \\`,
    `  -gas-wanted ${cfg.gasWanted.trim() || '4000000'} \\`,
    `  -chainid ${net.chainId} \\`,
    `  -remote "${net.rpcEndpoint}" \\`,
    `  ${key}`
  );
  return lines.join('\n');
}

export function buildQueryRenderCommand(cfg: CliConfig, route = ''): string {
  const net = GNO_NETWORKS[cfg.network];
  const pkgPath = buildPkgPath(cfg.namespace);
  return [
    'gnokey query vm/qrender \\',
    `  -data "${pkgPath}:${route}" \\`,
    `  -remote "${net.rpcEndpoint}"`,
  ].join('\n');
}

export function exportAuditProofJson(state: RealmState, cfg: CliConfig): string {
  const stats = getRealmStats(state);
  const verification = verifyAuditChain(state);
  const net = GNO_NETWORKS[cfg.network];

  const payload = {
    schema: 'tavern-escrow.audit-proof.v1',
    generatedAt: new Date().toISOString(),
    network: {
      chainId: net.chainId,
      rpcEndpoint: net.rpcEndpoint,
      pkgPath: buildPkgPath(cfg.namespace),
      gnowebUrl: buildGnowebUrl(cfg.network, cfg.namespace),
    },
    accounting: {
      blockHeight: stats.blockHeight.toString(),
      bountyCount: stats.bountyCount,
      auditCount: stats.auditCount,
      totalFundedUgnot: stats.totalFundedUgnot.toString(),
      totalLockedUgnot: stats.totalLockedUgnot.toString(),
      totalReleasedUgnot: stats.totalReleasedUgnot.toString(),
      totalRefundedUgnot: stats.totalRefundedUgnot.toString(),
      realmTreasuryBalance: stats.realmTreasuryBalance.toString(),
      latestAuditDigest: stats.latestAuditDigest,
    },
    integrity: verification,
    bounties: state.bounties.map((b) => ({
      ...b,
      totalFunded: b.totalFunded.toString(),
      releasedAmount: b.releasedAmount.toString(),
      refundedAmount: b.refundedAmount.toString(),
      createdAtBlk: b.createdAtBlk.toString(),
      expiryHeight: b.expiryHeight.toString(),
      milestones: b.milestones.map((m) => ({
        ...m,
        amountUgnot: m.amountUgnot.toString(),
        updatedAtBlk: m.updatedAtBlk.toString(),
      })),
    })),
    audits: state.audits.map((a) => ({
      ...a,
      height: a.height.toString(),
      amountUgnot: a.amountUgnot.toString(),
    })),
  };

  return JSON.stringify(payload, null, 2);
}
