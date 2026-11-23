import React, { useState } from 'react';
import { Check, Copy, Download, FileCode2, Terminal } from 'lucide-react';
import {
  CliConfig,
  GNO_NETWORKS,
  GnoNetworkKey,
  buildAddPkgCommand,
  buildCallCommand,
  buildGnowebUrl,
  buildQueryRenderCommand,
  exportAuditProofJson,
} from '../engine/gnokeyCli';
import { GNO_SOURCE_FILES } from '../engine/gnoSources';
import { Bounty, RealmState } from '../engine/tavernRealm';

interface DeployAuditHubProps {
  state: RealmState;
  selectedBounty?: Bounty;
}

export const DeployAuditHub: React.FC<DeployAuditHubProps> = ({ state, selectedBounty }) => {
  const [network, setNetwork] = useState<GnoNetworkKey>('onyx-1');
  const [namespace, setNamespace] = useState('cocvn157');
  const [keyName, setKeyName] = useState('mykey');
  const [gasFee, setGasFee] = useState('100000ugnot');
  const [gasWanted, setGasWanted] = useState('8000000');
  const [selectedSource, setSelectedSource] = useState(GNO_SOURCE_FILES[2].filename);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const cfg: CliConfig = { network, namespace, keyName, gasFee, gasWanted };
  const addPkgCmd = buildAddPkgCommand(cfg);
  const callCmd = selectedBounty
    ? buildCallCommand(cfg, 'ApproveAndRelease', [String(selectedBounty.id), '0'])
    : buildCallCommand(
        cfg,
        'CreateBounty',
        [
          'Demo Bounty',
          'Milestone escrow verification',
          'g10p5yt46ypn5wey48zqevauwjlyaghh5vtdz7yg',
          '',
          'Spec,Build',
          '1000000,2000000',
          '430000',
        ],
        3_000_000n
      );
  const queryCmd = buildQueryRenderCommand(
    cfg,
    selectedBounty ? `bounty/${selectedBounty.id}` : ''
  );

  const activeSourceFile =
    GNO_SOURCE_FILES.find((f) => f.filename === selectedSource) ?? GNO_SOURCE_FILES[0];

  const copyText = (id: string, text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1600);
  };

  const downloadProof = () => {
    const json = exportAuditProofJson(state, cfg);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tavern-escrow-audit-${cfg.network}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* gnokey CLI Config */}
      <div className="panel">
        <div className="panel-header">
          <div>
            <h3 className="panel-title">
              <Terminal size={17} color="var(--amber-400)" />
              `gnokey` Deployment &amp; Transaction Generator
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
              Targets live Gno.land networks (`onyx-1` / `gnoland-1`). On permissionless testnets,
              use your `g1...` wallet address as namespace if you do not hold a registered handle.
            </p>
          </div>
          <button type="button" className="btn btn-emerald" onClick={downloadProof}>
            <Download size={15} />
            Export JSON Audit Proof
          </button>
        </div>

        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div>
            <label htmlFor="cli-network" className="field-label">
              Target Network
            </label>
            <select
              id="cli-network"
              className="select"
              style={{ width: '100%' }}
              value={network}
              onChange={(e) => setNetwork(e.target.value as GnoNetworkKey)}
            >
              {Object.values(GNO_NETWORKS).map((n) => (
                <option key={n.key} value={n.key}>
                  {n.label} ({n.chainId})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="cli-namespace" className="field-label">
              Namespace (`g1...` address or handle)
            </label>
            <input
              id="cli-namespace"
              className="input mono"
              style={{ width: '100%' }}
              value={namespace}
              onChange={(e) => setNamespace(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cli-key" className="field-label">
              `gnokey` Key Name
            </label>
            <input
              id="cli-key"
              className="input mono"
              style={{ width: '100%' }}
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cli-gas" className="field-label">
              Gas Fee &amp; Wanted
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="cli-gas"
                aria-label="Gas fee"
                className="input mono"
                style={{ flex: 1 }}
                value={gasFee}
                onChange={(e) => setGasFee(e.target.value)}
              />
              <input
                aria-label="Gas wanted"
                className="input mono"
                style={{ flex: 1 }}
                value={gasWanted}
                onChange={(e) => setGasWanted(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div style={{ fontSize: '0.8rem', marginBottom: 14, color: 'var(--text-secondary)' }}>
          Target `gnoweb` URL:{' '}
          <code className="mono" style={{ color: 'var(--sky-400)' }}>
            {buildGnowebUrl(network, namespace)}
          </code>
        </div>

        <div className="attack-grid">
          <div>
            <div className="panel-header" style={{ marginBottom: 6 }}>
              <span className="field-label" style={{ marginBottom: 0 }}>
                1. Deploy Realm (`maketx addpkg`)
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => copyText('addpkg', addPkgCmd)}
              >
                {copiedId === 'addpkg' ? <Check size={13} /> : <Copy size={13} />}
                {copiedId === 'addpkg' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="code-block">{addPkgCmd}</pre>
          </div>

          <div>
            <div className="panel-header" style={{ marginBottom: 6 }}>
              <span className="field-label" style={{ marginBottom: 0 }}>
                2. Invoke Selected Bounty (`maketx call`)
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => copyText('call', callCmd)}
              >
                {copiedId === 'call' ? <Check size={13} /> : <Copy size={13} />}
                {copiedId === 'call' ? 'Copied' : 'Copy'}
              </button>
            </div>
            <pre className="code-block">{callCmd}</pre>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="panel-header" style={{ marginBottom: 6 }}>
            <span className="field-label" style={{ marginBottom: 0 }}>
              3. Read-Only `vm/qrender` Query (Zero Gas)
            </span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => copyText('query', queryCmd)}
            >
              {copiedId === 'query' ? <Check size={13} /> : <Copy size={13} />}
              {copiedId === 'query' ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="code-block">{queryCmd}</pre>
        </div>
      </div>

      {/* Gno Realm Source Inspector */}
      <div className="panel">
        <div className="panel-header">
          <h3 className="panel-title">
            <FileCode2 size={17} color="var(--sky-400)" />
            Gno Realm Source Inspector (`gno/r/cocvn157/tavernescrow`)
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {GNO_SOURCE_FILES.map((file) => (
              <button
                key={file.filename}
                type="button"
                className={`btn btn-sm ${selectedSource === file.filename ? 'btn-primary' : ''}`}
                onClick={() => setSelectedSource(file.filename)}
              >
                {file.filename}
              </button>
            ))}
          </div>
        </div>
        <p style={{ margin: '0 0 10px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          {activeSourceFile.summary}
        </p>
        <pre className="code-block" style={{ maxHeight: 420 }}>
          {activeSourceFile.content}
        </pre>
      </div>
    </div>
  );
};
