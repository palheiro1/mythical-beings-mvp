import { vi } from 'vitest';
// Mock uuid MUST be the very first statement
vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame, gameReducer, injectInstanceIds } from '../src/game/state.js';
import { GameState, GameAction, PlayerState, Creature, Knowledge } from '../src/game/types';
import * as rules from '../src/game/rules.js'; // Import all from rules
import * as actions from '../src/game/actions.js'; // Import all from actions
import * as passives from '../src/game/passives.js'; // Import passives module
import creatureData from '../src/assets/creatures.json';
import knowledgeData from '../src/assets/knowledges.json';
import { v4 as uuidv4 } from 'uuid'; // Import AFTER the mock

// Helper to find cards
const findCreature = (id: string) => (creatureData as any[]).find(c => c.id === id);
const findKnowledge = (id: string) => (knowledgeData as any[]).find(k => k.id === id);

// Helper to create knowledge with instanceId
const createTestKnowledge = (id: string, overrides: Partial<Knowledge> = {}): Knowledge => {
  const baseKnowledge = findKnowledge(id);
  if (!baseKnowledge) throw new Error(`Knowledge ${id} not found for test setup`);
  // Ensure the mock is called correctly
  const instanceId = (uuidv4 as ReturnType<typeof vi.fn>)();
  return { ...baseKnowledge, instanceId: instanceId || `fallback-uuid-${id}-${Math.random()}`, rotation: 0, ...overrides };
};

// Helper to create a basic test state
const createInitialTestState = (modifications: Partial<GameState> = {}): GameState => {
  const baseState = initializeGame({
    gameId: 'test-game',
    player1Id: 'player1',
    player2Id: 'player2',
    player1SelectedIds: ['dudugera', 'adaro'],
    player2SelectedIds: ['pele', 'kappa'],
  });
  // Ensure critical fields have defaults if not provided in modifications
  const mergedState = {
    ...baseState,
    ...modifications,
    players: modifications.players || baseState.players,
    market: modifications.market || baseState.market,
    knowledgeDeck: modifications.knowledgeDeck || baseState.knowledgeDeck,
    discardPile: modifications.discardPile || baseState.discardPile,
    log: modifications.log || baseState.log,
  };
  // Re-inject instance IDs after modifications to ensure consistency
  return injectInstanceIds(mergedState);
}

// Use real IDs from your data
const player1Id = 'player1';
const player2Id = 'player2';
const dudugera = findCreature('dudugera');
const adaro = findCreature('adaro');
const terrestrial1 = findKnowledge('terrestrial1');
const aquatic2 = findKnowledge('aquatic2');

if (!dudugera || !adaro || !terrestrial1 || !aquatic2) {
  throw new Error('Required test data not found in creatures.json or knowledges.json');
}

describe('initializeGame', () => {
  let initialState: GameState;
  let mockCounter: number;

  beforeEach(() => {
    mockCounter = 0;
    (uuidv4 as ReturnType<typeof vi.fn>).mockImplementation(() => `init-game-uuid-${mockCounter++}`);

    initialState = initializeGame({
      gameId: 'game1',
      player1Id,
      player2Id,
      player1SelectedIds: [dudugera.id, adaro.id],
      player2SelectedIds: [adaro.id, dudugera.id],
    });
  });

  it('should create a game state with correct initial values', () => {
    expect(initialState.gameId).toBe('game1');
    expect(initialState.players).toHaveLength(2);
    expect(initialState.players[0].id).toBe(player1Id);
    expect(initialState.players[1].id).toBe(player2Id);
    expect(initialState.players[0].creatures[0].id).toBe(dudugera.id);
    expect(initialState.players[1].creatures[0].id).toBe(adaro.id);
    expect(initialState.market.length).toBeGreaterThan(0);
    expect(initialState.knowledgeDeck.length).toBeGreaterThan(0);
    expect(initialState.turn).toBe(1);
    expect(initialState.phase).toBe('action');
    expect(initialState.winner).toBeNull();
  });
});

describe('gameReducer basic actions', () => {
  let state: GameState;
  let mockCounter: number;

  beforeEach(() => {
    mockCounter = 0;
    (uuidv4 as ReturnType<typeof vi.fn>).mockImplementation(() => `basic-action-uuid-${mockCounter++}`);

    state = initializeGame({
      gameId: 'game2',
      player1Id,
      player2Id,
      player1SelectedIds: [dudugera.id, adaro.id],
      player2SelectedIds: [adaro.id, dudugera.id],
    });
    state.phase = 'action';
    state.currentPlayerIndex = 0;
    state.actionsTakenThisTurn = 0;
    state.players[0].hand = [{ ...terrestrial1, instanceId: 'test-knowledge-instance' }];
    const dudugeraIdx = state.players[0].creatures.findIndex(c => c.id === dudugera.id);
    if (dudugeraIdx !== -1) state.players[0].creatures[dudugeraIdx].currentWisdom = 5;
  });

  it('should allow Dudugera to summon knowledge without spending an action', () => {
    // Ensure Dudugera has enough wisdom and field slot is empty
    state.players[0].creatures[0].currentWisdom = 5;
    state.players[0].field[0].knowledge = null;
    state.players[0].hand = [{ ...terrestrial1, instanceId: 'test-knowledge-instance' }];
    const summonAction: GameAction = {
      type: "SUMMON_KNOWLEDGE",
      payload: {
        playerId: player1Id,
        knowledgeId: terrestrial1.id,
        instanceId: 'test-knowledge-instance',
        creatureId: dudugera.id,
      },
    };
    const stateAfterSummon = gameReducer(state, summonAction);
    expect(stateAfterSummon && stateAfterSummon.actionsTakenThisTurn).toBe(0);
    // Relaxed log assertion: only check for Dudugera passive effect substring
    expect(stateAfterSummon && stateAfterSummon.log.some(log => log.includes('[Passive Effect] Dudugera allows summoning'))).toBe(true);
    const dudugeraFieldSlot = stateAfterSummon && stateAfterSummon.players[0].field.find(f => f.creatureId === dudugera.id);
    expect(dudugeraFieldSlot && dudugeraFieldSlot.knowledge && dudugeraFieldSlot.knowledge.id).toBe(terrestrial1.id);
  });
});

describe('gameReducer - Market and Deck Logic', () => {
  let state: GameState;
  let marketCard: Knowledge;
  let deckCard: Knowledge;

  beforeEach(() => {
    let counter = 0;
    (uuidv4 as ReturnType<typeof vi.fn>).mockImplementation(() => `market-deck-uuid-${counter++}`);

    marketCard = createTestKnowledge('aerial1');
    deckCard = createTestKnowledge('terrestrial1');
    state = createInitialTestState({
      currentPlayerIndex: 0,
      phase: 'action',
      actionsTakenThisTurn: 0,
      market: [marketCard, createTestKnowledge('aerial2')],
      knowledgeDeck: [deckCard, createTestKnowledge('aquatic1')],
      players: [
        { ...createInitialTestState().players[0], id: 'player1', hand: [] },
        createInitialTestState().players[1],
      ],
    });
  });

  it('should refill market from deck after DRAW_KNOWLEDGE if deck is not empty', () => {
    const drawAction: GameAction = {
      type: 'DRAW_KNOWLEDGE',
      payload: {
        playerId: 'player1',
        knowledgeId: marketCard.id,
        instanceId: marketCard.instanceId,
      },
    };

    const nextState = gameReducer(state, drawAction);

    expect(nextState).not.toBeNull();
    if (!nextState) return;

    // Check player hand
    expect(nextState.players[0].hand).toHaveLength(1);
    expect(nextState.players[0].hand[0].instanceId).toBe(marketCard.instanceId);

    // Check market size and content
    expect(nextState.market).toHaveLength(state.market.length); // Should remain same size
    expect(nextState.market.some(k => k.instanceId === marketCard.instanceId)).toBe(false); // Drawn card is gone
    expect(nextState.market.some(k => k.instanceId === deckCard.instanceId)).toBe(true); // Deck card is added

    // Check deck size
    expect(nextState.knowledgeDeck).toHaveLength(state.knowledgeDeck.length - 1);
  });

  it('should NOT refill market after DRAW_KNOWLEDGE if deck is empty', () => {
    state.knowledgeDeck = []; // Empty the deck
    const drawAction: GameAction = {
      type: 'DRAW_KNOWLEDGE',
      payload: {
        playerId: 'player1',
        knowledgeId: marketCard.id,
        instanceId: marketCard.instanceId,
      },
    };

    const nextState = gameReducer(state, drawAction);

    expect(nextState).not.toBeNull();
    if (!nextState) return;

    // Check player hand
    expect(nextState.players[0].hand).toHaveLength(1);
    expect(nextState.players[0].hand[0].instanceId).toBe(marketCard.instanceId);

    // Check market size and content
    expect(nextState.market).toHaveLength(state.market.length - 1); // Should be smaller
    expect(nextState.market.some(k => k.instanceId === marketCard.instanceId)).toBe(false); // Drawn card is gone

    // Check deck size
    expect(nextState.knowledgeDeck).toHaveLength(0);
  });

});
