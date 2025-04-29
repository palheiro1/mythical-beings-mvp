import { describe, it, expect } from 'vitest';
import { initializeGame } from '../../src/game/state.js';

describe('initializeGame edge cases', () => {
  it('throws if selected creature IDs length < 2', () => {
    expect(() => initializeGame({ gameId: 'g1', player1Id: 'p1', player2Id: 'p2', player1SelectedIds: ['a'], player2SelectedIds: ['b','c'] })).toThrow();
  });

  it('throws if selected creature IDs length > 2', () => {
    const ids = ['a','b','c','d'];
    expect(() => initializeGame({ gameId: 'g2', player1Id: 'p1', player2Id: 'p2', player1SelectedIds: ids, player2SelectedIds: ids.slice(0,2) })).toThrow();
  });

  it('throws if creature ID is invalid', () => {
    expect(() => initializeGame({ gameId: 'g3', player1Id: 'p1', player2Id: 'p2', player1SelectedIds: ['nonexistent','b'], player2SelectedIds: ['c','d'] })).toThrow();
  });

  it('throws if duplicate creature IDs are provided', () => {
    expect(() => initializeGame({ gameId: 'g4', player1Id: 'p1', player2Id: 'p2', player1SelectedIds: ['a','a'], player2SelectedIds: ['b','c'] })).toThrow();
  });

  it('throws if gameId is empty or missing', () => {
    expect(() => initializeGame({ gameId: '', player1Id: 'p1', player2Id: 'p2', player1SelectedIds: ['a','b'], player2SelectedIds: ['c','d'] })).toThrow();
  });
});