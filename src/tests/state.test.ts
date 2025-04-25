import { vi } from 'vitest';
// Mock uuid MUST be the very first statement
vi.mock('uuid', () => ({
  v4: vi.fn(),
}));

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
// Corrected import paths and removed unused imports
import { initializeGame, gameReducer } from '../game/state';
import { GameState, GameAction, Creature, Knowledge } from '../game/types';
import creatureData from '../assets/creatures.json';
import knowledgeData from '../assets/knowledges.json';
import { v4 as uuidv4 } from 'uuid'; // Import AFTER the mock

// Helper to find cards
const findCreature = (id: string): Creature | undefined => (creatureData as any[]).find(c => c.id === id);
const findKnowledge = (id: string): Knowledge | undefined => (knowledgeData as any[]).find(k => k.id === id);

// Helper to create knowledge with instanceId
const createTestKnowledge = (id: string, overrides: Partial<Knowledge> = {}): Knowledge => {
  const baseKnowledge = findKnowledge(id);
  if (!baseKnowledge) throw new Error(`Knowledge ${id} not found for test setup`);
  const instanceId = (uuidv4 as ReturnType<typeof vi.fn>)();
  return {
      ...baseKnowledge,
      instanceId: instanceId || `fallback-uuid-${id}-${Math.random()}`,
      rotation: 0,
      ...overrides,
  };
};

// Helper to create a basic test state
const createInitialTestState = (
    gameId: string = 'test-game',
    p1CreatureIds: string[] = ['dudugera', 'adaro'],
    p2CreatureIds: string[] = ['pele', 'kappa'],
    modifications: Partial<GameState> = {}
): GameState => {
    let state = initializeGame({
        gameId,
        player1Id: 'player1',
        player2Id: 'player2',
        player1SelectedIds: p1CreatureIds,
        player2SelectedIds: p2CreatureIds,
    });

    state = { ...state, ...modifications };

    // Apply modifications and cast players back to tuple type
    if (modifications.players) {
        state.players = modifications.players.map(p => ({
            ...p,
            field: p.creatures.map(c => ({ creatureId: c.id, knowledge: null }))
        })) as [any, any]; // Cast to tuple
    } else {
         state.players = state.players.map(p => ({
            ...p,
            field: p.creatures.map(c => ({ creatureId: c.id, knowledge: null }))
        })) as [any, any]; // Cast to tuple
    }

    return state;
};

// Use real IDs from your data
const player1Id = 'player1';
const player2Id = 'player2';
const dudugeraData = findCreature('dudugera');
const adaroData = findCreature('adaro');
const terrestrial1Data = findKnowledge('terrestrial1');
const aquatic2Data = findKnowledge('aquatic2');

if (!dudugeraData || !adaroData || !terrestrial1Data || !aquatic2Data) {
  throw new Error('Required test data not found in creatures.json or knowledges.json');
}

// Mock console methods before each test
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

// Restore console methods after each test
afterEach(() => {
  vi.restoreAllMocks();
});

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
      player1SelectedIds: [dudugeraData.id, adaroData.id],
      player2SelectedIds: [adaroData.id, dudugeraData.id],
    });
  });

  it('should create a game state with correct initial values', () => {
    expect(initialState.gameId).toBe('game1');
    expect(initialState.players).toHaveLength(2);
    expect(initialState.players[0].id).toBe(player1Id);
    expect(initialState.players[1].id).toBe(player2Id);
    expect(initialState.players[0].creatures[0].id).toBe(dudugeraData.id);
    expect(initialState.players[1].creatures[0].id).toBe(adaroData.id);
    expect(initialState.market.length).toBeGreaterThan(0);
    expect(initialState.knowledgeDeck.length).toBeGreaterThan(0);
    expect(initialState.turn).toBe(1);
    expect(['knowledge', 'action']).toContain(initialState.phase);
    expect(initialState.winner).toBeNull();
  });

   it('should assign unique instanceIds to all knowledge cards in market and deck', () => {
    const allInstanceIds = new Set<string>();
    let totalCards = 0;
    let missingId = false;

    const checkCard = (card: Knowledge | null | undefined) => {
      if (card) {
        totalCards++;
        if (!card.instanceId || typeof card.instanceId !== 'string') {
          missingId = true;
          console.error("Card missing instanceId:", card);
        } else {
          if (allInstanceIds.has(card.instanceId)) {
             console.error("Duplicate instanceId found:", card.instanceId, card);
             missingId = true;
          }
          allInstanceIds.add(card.instanceId);
        }
      }
    };

    initialState.market.forEach(checkCard);
    initialState.knowledgeDeck.forEach(checkCard);
    initialState.players.forEach(p => p.hand.forEach(checkCard));

    expect(missingId).toBe(false);
    expect(allInstanceIds.size).toBe(totalCards);
    expect(totalCards).toBe(initialState.market.length + initialState.knowledgeDeck.length);
    expect(totalCards).toBeGreaterThan(5);
  });
});

describe('gameReducer basic actions', () => {
  let state: GameState;
  let mockCounter: number;

  beforeEach(() => {
    mockCounter = 0;
    (uuidv4 as ReturnType<typeof vi.fn>).mockImplementation(() => `basic-action-uuid-${mockCounter++}`);

    state = createInitialTestState('game2', [dudugeraData.id, adaroData.id], [adaroData.id, dudugeraData.id]);
    state.phase = 'action';
    state.currentPlayerIndex = 0;
    state.actionsTakenThisTurn = 0;
  });

  it('should allow Dudugera to summon knowledge without spending an action', () => {
    const knowledgeToSummon = createTestKnowledge(terrestrial1Data.id);
    if (!knowledgeToSummon.instanceId) throw new Error("Test setup failed: knowledge instanceId is undefined");
    state.players[0].hand = [knowledgeToSummon];

    const dudugeraCreature = state.players[0].creatures.find(c => c.id === dudugeraData.id);
    const dudugeraFieldIndex = state.players[0].field.findIndex(f => f.creatureId === dudugeraData.id);

    expect(dudugeraCreature).toBeDefined();
    expect(dudugeraFieldIndex).not.toBe(-1);

    if (!dudugeraCreature || dudugeraFieldIndex === -1) return;

    dudugeraCreature.currentWisdom = knowledgeToSummon.cost;
    state.players[0].field[dudugeraFieldIndex].knowledge = null;

    const summonAction: GameAction = {
      type: "SUMMON_KNOWLEDGE",
      payload: {
        playerId: player1Id,
        knowledgeId: knowledgeToSummon.id,
        instanceId: knowledgeToSummon.instanceId,
        creatureId: dudugeraData.id,
      },
    };
    const stateAfterSummon = gameReducer(state, summonAction);

    expect(stateAfterSummon).not.toBeNull();
    if (!stateAfterSummon) return;

    expect(stateAfterSummon.actionsTakenThisTurn).toBe(0);
    expect(stateAfterSummon.log.some(log => log.includes('[Passive Effect] Dudugera allows summoning'))).toBe(true);

    const dudugeraFieldSlot = stateAfterSummon.players[0].field[dudugeraFieldIndex];
    expect(dudugeraFieldSlot?.knowledge?.id).toBe(knowledgeToSummon.id);
    expect(dudugeraFieldSlot?.knowledge?.instanceId).toBe(knowledgeToSummon.instanceId);
  });
});

describe('gameReducer - Market and Deck Logic', () => {
  let state: GameState;
  let marketCard: Knowledge;
  let deckCard: Knowledge;
  let mockCounter: number;

  beforeEach(() => {
    mockCounter = 0;
    (uuidv4 as ReturnType<typeof vi.fn>).mockImplementation(() => `market-deck-uuid-${mockCounter++}`);

    marketCard = createTestKnowledge('aerial1');
    const marketCard2 = createTestKnowledge('aerial2');
    deckCard = createTestKnowledge('terrestrial1');
    const deckCard2 = createTestKnowledge('aquatic1');

    state = createInitialTestState('market-deck-test', ['dudugera'], ['pele']);

    state.currentPlayerIndex = 0;
    state.phase = 'action';
    state.actionsTakenThisTurn = 0;
    state.market = [marketCard, marketCard2];
    state.knowledgeDeck = [deckCard, deckCard2];
    state.players[0].hand = [];
    state.players[1].hand = [];
  });

  it('should refill market from deck after DRAW_KNOWLEDGE if deck is not empty', () => {
    const initialMarketSize = state.market.length;
    const initialDeckSize = state.knowledgeDeck.length;
    if (!marketCard.instanceId) throw new Error("Test setup failed: marketCard instanceId is undefined");

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

    expect(nextState.players[0].hand).toHaveLength(1);
    expect(nextState.players[0].hand[0].instanceId).toBe(marketCard.instanceId);

    expect(nextState.market).toHaveLength(initialMarketSize);
    expect(nextState.market.some(k => k.instanceId === marketCard.instanceId)).toBe(false);
    expect(nextState.market.some(k => k.instanceId === deckCard.instanceId)).toBe(true);

    expect(nextState.knowledgeDeck).toHaveLength(initialDeckSize - 1);
  });

  it('should NOT refill market after DRAW_KNOWLEDGE if deck is empty', () => {
    state.knowledgeDeck = [];
    const initialMarketSize = state.market.length;
    if (!marketCard.instanceId) throw new Error("Test setup failed: marketCard instanceId is undefined");

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

    expect(nextState.players[0].hand).toHaveLength(1);
    expect(nextState.players[0].hand[0].instanceId).toBe(marketCard.instanceId);

    expect(nextState.market).toHaveLength(initialMarketSize - 1);
    expect(nextState.market.some(k => k.instanceId === marketCard.instanceId)).toBe(false);

    expect(nextState.knowledgeDeck).toHaveLength(0);
  });
});

describe('gameReducer - Passive Abilities', () => {
  let state: GameState;
  let mockCounter: number;

  beforeEach(() => {
    mockCounter = 0;
    (uuidv4 as ReturnType<typeof vi.fn>).mockImplementation(() => `passive-test-uuid-${mockCounter++}`);
  });

  it('Japinunus: should grant +1 power when owner summons air knowledge', () => {
      const japinunusId = 'japinunus';
      const airKnowledgeId = 'aerial1';
      state = createInitialTestState('japinunus-passive-test', [japinunusId, 'adaro'], ['kappa', 'dudugera']);
      state.currentPlayerIndex = 0;
      state.phase = 'action';

      const airKnowledge = createTestKnowledge(airKnowledgeId);
      if (!airKnowledge.instanceId) throw new Error("Test setup failed: airKnowledge instanceId is undefined");
      state.players[0].hand = [airKnowledge];
      const japinunusCreature = state.players[0].creatures.find(c => c.id === japinunusId);
      const japinunusFieldIndex = state.players[0].field.findIndex(f => f.creatureId === japinunusId);
      expect(japinunusCreature).toBeDefined();
      expect(japinunusFieldIndex).not.toBe(-1);
      if (!japinunusCreature || japinunusFieldIndex === -1) throw new Error("Japinunus setup failed");
      japinunusCreature.currentWisdom = airKnowledge.cost;
      const initialPower = state.players[0].power;

      const summonAction: GameAction = {
          type: 'SUMMON_KNOWLEDGE',
          payload: {
              playerId: 'player1',
              knowledgeId: airKnowledge.id,
              instanceId: airKnowledge.instanceId,
              creatureId: japinunusId,
          },
      };

      const newState = gameReducer(state, summonAction);

      expect(newState).not.toBeNull();
      if (!newState) throw new Error("Reducer returned null");

      expect(newState.log.some(l => l.includes('[Passive Effect] Japinunus (Owner: player1) grants +1 Power'))).toBe(true);
      expect(newState.players[0].power).toBe(initialPower + 1);
  });
});