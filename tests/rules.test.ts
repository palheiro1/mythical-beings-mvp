import { describe, it, expect, beforeEach } from 'vitest';
import { isValidAction, checkWinCondition, executeKnowledgePhase } from '../src/game/rules';
import { GameState, GameAction, Creature, Knowledge } from '../src/game/types'; // Removed unused PlayerState
import { initializeGame } from '../src/game/state'; // Import initializeGame for setup

// Mock data for testing
const mockCreature1: Creature = { id: 'c1', name: 'Creature 1', element: 'air', passiveAbility: '', baseWisdom: 0, image: '', currentWisdom: 2 };
const mockCreature2: Creature = { id: 'c2', name: 'Creature 2', element: 'water', passiveAbility: '', baseWisdom: 0, image: '', currentWisdom: 1 };
const mockCreature3: Creature = { id: 'c3', name: 'Creature 3', element: 'earth', passiveAbility: '', baseWisdom: 0, image: '', currentWisdom: 3 };
const mockKnowledge1: Knowledge = { id: 'k1', name: 'Knowledge 1', type: 'spell', cost: 1, effect: 'Effect 1', image: '', element: 'neutral' };
const mockKnowledge2: Knowledge = { id: 'k2', name: 'Knowledge 2', type: 'ally', cost: 2, effect: 'Effect 2', image: '', element: 'neutral' };
const mockKnowledge3: Knowledge = { id: 'k3', name: 'Knowledge 3', type: 'spell', cost: 3, effect: 'Effect 3', image: '', element: 'neutral' };

let baseGameState: GameState;

beforeEach(() => {
  // Use initializeGame to get a consistent starting state, then modify as needed
  baseGameState = initializeGame('testGame', 'p1', 'p2', [mockCreature1, mockCreature2], [mockCreature3]);
  // Override parts of the initialized state for specific test scenarios
  baseGameState.players[0].hand = [mockKnowledge1, mockKnowledge2];
  baseGameState.players[0].creatures[0].currentWisdom = 2; // Ensure creature 1 has enough wisdom for k2
  baseGameState.players[1].hand = [mockKnowledge3];
  baseGameState.market = [
    mockKnowledge3,
    { id: 'k4', name: 'Knowledge 4', type: 'spell', cost: 1, effect: '', image: '', element: 'neutral' },
    { id: 'k5', name: 'Knowledge 5', type: 'ally', cost: 2, effect: '', image: '', element: 'neutral' },
    { id: 'k6', name: 'Knowledge 6', type: 'spell', cost: 3, effect: '', image: '', element: 'neutral' },
    { id: 'k7', name: 'Knowledge 7', type: 'ally', cost: 4, effect: '', image: '', element: 'neutral' }
  ];
  baseGameState.phase = 'action'; // Set to action phase for most tests
  baseGameState.actionsTakenThisTurn = 0;
  baseGameState.currentPlayerIndex = 0; // Player 1 starts
});

describe('isValidAction', () => {
  it('should return true for a valid ROTATE_CREATURE action', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
    expect(isValidAction(baseGameState, action)).toBe(true);
  });

  it('should return false for ROTATE_CREATURE if not players turn', () => { // Fixed typo in description
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p2', creatureId: 'c3' } };
    expect(isValidAction(baseGameState, action)).toBe(false);
  });

    it('should return false for ROTATE_CREATURE if creature does not exist', () => {
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c99' } };
    expect(isValidAction(baseGameState, action)).toBe(false);
  });

  it('should return true for a valid DRAW_KNOWLEDGE action', () => {
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k3' } }; // k3 is in market
    expect(isValidAction(baseGameState, action)).toBe(true);
  });

  it('should return false for DRAW_KNOWLEDGE if hand is full', () => {
    baseGameState.players[0].hand = [mockKnowledge1, mockKnowledge2, mockKnowledge3, {id: 'k4', name: 'K4', type: 'spell', cost: 1, effect: '', image: '', element: 'neutral'}, {id: 'k5', name: 'K5', type: 'spell', cost: 1, effect: '', image: '', element: 'neutral'}]; // Hand size 5
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k3' } };
    expect(isValidAction(baseGameState, action)).toBe(false);
  });

    it('should return false for DRAW_KNOWLEDGE if card not in market', () => {
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k99' } };
    expect(isValidAction(baseGameState, action)).toBe(false);
  });

  it('should return true for a valid SUMMON_KNOWLEDGE action', () => {
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k2', creatureId: 'c1' } }; // k2 cost 2, c1 wisdom 2
    expect(isValidAction(baseGameState, action)).toBe(true);
  });

  it('should return false for SUMMON_KNOWLEDGE if insufficient wisdom', () => {
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k2', creatureId: 'c2' } }; // k2 cost 2, c2 wisdom 1
    expect(isValidAction(baseGameState, action)).toBe(false);
  });

    it('should return false for SUMMON_KNOWLEDGE if knowledge not in hand', () => {
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k3', creatureId: 'c1' } }; // k3 not in p1 hand
    expect(isValidAction(baseGameState, action)).toBe(false);
  });

    it('should return false for SUMMON_KNOWLEDGE if creature already has knowledge', () => {
    baseGameState.players[0].field[0].knowledge = mockKnowledge1; // Attach knowledge to c1's field slot
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: 'p1', knowledgeId: 'k2', creatureId: 'c1' } };
    expect(isValidAction(baseGameState, action)).toBe(false);
  });

  it('should return true for END_TURN action', () => {
    const action: GameAction = { type: 'END_TURN', payload: { playerId: 'p1' } };
    expect(isValidAction(baseGameState, action)).toBe(true);
  });

  it('should return false for any action if not in action phase', () => {
    baseGameState.phase = 'knowledge';
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
    expect(isValidAction(baseGameState, action)).toBe(false);
  });

  it('should return false for actions (not END_TURN) if actionsTakenThisTurn >= ACTIONS_PER_TURN', () => {
    baseGameState.actionsTakenThisTurn = 2;
    const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p1', creatureId: 'c1' } };
    expect(isValidAction(baseGameState, action)).toBe(false);
    const endTurnAction: GameAction = { type: 'END_TURN', payload: { playerId: 'p1' } };
    expect(isValidAction(baseGameState, endTurnAction)).toBe(true); // Can still end turn
  });

    it('should return true for SET_GAME_STATE action', () => {
        const action: GameAction = { type: 'SET_GAME_STATE', payload: baseGameState };
        expect(isValidAction(baseGameState, action)).toBe(true);
    });

    it('should return true for INITIALIZE_GAME action', () => {
        const action: GameAction = { type: 'INITIALIZE_GAME', payload: { gameId: 'newGame', player1Id: 'pA', player2Id: 'pB', selectedCreaturesP1: [], selectedCreaturesP2: [] } };
        expect(isValidAction(baseGameState, action)).toBe(true);
    });

    it('should return false if action payload is malformed or missing playerId', () => {
        // @ts-expect-error Testing invalid payload structure
        const actionMissingPlayerId: GameAction = { type: 'ROTATE_CREATURE', payload: { creatureId: 'c1' } };
        // @ts-expect-error Testing invalid payload structure
        const actionWrongPayloadType: GameAction = { type: 'ROTATE_CREATURE', payload: 'invalid' };
        expect(isValidAction(baseGameState, actionMissingPlayerId)).toBe(false);
        expect(isValidAction(baseGameState, actionWrongPayloadType)).toBe(false);
    });

    it('should return false if playerId in payload does not exist in game state', () => {
        const action: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: 'p99', creatureId: 'c1' } };
        expect(isValidAction(baseGameState, action)).toBe(false);
    });
});

describe('checkWinCondition', () => {
  it('should return player 1 ID if player 2 power is 0 or less', () => {
    baseGameState.players[1].power = 0;
    expect(checkWinCondition(baseGameState)).toBe('p1');
    baseGameState.players[1].power = -5;
    expect(checkWinCondition(baseGameState)).toBe('p1');
  });

  it('should return player 2 ID if player 1 power is 0 or less', () => {
    baseGameState.players[0].power = 0;
    expect(checkWinCondition(baseGameState)).toBe('p2');
    baseGameState.players[0].power = -10;
    expect(checkWinCondition(baseGameState)).toBe('p2');
  });

  it('should return null if neither player power is 0 or less', () => {
    baseGameState.players[0].power = 10;
    baseGameState.players[1].power = 5;
    expect(checkWinCondition(baseGameState)).toBeNull();
  });
});

describe('executeKnowledgePhase', () => {
  beforeEach(() => {
    // Setup state with knowledge cards on the field
    baseGameState.players[0].field = [
      { creatureId: 'c1', knowledge: { ...mockKnowledge1, rotation: 0 } }, // Cost 1
      { creatureId: 'c2', knowledge: { ...mockKnowledge2, rotation: 270 } }, // Cost 2, about to discard
    ];
    baseGameState.players[1].field = [
      { creatureId: 'c3', knowledge: { ...mockKnowledge3, rotation: 90 } }, // Cost 3
    ];
    baseGameState.phase = 'knowledge'; // Ensure phase is correct
  });

  it('should rotate knowledge cards correctly', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.players[0].field[0].knowledge?.rotation).toBe(90);
    expect(newState.players[1].field[0].knowledge?.rotation).toBe(180);
  });

  it('should discard knowledge cards that complete rotation (>= 360)', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.players[0].field[1].knowledge).toBeNull(); // k2 should be discarded
  });

  it('should transition phase to "action" and reset actionsTakenThisTurn', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.phase).toBe('action');
    expect(newState.actionsTakenThisTurn).toBe(0);
  });

  it('should log phase transitions and card rotations/discards', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.log).toContain(`Turn ${baseGameState.turn}: Knowledge Phase started.`);
    expect(newState.log).toContain(`${mockKnowledge1.name} on c1 (Player 1) rotated to 90 degrees.`);
    expect(newState.log).toContain(`${mockKnowledge2.name} on c2 (Player 1) completed rotation and is discarded.`);
    expect(newState.log).toContain(`${mockKnowledge3.name} on c3 (Player 2) rotated to 180 degrees.`);
    expect(newState.log).toContain(`Turn ${baseGameState.turn}: Knowledge Phase ended. Action Phase started for Player ${baseGameState.currentPlayerIndex + 1}.`);
  });

  // TODO: Add tests for actual effect execution once implemented
  it.skip('should execute effects of knowledge cards', () => {
    // This test requires effect implementation in executeKnowledgePhase
  });
});

describe('executeKnowledgePhase - damage/defense resolution', () => {
  it('accumulates multiple effects and applies net damage correctly', () => {
    // Create a deep copy for this test to avoid state pollution
    const testState = JSON.parse(JSON.stringify(baseGameState));

    // Setup: Player 1 (index 1) has aquatic2 (+1 defense), Player 0 has terrestrial1 (2 damage)
    testState.players[0].field = [
      { creatureId: 'c1', knowledge: { ...mockKnowledge1, id: 'terrestrial1', name: 'Terr1', rotation: 0, element: 'earth' } }, // Added element
    ];
    testState.players[1].field = [
      { creatureId: 'c3', knowledge: { ...mockKnowledge3, id: 'aquatic2', name: 'Aqua2', rotation: 0, element: 'water' } }, // Added element
    ];
    testState.players[0].power = 20;
    testState.players[1].power = 20;
    testState.phase = 'knowledge';

    const newState = executeKnowledgePhase(testState);
    // Terrestrial1 at rot 0 deals 1 base damage (bonus doesn't apply as opponent has knowledge);
    // aquatic2 at rot 0 gives +1 defense to Player 2; net = 0
    expect(newState.players[1].power).toBe(20); // Expected power is 20 because net damage is 0
    // Check the log for the correct combat resolution message
    expect(newState.log).toContain('Combat: Player 2 absorbs all damage (raw 1 - defense 1).');
  });

  it('does not apply negative net damage when defense exceeds damage', () => {
    // Create a deep copy for this test to avoid state pollution
    const testState = JSON.parse(JSON.stringify(baseGameState));

    // Setup: Player 1 (index 1) has two aquatic2 (+2 defense), no damage effects
    testState.players[0].field = [];
    testState.players[1].field = [
      { creatureId: 'c3', knowledge: { ...mockKnowledge3, id: 'aquatic2', name: 'Aqua2', rotation: 0, element: 'water' } }, // Added element
      { creatureId: 'c3', knowledge: { ...mockKnowledge3, id: 'aquatic2', name: 'Aqua2', rotation: 0, element: 'water' } }, // Added element
    ];
    testState.players[0].power = 20;
    testState.players[1].power = 20;
    testState.phase = 'knowledge';

    const newState = executeKnowledgePhase(testState);
    // Two aquatic2 each give +1 defense => total defense=2, no damage => net=0
    expect(newState.players[1].power).toBe(20);
    expect(newState.log).toContain('Combat: Player 2 absorbs all damage (raw 0 - defense 2).');
  });
});
