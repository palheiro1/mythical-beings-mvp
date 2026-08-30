import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Home from '../../src/pages/Home.js';

const navigateMock = vi.hoisted(() => vi.fn());

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../src/hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: null,
    profile: null,
    polygonWallet: null,
    loading: false,
    error: null,
    magicLinkSentTo: null,
    magicLinkCooldownUntil: null,
    signInWithGoogle: vi.fn(),
    signInWithPlayHubEmail: vi.fn(),
    connectPolygonWallet: vi.fn(),
  }),
}));

describe('Home training preview', () => {
  it('starts local training without sign-in or wallet linking', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/']}>
        <Home />
      </MemoryRouter>,
    );

    expect(screen.getByRole('button', { name: /start training.*no sign-in/i })).toBeInTheDocument();
    expect(screen.getByText(/account and polygon wallet are optional/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /start training.*no sign-in/i }));

    expect(navigateMock).toHaveBeenCalledWith('/bot-selection');
  });
});
