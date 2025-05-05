import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { GameState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const earthquakeKnowledge = knowledges.find(k => k.id === 'terrestrial3')!;
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Earthquake (terrestrial3) Effect', () => {
  let gameState: GameState;
  beforeEach(() => {
    gameState = createInitialTestState('earthquake-test', [p1CreatureId], [p2CreatureId]);
    // Place Earthquake on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...earthquakeKnowledge, instanceId: 'eq1', rotation: 0 };
    // Set wisdom for the summoning creature
    const creature = gameState.players[0].creatures.find(c => c.id === p1CreatureId);
    if (!creature) throw new Error('Could not find creature');
    creature.currentWisdom = 3;
    // Set initial power
    gameState.players[0].power = 20;
    gameState.players[1].power = 20;
    gameState.log = [];
  });

  it('should deal damage equal to wisdom on first knowledge phase', () => {
    const wisdom = gameState.players[0].creatures.find(c => c.id === p1CreatureId)!.currentWisdom;
    const result = knowledgeEffects.terrestrial3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(20 - wisdom);
    // Log should mention damage
    expect(result.log.some(log => log.includes('deals') || log.includes('damage'))).toBe(true);
  });

  it('should log and deal 0 damage if wisdom is 0', () => {
    const creature = gameState.players[0].creatures.find(c => c.id === p1CreatureId)!;
    creature.currentWisdom = 0;
    const result = knowledgeEffects.terrestrial3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(20);
    expect(result.log.some(log => log.includes('causes no damage as creature wisdom is 0'))).toBe(true);
  });
});
