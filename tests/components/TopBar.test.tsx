import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TopBar from '../../src/components/game/TopBar.js';
import { CardRegistryProvider } from '../../src/context/CardRegistry.js';
import { recordGameOutcomeAndUpdateStats, updateGameState } from '../../src/utils/supabase.js';
import { createInitialTestState } from '../utils/testHelpers.js';

vi.mock('../../src/utils/supabase.js', () => ({
  updateGameState: vi.fn(() => Promise.resolve(true)),
  recordGameOutcomeAndUpdateStats: vi.fn(() => Promise.resolve()),
}));

describe('TopBar', () => {
  it('uses the local resign handler without calling the multiplayer persistence path', async () => {
    const onResign = vi.fn(() => Promise.resolve());
    const gameState = createInitialTestState('bot-local', ['adaro'], ['pele']);

    render(
      <CardRegistryProvider>
        <TopBar
          player1Profile={{ id: 'player1', username: 'You', display_name: null, avatar_url: null }}
          player2Profile={{ id: 'player2', username: 'Bot', display_name: null, avatar_url: null }}
          player1Power={20}
          player2Power={20}
          turn={1}
          phase="action"
          currentPlayerId={gameState.players[0].id}
          gameState={gameState}
          onResign={onResign}
        />
      </CardRegistryProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Resign and concede the match' }));

    await waitFor(() => expect(onResign).toHaveBeenCalledOnce());
    expect(updateGameState).not.toHaveBeenCalled();
    expect(recordGameOutcomeAndUpdateStats).not.toHaveBeenCalled();
  });
});
