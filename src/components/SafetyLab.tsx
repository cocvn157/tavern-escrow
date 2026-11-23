import React, { useState } from 'react';
import { CheckCircle, Play, ShieldCheck, ShieldX } from 'lucide-react';
import {
  ATTACK_VECTORS,
  AttackReport,
  AttackVectorId,
  RealmState,
  runAttackVector,
} from '../engine/tavernRealm';

interface SafetyLabProps {
  state: RealmState;
}

export const SafetyLab: React.FC<SafetyLabProps> = ({ state }) => {
  const [reports, setReports] = useState<Record<string, AttackReport>>({});

  const executeVector = (id: AttackVectorId) => {
    const res = runAttackVector(state, id);
    setReports((prev) => ({ ...prev, [id]: res }));
  };

  const executeAll = () => {
    const next: Record<string, AttackReport> = {};
    for (const v of ATTACK_VECTORS) {
      next[v.id] = runAttackVector(state, v.id);
    }
    setReports(next);
  };

  const completedCount = Object.keys(reports).length;
  const passedCount = Object.values(reports).filter((r) => r.invariantPreserved).length;

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header">
          <div>
            <h3 className="panel-title">
              <ShieldCheck size={17} color="var(--emerald-400)" />
              Adversarial Safety Lab (Live Gno Invariant Probing)
            </h3>
            <p style={{ margin: '5px 0 0', fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
              Runs real malicious calls against a cloned snapshot of your active realm state and
              verifies deterministic panic abort + unchanged SHA-256 ledger digest.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {completedCount > 0 && (
              <span className="pill pill-emerald">
                {passedCount}/{completedCount} Invariants Held
              </span>
            )}
            <button type="button" className="btn btn-primary" onClick={executeAll}>
              <Play size={15} />
              Run All 6 Threat Vectors
            </button>
          </div>
        </div>
      </div>

      <div className="attack-grid">
        {ATTACK_VECTORS.map((vec) => {
          const rep = reports[vec.id];
          return (
            <div key={vec.id} className="panel">
              <div className="panel-header">
                <span className="pill pill-violet">{vec.threatClass}</span>
                <button
                  type="button"
                  className="btn btn-sm btn-danger"
                  onClick={() => executeVector(vec.id)}
                >
                  <Play size={13} />
                  Simulate Attack
                </button>
              </div>
              <h4 style={{ margin: '0 0 6px', fontSize: '0.96rem' }}>{vec.title}</h4>
              <p style={{ margin: '0 0 12px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {vec.summary}
              </p>

              {rep && (
                <div
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: rep.invariantPreserved
                      ? 'rgba(16, 185, 129, 0.1)'
                      : 'rgba(239, 68, 68, 0.12)',
                    border: rep.invariantPreserved
                      ? '1px solid rgba(16, 185, 129, 0.35)'
                      : '1px solid rgba(239, 68, 68, 0.4)',
                    fontSize: '0.78rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                    {rep.invariantPreserved ? (
                      <>
                        <CheckCircle size={14} color="var(--emerald-400)" />
                        <span style={{ color: 'var(--emerald-400)' }}>
                          ABORTED SAFELY · STATE INVARIANT HELD
                        </span>
                      </>
                    ) : (
                      <>
                        <ShieldX size={14} color="var(--red-400)" />
                        <span style={{ color: 'var(--red-400)' }}>VULNERABILITY DETECTED</span>
                      </>
                    )}
                  </div>
                  <div className="mono" style={{ marginTop: 6, color: 'var(--text-primary)' }}>
                    panic(&quot;{rep.panicMessage}&quot;)
                  </div>
                  <div className="mono" style={{ marginTop: 4, color: 'var(--text-muted)' }}>
                    Audit Head Unchanged: {rep.digestBefore.slice(0, 12)}... ==={' '}
                    {rep.digestAfter.slice(0, 12)}...
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
