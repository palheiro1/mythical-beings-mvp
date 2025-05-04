import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const fireKnowledge = knowledges.find(k => k.id === 'terrestrial4') as Knowledge;
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Fire (terrestrial4) Effect', () => {
  let gameState: GameState;
  beforeEach(() => {
    gameState = createInitialTestState('fire-test', [p1CreatureId], [p2CreatureId]);
    // Place Fire on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...fireKnowledge, instanceId: 'fire1', rotation: 0 };
    // Set initial power
    gameState.players[0].power = 20;
    gameState.players[1].power = 20;
    gameState.log = [];
  });

  it('should eliminate opponent knowledges with cost 1 or 2', () => {
    // Place two knowledges on opponent: one with cost 1, one with cost 2
    const k1 = createTestKnowledge('aerial1'); // cost 1
    const k2 = createTestKnowledge('aquatic2'); // cost 2
    gameState.players[1].field[0].knowledge = { ...k1, instanceId: 'k1' };
    gameState.players[1].field.push({ creatureId: 'dummy', knowledge: { ...k2, instanceId: 'k2' } });
    // Run effect
    const result = knowledgeEffects.terrestrial4({
      state: gameState,
      playerIndex: 0,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge!,
    });
    // Both should be eliminated
    expect(result.players[1].field[0].knowledge).toBeNull();
    expect(result.players[1].field[1].knowledge).toBeNull();
    // Discard pile should contain both
    expect(result.discardPile.some(k => k.instanceId === 'k1')).toBe(true);
    expect(result.discardPile.some(k => k.instanceId === 'k2')).toBe(true);
    // Log should mention eliminations by name
    expect(result.log.some(log => log.includes('eliminates opponent') && log.includes(k1.name) && log.includes(k2.name))).toBe(true);
  });

  it('should NOT eliminate opponent knowledges with cost 3 or higher', () => {
    // Place a knowledge with cost 3
    const k3 = createTestKnowledge('terrestrial3'); // cost 3
    gameState.players[1].field[0].knowledge = { ...k3, instanceId: 'k3' };
    // Run effect
    const result = knowledgeEffects.terrestrial4({
      state: gameState,
      playerIndex: 0,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge!,
    });
    // Should not be eliminated
    expect(result.players[1].field[0].knowledge).not.toBeNull();
    expect(result.discardPile.some(k => k.instanceId === 'k3')).toBe(false);
    // Log should mention none eliminated
    expect(result.log.some(log => log.includes('eliminates opponent') && log.includes('none'))).toBe(true);
  });

  it('should do nothing if opponent has no knowledges', () => {
    // Ensure opponent field is empty
    gameState.players[1].field.forEach(slot => slot.knowledge = null);
    const result = knowledgeEffects.terrestrial4({
      state: gameState,
      playerIndex: 0,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge!,
    });
    // No changes, discard pile empty
    expect(result.discardPile.length).toBe(0);
    // Log should mention none eliminated
    expect(result.log.some(log => log.includes('eliminates opponent') && log.includes('none'))).toBe(true);
  });
});
