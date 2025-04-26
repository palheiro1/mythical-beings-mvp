import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isValidAction, checkWinCondition, executeKnowledgePhase } from '../src/game/rules.js';
import { GameState, GameAction, PlayerState, Creature, Knowledge } from '../src/game/types.js';
import { initializeGame } from '../src/game/state.js';
import creatureData from '../src/assets/creatures.json';
import knowledgeData from '../src/assets/knowledges.json';
import { v4 as uuidv4 } from 'uuid';

// Helper to find cards
const findCreature = (id: string) => (creatureData as any[]).find(c => c.id === id);
const findKnowledge = (id: string) => (knowledgeData as any[]).find(k => k.id === id);

// Helper to create a basic test state
const createInitialTestState = (modifications: Partial<GameState> = {}): GameState => {
  const baseState = initializeGame({
    gameId: 'test-game',
    player1Id: 'player1',
    player2Id: 'player2',
    player1SelectedIds: ['dudugera', 'adaro'],
    player2SelectedIds: ['pele', 'kappa'],
  });
  return { ...baseState, ...modifications };
};

// Helper to create knowledge with instanceId
const createTestKnowledge = (id: string, overrides: Partial<Knowledge> = {}): Knowledge => {
  const baseKnowledge = findKnowledge(id);
  if (!baseKnowledge) throw new Error(`Knowledge ${id} not found for test setup`);
  return { ...baseKnowledge, instanceId: uuidv4(), rotation: 0, ...overrides };
};

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
  baseGameState = initializeGame({
    gameId: 'testGame',
    player1Id,
    player2Id,
    player1SelectedIds: [dudugera.id, adaro.id],
    player2SelectedIds: [adaro.id, dudugera.id],
  });
  baseGameState.players[0].hand = [createTestKnowledge('terrestrial1'), createTestKnowledge('aquatic2')];
  baseGameState.players[1].hand = [createTestKnowledge('aerial1')];
  baseGameState.market = [
    createTestKnowledge('aerial1'),
    createTestKnowledge('aerial2'),
    createTestKnowledge('aerial3'),
    createTestKnowledge('aquatic1'),
    createTestKnowledge('terrestrial1')
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
    const marketCard = baseGameState.market[0]; // Get a card from the market
    if (!marketCard || !marketCard.instanceId) throw new Error("Test setup failed: market card missing");
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: marketCard.id, instanceId: marketCard.instanceId } };
    expect(isValidAction(baseGameState, action).isValid).toBe(true);
  });

  it('should return false for DRAW_KNOWLEDGE if hand is full', () => {
    baseGameState.players[0].hand = [
        createTestKnowledge('terrestrial1'),
        createTestKnowledge('aquatic2'),
        createTestKnowledge('aerial1'),
        createTestKnowledge('aerial2'),
        createTestKnowledge('aerial3')
    ];
    const marketCard = baseGameState.market[0];
    if (!marketCard || !marketCard.instanceId) throw new Error("Test setup failed: market card missing");
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: marketCard.id, instanceId: marketCard.instanceId } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return false for DRAW_KNOWLEDGE if card not in market', () => {
    const nonExistentInstanceId = uuidv4();
    const action: GameAction = { type: 'DRAW_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: 'aerial1', instanceId: nonExistentInstanceId } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
    expect(isValidAction(baseGameState, action).reason).toContain('not in market');
  });

  it('should return false for DRAW_KNOWLEDGE if market is empty', () => {
    const state = createInitialTestState({
      currentPlayerIndex: 0,
      phase: 'action',
      market: [],
      players: [
        { ...createInitialTestState().players[0], id: 'player1', hand: [] },
        createInitialTestState().players[1],
      ],
    });
    const action: GameAction = {
      type: 'DRAW_KNOWLEDGE',
      payload: { playerId: 'player1', knowledgeId: 'aerial1', instanceId: uuidv4() }, // Added instanceId
    };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toBe('Market is empty');
  });

  it('should return true for a valid SUMMON_KNOWLEDGE action', () => {
    baseGameState.players[0].creatures[0].currentWisdom = 5;
    baseGameState.players[0].field[0].knowledge = null;
    const knowledgeToSummon = createTestKnowledge(aquatic2.id);
    if (!knowledgeToSummon.instanceId) throw new Error("Test setup failed: knowledge instanceId missing");
    baseGameState.players[0].hand = [knowledgeToSummon];
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: knowledgeToSummon.id, creatureId: dudugera.id, instanceId: knowledgeToSummon.instanceId } };
    expect(isValidAction(baseGameState, action).isValid).toBe(true);
  });

  it('should return false for SUMMON_KNOWLEDGE if insufficient wisdom', () => {
    const knowledgeToSummon = createTestKnowledge(aquatic2.id);
    if (!knowledgeToSummon.instanceId) throw new Error("Test setup failed: knowledge instanceId missing");
    baseGameState.players[0].hand = [knowledgeToSummon];
    // Ensure target creature (adaro) has 0 wisdom for this test
    const adaroCreature = baseGameState.players[0].creatures.find(c => c.id === adaro.id);
    if (adaroCreature) adaroCreature.currentWisdom = 0;

    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: knowledgeToSummon.id, creatureId: adaro.id, instanceId: knowledgeToSummon.instanceId } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return false for SUMMON_KNOWLEDGE if knowledge not in hand', () => {
    const knowledgeNotInHand = createTestKnowledge(aerial1.id);
    if (!knowledgeNotInHand.instanceId) throw new Error("Test setup failed: knowledge instanceId missing");
    baseGameState.players[0].hand = [createTestKnowledge(aquatic2.id)]; // Ensure the card is not in hand
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: knowledgeNotInHand.id, creatureId: dudugera.id, instanceId: knowledgeNotInHand.instanceId } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return false for SUMMON_KNOWLEDGE if creature already has knowledge', () => {
    baseGameState.players[0].field[0].knowledge = createTestKnowledge(terrestrial1.id);
    const knowledgeToSummon = createTestKnowledge(aquatic2.id);
    if (!knowledgeToSummon.instanceId) throw new Error("Test setup failed: knowledge instanceId missing");
    baseGameState.players[0].hand = [knowledgeToSummon];
    const action: GameAction = { type: 'SUMMON_KNOWLEDGE', payload: { playerId: player1Id, knowledgeId: knowledgeToSummon.id, creatureId: dudugera.id, instanceId: knowledgeToSummon.instanceId } };
    expect(isValidAction(baseGameState, action).isValid).toBe(false);
  });

  it('should return false for SUMMON_KNOWLEDGE if the slot is blocked by aquatic3', () => {
    const knowledgeInHand = createTestKnowledge('terrestrial1');
    if (!knowledgeInHand.instanceId) throw new Error("Test setup failed: knowledge instanceId missing");
    const state = createInitialTestState({
      currentPlayerIndex: 0,
      phase: 'action',
      players: [
        {
          ...createInitialTestState().players[0],
          id: 'player1',
          hand: [knowledgeInHand],
          creatures: [{ ...findCreature('dudugera')!, currentWisdom: 5, rotation: 0 }],
          field: [{ creatureId: 'dudugera', knowledge: null }],
        },
        {
          ...createInitialTestState().players[1],
          id: 'player2',
          creatures: [{ ...findCreature('pele')!, currentWisdom: 3, rotation: 0 }],
          field: [{ creatureId: 'pele', knowledge: null }],
        },
      ],
    });
    state.blockedSlots = { 0: [], 1: [0] }; // Player 1 (index 0) is blocked by Player 2 (index 1)

    const action: GameAction = {
      type: 'SUMMON_KNOWLEDGE',
      payload: {
        playerId: 'player1',
        knowledgeId: knowledgeInHand.id,
        instanceId: knowledgeInHand.instanceId,
        creatureId: 'dudugera',
      },
    };
    const result = isValidAction(state, action);
    expect(result.isValid).toBe(false);
    expect(result.reason).toContain('blocked by an opponent\'s aquatic3 effect');
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
    const action: GameAction = { type: 'INITIALIZE_GAME', payload: { gameId: 'newGame', player1Id: 'pA', player2Id: 'pB', player1SelectedIds: [], player2SelectedIds: [] } };
    expect(isValidAction(baseGameState, action).isValid).toBe(true);
  });

  it('should return false if action payload is malformed or missing playerId', () => {
    const actionMissingPlayerId: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player1Id, creatureId: dudugera.id } };
    const actionWrongPayloadType: GameAction = { type: 'ROTATE_CREATURE', payload: { playerId: player1Id } as any };
    expect(isValidAction(baseGameState, actionMissingPlayerId).isValid).toBe(true);
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
    baseGameState = initializeGame({
      gameId: 'testGame',
      player1Id,
      player2Id,
      player1SelectedIds: [dudugera.id, adaro.id],
      player2SelectedIds: [adaro.id, dudugera.id],
    });
    baseGameState.players[0].field = [
      { creatureId: dudugera.id, knowledge: createTestKnowledge(terrestrial1.id, { rotation: 0 }) },
      { creatureId: adaro.id, knowledge: createTestKnowledge(aquatic2.id, { rotation: 270 }) },
    ];
    baseGameState.players[1].field = [
      { creatureId: adaro.id, knowledge: createTestKnowledge(aerial1.id, { rotation: 0 }) },
    ];
    baseGameState.phase = 'knowledge';
  });

  it('should rotate knowledge cards correctly by 90 degrees', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.players[0].field[0].knowledge?.rotation).toBe(90);
    expect(newState.players[1].field[0].knowledge?.rotation).toBe(90);
  });

  it('should discard knowledge cards that reach maxRotations * 90 degrees', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.players[0].field[1].knowledge).toBeNull();
    expect(newState.discardPile.some(k => k.id === aquatic2.id)).toBe(true);

    baseGameState.players[1].field[0].knowledge!.rotation = 90;
    const newState2 = executeKnowledgePhase(baseGameState);
    expect(newState2.players[1].field[0].knowledge).toBeNull();
    expect(newState2.discardPile.some(k => k.id === aerial1.id)).toBe(true);

    baseGameState.players[0].field[0].knowledge!.rotation = 180;
    const newState3 = executeKnowledgePhase(baseGameState);
    expect(newState3.players[0].field[0].knowledge).toBeNull();
    expect(newState3.discardPile.some(k => k.id === terrestrial1.id)).toBe(true);
  });

  it('should transition phase to "action" and reset actionsTakenThisTurn', () => {
    const newState = executeKnowledgePhase(baseGameState);
    expect(newState.phase).toBe('action');
    expect(newState.actionsTakenThisTurn).toBe(0);
  });

  it('aquatic5: should grant extra action next turn on final rotation and log', () => {
    const knowledgeCard = createTestKnowledge('aquatic5', { rotation: 270 });
    baseGameState.players[0].field[0].knowledge = knowledgeCard;

    const stateAfterKnowledge = executeKnowledgePhase(baseGameState);

    expect((stateAfterKnowledge as any).extraActionsNextTurn).toBeDefined();
    expect((stateAfterKnowledge as any).extraActionsNextTurn?.[0]).toBe(1);
    expect(stateAfterKnowledge.log.some(l => l.includes(`Grants 1 extra action for next turn`))).toBe(true);
    expect(stateAfterKnowledge.players[0].field[0].knowledge).toBeNull();
  });

  it('aquatic5: should NOT grant extra action on non-final rotation', () => {
    const knowledgeCard = createTestKnowledge('aquatic5', { rotation: 180 });
    baseGameState.players[0].field[0].knowledge = knowledgeCard;

    const stateAfterKnowledge = executeKnowledgePhase(baseGameState);

    expect((stateAfterKnowledge as any).extraActionsNextTurn?.[0] ?? 0).toBe(0);
    expect(stateAfterKnowledge.log.some(l => l.includes(`Grants 1 extra action`))).toBe(false);
    expect(stateAfterKnowledge.players[0].field[0].knowledge?.rotation).toBe(270);
  });
});

describe('executeKnowledgePhase - Effects', () => {
  let baseGameState: GameState;

  beforeEach(() => {
    baseGameState = createInitialTestState({
      turn: 1,
      phase: 'knowledge',
      players: [
        {
          ...createInitialTestState().players[0],
          id: 'player1',
          power: 10,
          creatures: [
            { ...findCreature('dudugera'), currentWisdom: 3, rotation: 0 },
            { ...findCreature('adaro'), currentWisdom: 2, rotation: 90 },
          ],
          field: [
            { creatureId: 'dudugera', knowledge: null },
            { creatureId: 'adaro', knowledge: null },
          ],
          hand: [],
        },
        {
          ...createInitialTestState().players[1],
          id: 'player2',
          power: 10,
          creatures: [
            { ...findCreature('pele'), currentWisdom: 4, rotation: 0 },
            { ...findCreature('kappa'), currentWisdom: 1, rotation: 180 },
          ],
          field: [
            { creatureId: 'pele', knowledge: null },
            { creatureId: 'kappa', knowledge: null },
          ],
          hand: [createTestKnowledge('aerial1'), createTestKnowledge('aerial2')],
        },
      ],
      market: [createTestKnowledge('aquatic1'), createTestKnowledge('terrestrial3')],
      knowledgeDeck: [createTestKnowledge('aerial5'), createTestKnowledge('aquatic5')],
      discardPile: [],
    });
  });

  it('aquatic1: should rotate another knowledge card and trigger its effect immediately', () => {
    const aquatic1Card = createTestKnowledge('aquatic1'); // maxRotations: 1
    const aerial2Card = createTestKnowledge('aerial2', { rotation: 90 }); // maxRotations: 3
    const discardedAerial2InstanceId = aerial2Card.instanceId; // Store for later check

    const initialState = createInitialTestState({
      players: [
        {
          ...createInitialTestState().players[0],
          id: 'player1',
          power: 20,
          field: [
            { creatureId: 'adaro', knowledge: { ...aquatic1Card, rotation: 0 } },
            { creatureId: 'dudugera', knowledge: aerial2Card }, // Starts at 90
          ],
        },
        {
          ...createInitialTestState().players[1],
          id: 'player2',
          power: 20,
          field: [
            { creatureId: 'pele', knowledge: null }, // No knowledge for opponent
            { creatureId: 'kappa', knowledge: null }, // No knowledge for opponent
          ],
        },
      ],
      discardPile: [],
    });

    const stateAfterKnowledge = executeKnowledgePhase(initialState);

    // Check rotation and discard
    expect(stateAfterKnowledge.players[0].field[0].knowledge).toBeNull(); // aquatic1 discarded
    expect(stateAfterKnowledge.players[0].field[1].knowledge).toBeNull(); // aerial2 discarded

    // Check power gain - aerial2's 180 effect (+3 power) should have triggered before it was discarded
    expect(stateAfterKnowledge.players[0].power).toBe(23); // 20 + 3

    // Check discard pile
    expect(stateAfterKnowledge.discardPile.some(k => k.instanceId === aquatic1Card.instanceId)).toBe(true);
    expect(stateAfterKnowledge.discardPile.some(k => k.instanceId === discardedAerial2InstanceId)).toBe(true);

    // Check opponent power (should be unchanged)
    expect(stateAfterKnowledge.players[1].power).toBe(20);
  });

  it('aquatic5: should grant extra action next turn on final rotation and log', () => {
    const knowledgeCard = createTestKnowledge('aquatic5', { rotation: 270 });
    baseGameState.players[0].field[0].knowledge = knowledgeCard;

    const stateAfterKnowledge = executeKnowledgePhase(baseGameState);

    expect((stateAfterKnowledge as any).extraActionsNextTurn).toBeDefined();
    expect((stateAfterKnowledge as any).extraActionsNextTurn?.[0]).toBe(1);
    expect(stateAfterKnowledge.log.some(l => l.includes(`Grants 1 extra action for next turn`))).toBe(true);
    expect(stateAfterKnowledge.players[0].field[0].knowledge).toBeNull();
  });

  it('aquatic5: should NOT grant extra action on non-final rotation', () => {
    const knowledgeCard = createTestKnowledge('aquatic5', { rotation: 180 });
    baseGameState.players[0].field[0].knowledge = knowledgeCard;

    const stateAfterKnowledge = executeKnowledgePhase(baseGameState);

    expect((stateAfterKnowledge as any).extraActionsNextTurn?.[0] ?? 0).toBe(0);
    expect(stateAfterKnowledge.log.some(l => l.includes(`Grants 1 extra action`))).toBe(false);
    expect(stateAfterKnowledge.players[0].field[0].knowledge?.rotation).toBe(270);
  });
});

describe('executeKnowledgePhase - damage/defense resolution', () => {
  it('accumulates multiple effects and applies net damage correctly', () => {
    const testState = JSON.parse(JSON.stringify(baseGameState));

    testState.players[0].field = [
      { creatureId: dudugera.id, knowledge: { ...terrestrial1, id: 'terrestrial1', name: 'Terr1', rotation: 0, element: 'earth', maxRotations: 3 } },
    ];
    testState.players[1].field = [
      { creatureId: adaro.id, knowledge: { ...aquatic2, id: 'aquatic2', name: 'Aqua2', rotation: 0, element: 'water', maxRotations: 4 } },
    ];
    testState.players[0].power = 20;
    testState.players[1].power = 20;
    testState.phase = 'knowledge';

    const newState = executeKnowledgePhase(testState);

    expect(newState.players[1].power).toBe(20);
    expect(newState.players[0].power).toBe(20);
  });

  it('does not apply negative net damage when defense exceeds damage', () => {
    const testState = JSON.parse(JSON.stringify(baseGameState));

    testState.players[0].field = [];
    testState.players[1].field = [
      { creatureId: adaro.id, knowledge: { id: 'defenseCard', name: 'Defend', rotation: 0, element: 'earth', cost: 1, effect: 'Grants 5 defense', maxRotations: 1 } },
    ];
    testState.players[0].power = 20;
    testState.players[1].power = 20;
    testState.phase = 'knowledge';

    const newState = executeKnowledgePhase(testState);

    expect(newState.players[0].power).toBe(20);
    expect(newState.players[1].power).toBe(20);
  });
});
