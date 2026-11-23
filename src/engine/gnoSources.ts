// Raw source snapshots of the Gno realm package for zero-friction inspection in the UI.
import gnomodToml from '../../gno/r/cocvn157/tavernescrow/gnomod.toml?raw';
import typesGno from '../../gno/r/cocvn157/tavernescrow/types.gno?raw';
import escrowGno from '../../gno/r/cocvn157/tavernescrow/escrow.gno?raw';
import renderGno from '../../gno/r/cocvn157/tavernescrow/render.gno?raw';
import escrowTestGno from '../../gno/r/cocvn157/tavernescrow/escrow_test.gno?raw';

export interface GnoSourceFile {
  filename: string;
  summary: string;
  content: string;
}

export const GNO_SOURCE_FILES: GnoSourceFile[] = [
  {
    filename: 'gnomod.toml',
    summary: 'Gno v0.9 package module descriptor',
    content: gnomodToml,
  },
  {
    filename: 'types.gno',
    summary: 'Value snapshots, status enums, overflow-safe int64 math',
    content: typesGno,
  },
  {
    filename: 'escrow.gno',
    summary: 'Crossing entrypoints, EOA IsUserCall guards, banker payouts, SHA-256 audit log',
    content: escrowGno,
  },
  {
    filename: 'render.gno',
    summary: 'Deterministic gnoweb Render(path) markdown router',
    content: renderGno,
  },
  {
    filename: 'escrow_test.gno',
    summary: 'Lifecycle, dispute, expiry, and CodeRealm MITM adversarial Gno tests',
    content: escrowTestGno,
  },
];
