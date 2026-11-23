import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../App';

describe('TavernEscrow Interactive Console UI', () => {
  it('renders header metrics, seeded bounties, and verified SHA-256 status', () => {
    render(<App />);
    expect(screen.getByText('TavernEscrow')).toBeInTheDocument();
    expect(screen.getByText('VERIFIED SHA-256')).toBeInTheDocument();
    expect(screen.getByText('Escrow Bounties (3)')).toBeInTheDocument();
    expect(
      screen.getByText('#1 · GnoConnect Ledger Hardware Signer')
    ).toBeInTheDocument();
  });

  it('blocks CodeRealm attacker when attempting CreateBounty in the UI', () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/Active Caller/i), {
      target: { value: 'attacker_realm' },
    });
    fireEvent.click(screen.getByRole('button', { name: /New Escrow Bounty/i }));
    fireEvent.click(screen.getByRole('button', { name: /Broadcast/i }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'CreateBounty must be called directly by an EOA (maketx call)'
    );
  });

  it('allows Sponsor to fund a new 4th bounty via the CreateBounty form', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /New Escrow Bounty/i }));
    fireEvent.click(screen.getByRole('button', { name: /Broadcast/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Funded Bounty #4');
    expect(screen.getByText('Escrow Bounties (4)')).toBeInTheDocument();
  });

  it('allows Second Builder to claim open Bounty #3', () => {
    render(<App />);
    fireEvent.click(screen.getByText('AVL Snapshot Diff Visualizer'));
    fireEvent.change(screen.getByLabelText(/Active Caller/i), {
      target: { value: 'builder2' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Claim Bounty/i }));

    expect(screen.getByRole('status')).toHaveTextContent('claimed Bounty #3');
    expect(screen.getByText(/g1ktntcp38242d24mnhrm07xt6alegvqcpcc3uut/)).toBeInTheDocument();
  });

  it('lets Neutral Arbiter settle disputed Bounty #2 and updates released TVL', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Onyx Event Stream Indexer'));
    fireEvent.change(screen.getByLabelText(/Active Caller/i), {
      target: { value: 'arbiter' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /Arbiter: Release to Worker/i })
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Arbiter released Bounty #2 Milestone #0 to worker.'
    );
  });

  it('advances block height via +2,500 blks stepper and resets cleanly', () => {
    render(<App />);
    expect(screen.getByText(/Height #420070/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /\+2,500 blks/i }));
    expect(screen.getByText(/Height #422570/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Reset/i }));
    expect(screen.getByText(/Height #420070/)).toBeInTheDocument();
  });

  it('navigates Render(path) explorer routes and toggles Raw Markdown', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Render\(path\) Explorer/i }));
    expect(
      screen.getByText('TavernEscrow — Milestone Bounty & Dispute Realm')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: ':audit' }));
    expect(
      screen.getByText('TavernEscrow — Tamper-Evident Audit Ledger')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Raw Markdown/i }));
    expect(
      screen.getByText(/# TavernEscrow — Tamper-Evident Audit Ledger/)
    ).toBeInTheDocument();
  });

  it('runs all 6 threat vectors in the Adversarial Safety Lab', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /Adversarial Safety Lab/i }));
    fireEvent.click(screen.getByRole('button', { name: /Run All 6 Threat Vectors/i }));

    expect(screen.getByText('6/6 Invariants Held')).toBeInTheDocument();
    expect(
      screen.getAllByText(/ABORTED SAFELY · STATE INVARIANT HELD/)
    ).toHaveLength(6);
  });

  it('generates gnokey CLI commands for gnoland-1 and inspects Gno source files', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: /gnokey CLI & Gno Source/i }));
    fireEvent.change(screen.getByLabelText(/Target Network/i), {
      target: { value: 'gnoland-1' },
    });

    expect(screen.getByText(/https:\/\/gno\.land\/r\/cocvn157\/tavernescrow/)).toBeInTheDocument();
    expect(screen.getAllByText(/-chainid gnoland-1/).length).toBeGreaterThanOrEqual(1);

    fireEvent.click(screen.getByRole('button', { name: 'render.gno' }));
    expect(
      screen.getByText(/Deterministic gnoweb Render\(path\) markdown router/)
    ).toBeInTheDocument();
  });
});
