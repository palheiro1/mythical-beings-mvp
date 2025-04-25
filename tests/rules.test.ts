import { describe, it, expect, beforeEach } from 'vitest';
import { isValidAction, checkWinCondition, executeKnowledgePhase } from '../src/game/rules';
import { GameState, GameAction } from '../src/game/types';
import { initializeGame } from '../src/game/state';
import creatureData from '../src/assets/creatures.json';
import knowledgeData from '../src/assets/knowledges.json';

// Helper to find cards
const findCreature = (id: string) => (creatureData as any[]).find(c => c.id === id);
const findKnowledge = (id: string) => (knowledgeData as any[]).find(k => k.id === id);

const player1Id = 'player1';
const player2Id = 'player2';
const dudugera = findCreature('dudugera');
const adaro = findCreature('adaro');
const terrestrial1 = findKnowledge('terrestrial1');
const aquatic2 = findKnowledge('aquatic2');
const aerial1 = findKnowledge('aerial1');

if (!dudugera || !adaro || !terrestrial1 || !aquatic2 || !aerial1) {
  throw new Error('Required test data not found in creatures.json or knowledges.json');
}

let baseGameState: GameState;

beforeEach(() => {
  // Use IDs, not objects, for initializeGame
  baseGameState = initializeGame({
    gameId: 'testGame',
    player1Id,
    player2Id,
    player1SelectedIds: [dudugera.id, adaro.id],
    player2SelectedIds: [adaro.id, dudugera.id],
  });
  baseGameState.players[0].hand = [terrestrial1, aquatic2];
  baseGameState.players[1].hand = [aerial1];
  baseGameState.market = [
    aerial1,
    findKnowledge('aerial2'),
    findKnowledge('aerial3'),
    findKnowledge('aquatic1'),
    findKnowledge('terrestrial1')
  ].filter(Boolean);
  baseGameState.phase = 'action';
  baseGameState.actionsTakenThisTurn = 0;
  baseGameState.currentPlayerIndex = 0;
});

describe('isValidAction', () => {
  it('should return true for a valid ROTATE_CREATURE action', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player1Id, creatureId: dudugera.id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(true);
  });

  it('should return false for ROTATE_CREATURE if not players turn', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player2Id, creatureId: adaro.id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return false for ROTATE_CREATURE if creature does not exist', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player1Id, creatureId: 'nonexistent' } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return true for a valid DRAW_KNOWLEDGE action', () => {
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: aerial1.id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(true);
  });

  it('should return false for DRAW_KNOWLEDGE if hand is full', () => {
    baseGameState.players[0].hand = [terrestrial1, aquatic2, aerial1, findKnowledge('spell1'), findKnowledge('spell2')];
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: aerial1.id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return false for DRAW_KNOWLEDGE if card not in market', () => {
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: 'nonexistent' } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return true for a valid SUMMON_KNOWLEDGE action', () => {
    // Ensure Dudugera has enough wisdom and field slot is empty
    baseGameState.players[0].creatures[0].currentWisdom = 5;
    baseGameState.players[0].field[0].knowledge = null;
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: aquatic2.id, creatureId: dudugera.id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(true);
  });

  it('should return false for SUMMON_KNOWLEDGE if insufficient wisdom', () => {
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: aquatic2.id, creatureId: adaro.id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return false for SUMMON_KNOWLEDGE if knowledge not in hand', () => {
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: aerial1.id, creatureId: dudugera.id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return false for SUMMON_KNOWLEDGE if creature already has knowledge', () => {
    baseGameState.players[0].field[0].knowledge = terrestrial1;
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: aquatic2.id, creatureId: dudugera.id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return true for END_TURN action', () => {
    const action: GameAction = { type: 'END_TURN', payload: { playerId: player1Id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(true);
  });

  it('should return false for any action if not in action phase', () => {
    baseGameState.phase = 'knowledge';
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player1Id, creatureId: dudugera.id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return false for actions (not END_TURN) if actionsTakenThisTurn >= ACTIONS_PER_TURN', () => {
    baseGameState.actionsTakenThisTurn = 2;
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player1Id, creatureId: dudugera.id } };
    const result = isValidAction(baseGameState, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toMatch(/No actions left|Action limit reached/);
    const endTurnAction: GameAction = { type: 'END_TURN', payload: { playerId: player1Id } };
    expect(isValidAction(baseGameState, endTurnAction).isValid).toBe(true);
  });

  it('should return true for SET_GAME_STATE action', () => {
    const action: GameAction = { type: 'SET_GAME_STATE', payload: baseGameState };
    expect(isValidAction(baseGameState, action).isValid).toBe(true);
  });

  it('should return true for INITIALIZE_GAME action', () => {
    const action: GameAction = { type: 'INITIALIZE_GAME', payload: { gameId: 'newGame', player1Id: 'pA', player2Id: 'pB', selectedCreaturesP1: [], selectedCreaturesP2: [] } };
    expect(isValidAction(baseGameState, action).isValid).toBe(true);
  });

  it('should return false if action payload is malformed or missing playerId', () => {
    // @ts-expect-error Testing invalid payload structure
    const actionMissingPlayerId: GameAction = { type: 'ROTATE_CREATURE', payload: { creatureId: dudugera.id } };
    // @ts-expect-error Testing invalid payload structure
    const actionWrongPayloadType: GameAction = { type: 'ROTATE_CREATURE', payload: 'invalid' };
    expect(isValidAction(baseGameState, actionMissingPlayerId).isValid).toBe(false);
    expect(isValidAction(baseGameState, actionWrongPayloadType).isValid).toBe(false);
  });

  it('should return false if playerId in payload does not exist in game state', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'nonexistent', creatureId: dudugera.id } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });
});

describe('checkWinCondition', () => {
  it('should return player 1 ID if player 2 power is 0 or less', () => {
    baseGameState.players[1].power = 0;
    expect(checkWinCondition(baseGameState)).toBe(player1Id);
    baseGameState.players[1].power = -5;
    expect(checkWinCondition(baseGameState)).toBe(player1Id);
  });

  it('should return player 2 ID if player 1 power is 0 or less', () => {
    baseGameState.players[0].power = 0;
    expect(checkWinCondition(baseGameState)).toBe(player2Id);
    baseGameState.players[0].power = -10;
    expect(checkWinCondition(baseGameState)).toBe(player2Id);
  });

  it('should return null if neither player power is 0 or less', () => {
    baseGameState.players[0].power = 10;
    baseGameState.players[1].power = 5;
    expect(checkWinCondition(baseGameState)).toBeNull();
  });
});

describe('executeKnowledgePhase', () => {
  beforeEach(() => {
    baseGameState.players[0].field = [
      { creatureId: dudugera.id, knowledge: { ...terrestrial1, rotation: 0 } },
      { creatureId: adaro.id, knowledge: { ...aquatic2, rotation: 270 } },
    ];
    baseGameState.players[1].field = [
      { creatureId: adaro.id, knowledge: { ...aerial1, rotation: 90 } },
    ];
    baseGameState.phase = 'knowledge';
  });

  it('should rotate knowledge cards correctly', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.players[0].field[0].knowledge?.rotation).toBe(90);
    expect(newState.players[1].field[0].knowledge?.rotation).toBe(180);
  });

  it('should discard knowledge cards that complete rotation (>= 360)', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.players[0].field[1].knowledge).toBeNull();
  });

  it('should transition phase to "action" and reset actionsTakenThisTurn', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.phase).toBe('action');
    expect(newState.actionsTakenThisTurn).toBe(0);
  });

  it('should log phase transitions and card rotations/discards', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.log.some(log => log.includes('Knowledge Phase started'))).toBe(true);
    expect(newState.log.some(log => log.includes('was fully rotated and discarded'))).toBe(true);
    expect(newState.log.some(log => log.includes('Action Phase started') || log.includes('Knowledge Phase ended'))).toBe(true);
  });

  it.skip('should execute effects of knowledge cards', () => {
    // This test requires effect implementation in executeKnowledgePhase
  });
});

describe('executeKnowledgePhase - damage/defense resolution', () => {
  it('accumulates multiple effects and applies net damage correctly', () => {
    const testState = JSON.parse(JSON.stringify(baseGameState));

    testState.players[0].field = [
      { creatureId: dudugera.id, knowledge: { ...terrestrial1, id: 'terrestrial1', name: 'Terr1', rotation: 0, element: 'earth' } },
    ];
    testState.players[1].field = [
      { creatureId: adaro.id, knowledge: { ...aquatic2, id: 'aquatic2', name: 'Aqua2', rotation: 0, element: 'water' } },
    ];
    testState.players[0].power = 20;
    testState.players[1].power = 20;
    testState.phase = 'knowledge';

    const newState = executeKnowledgePhase(testState);
    expect(newState.players[1].power).toBe(20);
  });

  it('does not apply negative net damage when defense exceeds damage', () => {
    const testState = JSON.parse(JSON.stringify(baseGameState));

    testState.players[0].field = [];
    testState.players[1].field = [
      { creatureId: adaro.id, knowledge: { ...aquatic2, id: 'aquatic2', name: 'Aqua2', rotation: 0, element: 'water' } },
      { creatureId: adaro.id, knowledge: { ...aquatic2, id: 'aquatic2', name: 'Aqua2', rotation: 0, element: 'water' } },
    ];
    testState.players[0].power = 20;
    testState.players[1].power = 20;
    testState.phase = 'knowledge';

    const newState = executeKnowledgePhase(testState);
    expect(newState.players[1].power).toBe(20);
  });
});
