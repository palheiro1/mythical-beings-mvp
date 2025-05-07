import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isValidAction } from '../../src/game/rules.js';
import { createInitialTestState, createTestKnowledge } from '../utils/testHelpers.js';
import { GameState, GameAction, RotateCreaturePayload, DrawKnowledgePayload, SummonKnowledgePayload, EndTurnPayload, Player } from '../../src/game/types.js'; // Import necessary types

let state: GameState;
const player1Id = 'player1'; // Renamed for clarity to avoid conflict with player object

beforeEach(() => {
  state = createInitialTestState('validationTestGame', ['adaro', 'pele'], ['lisovik', 'tsenehale']); // Added gameId and creatures for robustness
  state.phase = 'action';
  state.actionsTakenThisTurn = 0;
  state.currentPlayerIndex = 0;
  // Ensure player1Id matches the ID of the current player in the initial state
  if (state.players[0]) {
    state.players[0].id = player1Id;
  } else {
    throw new Error('Test setup failed: Player 0 not found in initial state');
  }
  // Ensure there is an opponent for some tests
  if (state.players.length < 2 && state.players[1]) {
    state.players[1].id = 'player2';
  } else if (state.players.length < 2) {
    // Add a dummy opponent if one doesn't exist from createInitialTestState
    const dummyOpponent: Player = {
      id: 'player2',
      power: 20,
      creatures: [],
      field: [],
      hand: [],
      deck: [],
      isReady: true,
      nftId: 'opponent_nft'
    };
    state.players.push(dummyOpponent);
  }
});

describe('isValidAction', () => {
  it('returns true for a valid ROTATE_CREATURE', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player1Id, creatureId: state.players[0].creatures[0].id } as RotateCreaturePayload };
    expect(isValidAction(state, action).isValid).toBe(true);
  });

  it('returns false for ROTATE_CREATURE when not player turn', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'other', creatureId: state.players[0].creatures[0].id } as RotateCreaturePayload };
    expect(isValidAction(state, action).isValid).toBe(false);
  });

  it('returns true for valid DRAW_KNOWLEDGE', () => {
    if (state.market.length === 0) state.market.push(createTestKnowledge('aerial1')); // Ensure market has a card
    const card = state.market[0];
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: card.id, instanceId: card.instanceId! } as DrawKnowledgePayload };
    expect(isValidAction(state, action).isValid).toBe(true);
  });

  it('returns false for DRAW_KNOWLEDGE when hand is full', () => {
    if (state.market.length === 0) state.market.push(createTestKnowledge('aerial1'));
    state.players[0].hand = Array(5).fill(null).map(() => createTestKnowledge(state.market[0].id));
    const card = state.market[0];
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: card.id, instanceId: card.instanceId! } as DrawKnowledgePayload };
    expect(isValidAction(state, action).isValid).toBe(false);
  });

  it('returns false for DRAW_KNOWLEDGE when market card not found', () => {
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: 'x', instanceId: 'x' } as DrawKnowledgePayload };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('Card not found in market.');
  });

  it('returns true for DRAW_KNOWLEDGE when deck is empty but market is not', () => {
    state.knowledgeDeck = [];
    if (state.market.length === 0) state.market.push(createTestKnowledge('aerial1'));
    const card = state.market[0];
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: card.id, instanceId: card.instanceId! } as DrawKnowledgePayload };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(true);
  });

  it('returns false for SUMMON_KNOWLEDGE when target slot is blocked by opponent', () => {
    const player = state.players[0];
    const creatureId = player.creatures[0].id;
    const knowledgeCard = createTestKnowledge('terrestrial1', { cost: 1 });
    player.hand.push(knowledgeCard);
    player.creatures[0].currentWisdom = 1;

    const fieldSlotIndex = player.field.findIndex(s => s.creatureId === creatureId);
    if (fieldSlotIndex === -1) throw new Error('Test setup error: Creature field slot not found');

    state.blockedSlots = { 0: [], 1: [fieldSlotIndex] };

    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: knowledgeCard.id, instanceId: knowledgeCard.instanceId!, creatureId: creatureId } as SummonKnowledgePayload };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('blocked by an opponent');
  });

  it('returns false for SUMMON_KNOWLEDGE when target slot is blocked by self (using creatureId)', () => {
    const player = state.players[0];
    const creatureId = player.creatures[0].id;
    const knowledgeCard = createTestKnowledge('terrestrial1', { cost: 1 });
    player.hand.push(knowledgeCard);
    player.creatures[0].currentWisdom = 1;

    const fieldSlotIndex = player.field.findIndex(s => s.creatureId === creatureId);
    if (fieldSlotIndex === -1) throw new Error('Test setup error: Creature field slot not found');

    state.blockedSlots = { [state.currentPlayerIndex]: [fieldSlotIndex], [state.currentPlayerIndex === 0 ? 1: 0]: [] };

    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: knowledgeCard.id, instanceId: knowledgeCard.instanceId!, creatureId: creatureId } as SummonKnowledgePayload };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe(`Creature slot ${creatureId} is currently blocked.`);
  });

  it('returns true for END_TURN action', () => {
    const action: GameAction = { type: 'END_TURN', payload: { playerId: player1Id } as EndTurnPayload };
    expect(isValidAction(state, action).isValid).toBe(true);
  });

  it('returns false for action with missing payload', () => {
    const action = { type: 'ROTATE_CREATURE' } as any;
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('Missing payload for ROTATE_CREATURE.');
  });

  it('returns false for action with wrong data type in payload', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player1Id, creatureId: 12345 } as any };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Creature to rotate not found/i);
  });

  it('returns false for action in wrong phase', () => {
    state.phase = 'knowledge';
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player1Id, creatureId: state.players[0].creatures[0].id } as RotateCreaturePayload };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Not in action phase/i);
  });

  it('returns false for action by wrong player', () => {
    const otherPlayerId = state.players.find(p => p.id !== player1Id)!.id;
    const action: GameAction = { type: 'END_TURN', payload: { playerId: otherPlayerId } as EndTurnPayload };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe("Not the current player's turn or action not for this player.");
  });

  it('returns false for action on non-existent creature', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player1Id, creatureId: 'nonexistent' } as RotateCreaturePayload };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/Creature to rotate not found/i);
  });

  it('returns false for SUMMON_KNOWLEDGE on already-occupied slot', () => {
    const player = state.players[0];
    const creatureId = player.creatures[0].id;
    const fieldSlotIndex = player.field.findIndex(s => s.creatureId === creatureId);
    if (fieldSlotIndex === -1) throw new Error('Test setup error: Creature field slot not found');

    player.field[fieldSlotIndex].knowledge = createTestKnowledge('terrestrial1');
    const knowledgeCard = createTestKnowledge('terrestrial2');
    player.hand.push(knowledgeCard);
    player.creatures[0].currentWisdom = 2;
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: knowledgeCard.id, instanceId: knowledgeCard.instanceId!, creatureId: creatureId } as SummonKnowledgePayload };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/already has knowledge/i);
  });
});
