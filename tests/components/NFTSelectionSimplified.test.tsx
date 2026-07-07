import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import NFTSelectionSimplified from '../../src/pages/NFTSelectionSimplified.js';
import { CardRegistryProvider } from '../../src/context/CardRegistry.js';

vi.mock('../../src/context/AuthProvider.js', () => ({
  useAuth: () => ({
    user: { id: 'user-1', email: 'player@example.com' },
    error: null,
  }),
}));

describe('NFTSelectionSimplified', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps selection and confirmation available after the timer expires', async () => {
    render(
      <CardRegistryProvider>
        <NFTSelectionSimplified mode="bot" />
      </CardRegistryProvider>,
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByRole('heading', { name: /select your training team/i })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByText(/selection timer expired/i)).toBeInTheDocument();
    expect(screen.queryByText(/you lost/i)).not.toBeInTheDocument();

    const cardButtons = screen.getAllByRole('button', { name: /not selected for team selection/i });
    fireEvent.click(cardButtons[0]);
    fireEvent.click(cardButtons[1]);
    fireEvent.click(cardButtons[2]);

    expect(screen.getByRole('button', { name: /start training \(3\/3\)/i })).toBeEnabled();
  });
});
