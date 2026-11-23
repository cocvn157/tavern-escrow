import React from 'react';

interface MarkdownRendererProps {
  markdown: string;
  onNavigateRoute: (route: string) => void;
}

function renderInline(
  text: string,
  onNavigateRoute: (route: string) => void
): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  const pattern = /(\[[^\]]+\]\([^)]+\)|`[^`]+`|\*\*[^*]+\*\*|_[^_]+_)/g;
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push(text.slice(lastIdx, match.index));
    }
    const token = match[0];
    if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        const normalized = href
          .replace(/^\/r\/[^:]+:?/, '')
          .replace(/^:/, '')
          .replace(/^\/+/, '');
        tokens.push(
          <button
            key={key++}
            type="button"
            className="gnoweb-link"
            onClick={() => onNavigateRoute(normalized)}
          >
            {label}
          </button>
        );
      }
    } else if (token.startsWith('`')) {
      tokens.push(<code key={key++}>{token.slice(1, -1)}</code>);
    } else if (token.startsWith('**')) {
      tokens.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith('_')) {
      tokens.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    lastIdx = pattern.lastIndex;
  }

  if (lastIdx < text.length) {
    tokens.push(text.slice(lastIdx));
  }
  return tokens;
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  markdown,
  onNavigateRoute,
}) => {
  const lines = markdown.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i].trimEnd();

    if (line.trim() === '') {
      i++;
      continue;
    }

    if (line.startsWith('# ')) {
      blocks.push(
        <h1 key={blockKey++}>{renderInline(line.slice(2), onNavigateRoute)}</h1>
      );
      i++;
      continue;
    }

    if (line.startsWith('## ')) {
      blocks.push(
        <h2 key={blockKey++}>{renderInline(line.slice(3), onNavigateRoute)}</h2>
      );
      i++;
      continue;
    }

    if (line.trim().startsWith('|') && i + 1 < lines.length && lines[i + 1].includes('---')) {
      const headers = parseTableRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(parseTableRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={blockKey++} className="gnoweb-table-wrap">
          <table className="gnoweb-table">
            <thead>
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx}>{renderInline(h, onNavigateRoute)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rIdx) => (
                <tr key={rIdx}>
                  {row.map((cell, cIdx) => (
                    <td key={cIdx}>{renderInline(cell, onNavigateRoute)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (line.startsWith('- ') || /^\d+\.\s/.test(line)) {
      const items: string[] = [];
      const isOrdered = /^\d+\.\s/.test(line);
      while (
        i < lines.length &&
        (isOrdered ? /^\d+\.\s/.test(lines[i]) : lines[i].startsWith('- '))
      ) {
        items.push(lines[i].replace(/^(-|\d+\.)\s+/, ''));
        i++;
      }
      const ListTag = isOrdered ? 'ol' : 'ul';
      blocks.push(
        <ListTag key={blockKey++} className="gnoweb-list">
          {items.map((item, idx) => (
            <li key={idx}>{renderInline(item, onNavigateRoute)}</li>
          ))}
        </ListTag>
      );
      continue;
    }

    blocks.push(
      <p key={blockKey++}>{renderInline(line, onNavigateRoute)}</p>
    );
    i++;
  }

  return <div className="gnoweb-markdown">{blocks}</div>;
};
