import { describe, it, expect, beforeEach } from 'vitest';
import { initializeGame, gameReducer } from '../src/game/state';
import { GameState, GameAction, PlayerState, Creature, Knowledge } from '../src/game/types';
import * as rules from '../src/game/rules'; // Import all from rules
import * as actions from '../src/game/actions'; // Import all from actions
import * as passives from '../src/game/passives'; // Import passives module
import creatureData from '../src/assets/creatures.json';
import knowledgeData from '../src/assets/knowledges.json';

// Helper to find cards
const findCreature = (id: string) => (creatureData as any[]).find(c => c.id === id);
const findKnowledge = (id: string) => (knowledgeData as any[]).find(k => k.id === id);

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
  let initialState;

  beforeEach(() => {
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
  let state;

  beforeEach(() => {
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
