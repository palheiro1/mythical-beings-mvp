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

  it('shows only public navigation to visitors', () => {
    renderNavBar();

    expect(screen.getAllByRole('link', { name: /home/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /how to play/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('link', { name: /lobby/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /leaderboard/i })).not.toBeInTheDocument();
  });

  it('shows game navigation only when a Polygon wallet is linked', () => {
    authState = {
      ...baseAuthState,
      user: { id: 'user-1', email: 'player@example.com' },
      profile: { display_name: 'Tomate', username: 'tomate' },
      polygonWallet: { address: '0x1234567890abcdef1234567890abcdef12345678' },
    };

    renderNavBar();

    expect(screen.getAllByRole('link', { name: /lobby/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /leaderboard/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /profile/i }).length).toBeGreaterThan(0);
  });

  it('avoids protected lobby/profile links for signed-in users without a wallet', () => {
    authState = {
      ...baseAuthState,
      user: { id: 'user-1', email: 'player@example.com' },
      profile: { display_name: 'Tomate', username: 'tomate' },
      polygonWallet: null,
    };

    renderNavBar();

    expect(screen.getByRole('link', { name: /link wallet/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /lobby/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /profile/i })).not.toBeInTheDocument();
  });
});
