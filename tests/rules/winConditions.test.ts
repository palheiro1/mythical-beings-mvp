import { describe, it, expect } from 'vitest';
import { checkWinCondition } from '../../src/game/rules.js';
import { createInitialTestState } from '../utils/testHelpers.js';

describe('checkWinCondition', () => {
  it('returns player1 ID when player2 power <= 0', () => {
    const state = createInitialTestState();
    state.players[1].power = 0;
    expect(checkWinCondition(state)).toBe('player1');
    state.players[1].power = -5;
    expect(checkWinCondition(state)).toBe('player1');
  });

  it('returns player2 ID when player1 power <= 0', () => {
    const state = createInitialTestState();
    state.players[0].power = 0;
    expect(checkWinCondition(state)).toBe('player2');
    state.players[0].power = -10;
    expect(checkWinCondition(state)).toBe('player2');
  });

  it('returns null when both players power > 0', () => {
    const state = createInitialTestState();
    state.players[0].power = 5;
    state.players[1].power = 5;
    expect(checkWinCondition(state)).toBeNull();
  });
});