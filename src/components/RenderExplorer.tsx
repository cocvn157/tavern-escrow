import React, { useState } from 'react';
import { Code2, Eye, Globe } from 'lucide-react';
import { RealmState, renderPath } from '../engine/tavernRealm';
import { MarkdownRenderer } from './MarkdownRenderer';

interface RenderExplorerProps {
  state: RealmState;
  route: string;
  onChangeRoute: (route: string) => void;
}

export const RenderExplorer: React.FC<RenderExplorerProps> = ({
  state,
  route,
  onChangeRoute,
}) => {
  const [rawMode, setRawMode] = useState(false);
  const markdown = renderPath(state, route);

  const quickRoutes = [
    { label: '/', value: '' },
    ...state.bounties.map((b) => ({ label: `bounty/${b.id}`, value: `bounty/${b.id}` })),
    { label: 'audit', value: 'audit' },
    { label: 'safety', value: 'safety' },
  ];

  return (
    <div className="gnoweb-browser">
      <div className="gnoweb-toolbar">
        <span className="pill pill-amber">
          <Globe size={13} />
          gnoweb Render(path)
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1 }}>
          {quickRoutes.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`btn btn-sm ${route === item.value ? 'btn-primary' : ''}`}
              onClick={() => onChangeRoute(item.value)}
            >
              :{item.label}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            aria-label="Render path"
            className="input mono"
            style={{ width: 150 }}
            value={route}
            placeholder="bounty/1"
            onChange={(e) => onChangeRoute(e.target.value)}
          />
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setRawMode((v) => !v)}
          >
            {rawMode ? <Eye size={14} /> : <Code2 size={14} />}
            {rawMode ? 'Rendered' : 'Raw Markdown'}
          </button>
        </div>
      </div>

      {rawMode ? (
        <div style={{ padding: 16 }}>
          <pre className="code-block">{markdown}</pre>
        </div>
      ) : (
        <MarkdownRenderer markdown={markdown} onNavigateRoute={onChangeRoute} />
      )}
    </div>
  );
};
