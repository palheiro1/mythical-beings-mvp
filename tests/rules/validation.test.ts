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

  it('returns true for DRAW_KNOWLEDGE when deck is empty but market is not', () => {
    state.knowledgeDeck = []; // Empty the deck
    const card = state.market[0];
    const action = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1, knowledgeId: card.id, instanceId: card.instanceId } };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(true); // Drawing from market is still valid
  });

  it('returns false for SUMMON_KNOWLEDGE when target slot is blocked by opponent', () => {
    const player = state.players[0];
    const creatureId = player.creatures[0].id;
    const knowledgeCard = createTestKnowledge('terrestrial1', { cost: 1 });
    player.hand.push(knowledgeCard);
    player.creatures[0].currentWisdom = 1; // Ensure enough wisdom

    // Block the first slot (index 0) for player 0 by player 1
    state.blockedSlots = { 0: [], 1: [0] };

    const action = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1, knowledgeId: knowledgeCard.id, instanceId: knowledgeCard.instanceId, creatureId: creatureId } };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('blocked by an opponent');
  });

  it('returns false for SUMMON_KNOWLEDGE when target slot is blocked by self (using creatureId)', () => {
    const player = state.players[0];
    const creatureId = player.creatures[0].id;
    const knowledgeCard = createTestKnowledge('terrestrial1', { cost: 1 });
    player.hand.push(knowledgeCard);
    player.creatures[0].currentWisdom = 1; // Ensure enough wisdom

    // Block the creature slot for player 0 by player 0
    state.blockedSlots = { 0: [creatureId], 1: [] };

    const action = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1, knowledgeId: knowledgeCard.id, instanceId: knowledgeCard.instanceId, creatureId: creatureId } };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    // Match the exact error message returned by the function
    expect(result.reason).toBe(`Creature slot ${creatureId} is currently blocked.`);
  });

  it('returns true for END_TURN action', () => {
    const action = { type: 'END_TURN', payload: { playerId: player1 } };
    expect(isValidAction(state, action).isValid).toBe(true);
  });

  it('returns false for action with missing payload', () => {
    const action = { type: 'ROTATE_CREATURE' };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/payload/i);
  });

  it('returns false for action with wrong data type in payload', () => {
    const action = { type: 'ROTATE_CREATURE', payload: { playerId: player1, creatureId: 12345 } }; // creatureId should be string
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/creatureId/i);
  });

  it('returns false for action in wrong phase', () => {
    state.phase = 'knowledge';
    const action = { type: 'ROTATE_CREATURE', payload: { playerId: player1, creatureId: state.players[0].creatures[0].id } };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/phase/i);
  });

  it('returns false for action by wrong player', () => {
    // Use a real player ID that is NOT the current player
    const otherPlayerId = state.players.find(p => p.id !== player1)!.id;
    const action = { type: 'END_TURN', payload: { playerId: otherPlayerId } };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/turn/i);
  });

  it('returns false for action on non-existent slot', () => {
    const action = { type: 'ROTATE_CREATURE', payload: { playerId: player1, creatureId: 'nonexistent' } };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/not found|invalid/i);
  });

  it('returns false for action on already-occupied slot', () => {
    // Simulate a field slot already having knowledge
    const player = state.players[0];
    const creatureId = player.creatures[0].id;
    player.field[0].knowledge = createTestKnowledge('terrestrial1');
    const knowledgeCard = createTestKnowledge('terrestrial2');
    player.hand.push(knowledgeCard);
    player.creatures[0].currentWisdom = 2;
    const action = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1, knowledgeId: knowledgeCard.id, instanceId: knowledgeCard.instanceId, creatureId: creatureId } };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/already has knowledge/i);
  });
});
