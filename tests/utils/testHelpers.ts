import { vi } from 'vitest';
import { initializeGame, gameReducer } from '../../src/game/state.ts';
import { GameState, GameAction, Creature, Knowledge } from '../../src/game/types.ts';
import creatureData from '../../src/assets/creatures.json';
import knowledgeData from '../../src/assets/knowledges.json';

// Mock UUID before tests
vi.mock('uuid', () => ({
  // Provide a default deterministic UUID so test cards have defined ids
  v4: vi.fn(() => 'test-uuid'),
}));

export const findCreature = (id: string): Creature | undefined =>
  (creatureData as any[]).find(c => c.id === id);
export const findKnowledge = (id: string): Knowledge | undefined =>
  (knowledgeData as any[]).find(k => k.id === id);

export const createTestKnowledge = (
  id: string,
  overrides: Partial<Knowledge> = {}
): Knowledge => {
  const base = findKnowledge(id);
  if (!base) throw new Error(`Knowledge ${id} not found in data`);
  const instanceId = id; // use id as unique instanceId in tests
  return { ...base, instanceId, rotation: 0, ...overrides };
};

export const createInitialTestState = (
  gameId = 'test-game',
  p1Ids: string[] = ['dudugera', 'adaro'],
  p2Ids: string[] = ['pele', 'kappa'],
  modifications: Partial<GameState> = {}
): GameState => {
  let state = initializeGame({
    gameId,
    player1Id: 'player1',
    player2Id: 'player2',
    player1SelectedIds: p1Ids,
    player2SelectedIds: p2Ids,
  });
  state = { ...state, ...modifications };
  // Ensure proper tuple typing
  state.players = state.players.map(p => ({
    ...p,
    field: p.creatures.map(c => ({ creatureId: c.id, knowledge: null }))
  })) as [any, any];
  return state;
};