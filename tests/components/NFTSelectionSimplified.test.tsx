import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import NFTSelectionSimplified from '../../src/pages/NFTSelectionSimplified.js';
import { CardRegistryProvider } from '../../src/context/CardRegistry.js';

vi.mock('../../src/hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'player@example.com' },
    error: null,
  }),
}));

describe('NFTSelectionSimplified', () => {
  it('offers untimed local team selection for training', async () => {
    render(
      <CardRegistryProvider>
        <NFTSelectionSimplified mode="bot" />
      </CardRegistryProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: /select your training team/i })).toBeInTheDocument();
    expect(screen.queryByText(/selection timer expired/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/^60$/)).not.toBeInTheDocument();
    expect(screen.getByText(/does not require an account or wallet/i)).toBeInTheDocument();

    const cardButtons = screen.getAllByRole('button', { name: /not selected for team selection/i });
    fireEvent.click(cardButtons[0]);
    fireEvent.click(cardButtons[1]);
    fireEvent.click(cardButtons[2]);

    expect(screen.getByRole('button', { name: /start training \(3\/3\)/i })).toBeEnabled();
  });
});
