import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isValidAction } from '../../src/game/rules.js';
import { createInitialTestState, createTestKnowledge } from '../utils/testHelpers.js';

let state;
const player1 = 'player1';

beforeEach(() => {
  state = createInitialTestState();
  state.phase = 'action';
  state.actionsTakenThisTurn = 0;
  state.currentPlayerIndex = 0;
});

describe('isValidAction', () => {
  it('returns true for a valid ROTATE_CREATURE', () => {
    const action = { type: 'ROTATE_CREATURE', payload: { playerId: player1, creatureId: state.players[0].creatures[0].id } };
    expect(isValidAction(state, action).isValid).toBe(true);
  });

  it('returns false for ROTATE_CREATURE when not player turn', () => {
    const action = { type: 'ROTATE_CREATURE', payload: { playerId: 'other', creatureId: state.players[0].creatures[0].id } };
    expect(isValidAction(state, action).isValid).toBe(false);
  });

  it('returns true for valid DRAW_KNOWLEDGE', () => {
    const card = state.market[0];
    const action = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1, knowledgeId: card.id, instanceId: card.instanceId } };
    expect(isValidAction(state, action).isValid).toBe(true);
  });

  it('returns false for DRAW_KNOWLEDGE when hand is full', () => {
    state.players[0].hand = Array(5).fill(null).map(() => createTestKnowledge(state.market[0].id));
    const card = state.market[0];
    const action = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1, knowledgeId: card.id, instanceId: card.instanceId } };
    expect(isValidAction(state, action).isValid).toBe(false);
  });

  it('returns false for DRAW_KNOWLEDGE when market empty', () => {
    state.market = [];
    const action = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1, knowledgeId: 'x', instanceId: 'x' } };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('Market is empty');
  });

  it('returns true for END_TURN action', () => {
    const action = { type: 'END_TURN', payload: { playerId: player1 } };
    expect(isValidAction(state, action).isValid).toBe(true);
  });
});
