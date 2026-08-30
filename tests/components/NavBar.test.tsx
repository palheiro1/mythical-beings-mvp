import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import NavBar from '../../src/components/NavBar.js';

let authState: any;

vi.mock('../../src/hooks/useAuth.js', () => ({
  useAuth: () => authState,
}));

const baseAuthState = {
  user: null,
  profile: null,
  polygonWallet: null,
  loading: false,
  signOut: vi.fn(),
};

function renderNavBar() {
  return render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>,
  );
}

describe('NavBar', () => {
  beforeEach(() => {
    authState = { ...baseAuthState, signOut: vi.fn() };
  });

  it('offers public training navigation to visitors', () => {
    renderNavBar();

    expect(screen.getAllByRole('link', { name: /home/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /how to play/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /training/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /lobby/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /leaderboard/i })).not.toBeInTheDocument();
  });

  it('keeps profile navigation limited to players with a linked Polygon wallet', () => {
    authState = {
      ...baseAuthState,
      user: { id: 'user-1', email: 'player@example.com' },
      profile: { display_name: 'Tomate', username: 'tomate' },
      polygonWallet: { address: '0x1234567890abcdef1234567890abcdef12345678' },
    };

    renderNavBar();

    expect(screen.getAllByRole('link', { name: /training/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /lobby/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /leaderboard/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /profile/i }).length).toBeGreaterThan(0);
  });

  it('keeps training public and avoids wallet-only links for signed-in users without a wallet', () => {
    authState = {
      ...baseAuthState,
      user: { id: 'user-1', email: 'player@example.com' },
      profile: { display_name: 'Tomate', username: 'tomate' },
      polygonWallet: null,
    };

    renderNavBar();

    expect(screen.getAllByRole('link', { name: /training/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /link wallet/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /lobby/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /profile/i })).not.toBeInTheDocument();
  });
});
