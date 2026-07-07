import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import ActionBar from '../../src/components/game/ActionBar.js';

describe('ActionBar', () => {
  it('uses a resolved winner label instead of exposing ids', () => {
    render(
      <ActionBar
        isMyTurn={false}
        phase="gameOver"
        winner="550e8400-e29b-41d4-a716-446655440000"
        winnerLabel="Tomate"
        actionsTaken={0}
        actionsPerTurn={2}
        turnTimer={0}
        isSpectator={false}
        onEndTurnClick={vi.fn()}
      />,
    );

    expect(screen.getByText('Game Over! Winner: Tomate')).toBeInTheDocument();
    expect(screen.queryByText(/550e|Player \(/)).not.toBeInTheDocument();
  });
});
