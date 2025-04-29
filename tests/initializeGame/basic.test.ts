import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeGame } from '../../src/game/state';
import type { GameState, Creature, Knowledge } from '../../src/game/types';
import { findCreature, findKnowledge, createInitialTestState } from '../utils/testHelpers';

// Use real IDs from your data
const player1Id = 'player1';
const player2Id = 'player2';
const dudugeraData = findCreature('dudugera')!;
const adaroData = findCreature('adaro')!;
const terrestrial1Data = findKnowledge('terrestrial1')!;
const aquatic2Data = findKnowledge('aquatic2')!;

// testHelpers ensures these exist

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
    vi.spyOn(global, 'crypto', 'get').mockImplementation(() => ({
      randomUUID: () => `init-game-uuid-${mockCounter++}`,
    }));

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
    let missingIdFound = false;
    let duplicateIdFound = false;

    const checkCard = (card: Knowledge | null | undefined, location: string) => {
      if (card) {
        totalCards++;
        if (!card.instanceId || typeof card.instanceId !== 'string') {
          missingIdFound = true;
          console.error(`Card missing instanceId in ${location}:`, card);
        } else {
          if (allInstanceIds.has(card.instanceId)) {
             console.error(`Duplicate instanceId found in ${location}:`, card.instanceId, card);
             duplicateIdFound = true;
          }
          allInstanceIds.add(card.instanceId);
        }
      }
    };

    initialState.market.forEach(card => checkCard(card, 'market'));
    initialState.knowledgeDeck.forEach(card => checkCard(card, 'knowledgeDeck'));
    initialState.players.forEach((p, index) => p.hand.forEach(card => checkCard(card, `player ${index + 1} hand`)));
    initialState.players.forEach((p, index) => p.field.forEach(slot => checkCard(slot.knowledge, `player ${index + 1} field`)));
    initialState.discardPile.forEach(card => checkCard(card, 'discardPile'));

    expect(missingIdFound, 'Found cards missing instanceId').toBe(false);
    expect(duplicateIdFound, 'Found duplicate instanceIds').toBe(false);
    expect(allInstanceIds.size).toBe(totalCards);
    expect(totalCards).toBeGreaterThan(5); // Keep a basic sanity check
  });
});