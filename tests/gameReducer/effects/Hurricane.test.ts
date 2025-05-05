import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const hurricaneKnowledge = knowledges.find(k => k.id === 'aquatic3');
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Hurricane (aquatic3) Effect', () => {
  let gameState;
  beforeEach(() => {
    gameState = createInitialTestState('hurricane-test', [p1CreatureId], [p2CreatureId]);
    // Place Hurricane on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...hurricaneKnowledge, instanceId: 'hurricane1', rotation: 0 };
    gameState.log = [];
    gameState.blockedSlots = { 0: [], 1: [] };
  });

  it('should block opponent from summoning onto the opposing slot while in play', () => {
    // Trigger the effect (simulate knowledge phase)
    const result = knowledgeEffects.aquatic3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      isFinalRotation: false,
    });
    // Opponent's slot 0 should be blocked
    expect(result.blockedSlots[1]).toContain(fieldSlotIndex);
    // Log should mention the block
    expect(result.log.some(log => log.includes('cannot summon knowledge onto the opposing creature'))).toBe(true);
  });

  it('should remove the block when Hurricane leaves play (final rotation)', () => {
    // Simulate block is already present
    gameState.blockedSlots[1] = [fieldSlotIndex];
    // Trigger the effect with isFinalRotation true
    const result = knowledgeEffects.aquatic3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      isFinalRotation: true,
    });
    // Block should be removed
    expect(result.blockedSlots[1]).not.toContain(fieldSlotIndex);
    // Log should mention block removal
    expect(result.log.some(log => log.includes('Block on opponent\'s slot'))).toBe(true);
  });

  it('should not block other slots', () => {
    // Trigger the effect
    const result = knowledgeEffects.aquatic3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      isFinalRotation: false,
    });
    // Only slot 0 should be blocked for opponent
    expect(result.blockedSlots[1]).toEqual([fieldSlotIndex]);
    // Other slots should not be blocked
    expect(result.blockedSlots[1]).not.toContain(1);
    expect(result.blockedSlots[1]).not.toContain(2);
  });

  it('should do nothing if block already present and not final rotation', () => {
    gameState.blockedSlots[1] = [fieldSlotIndex];
    const result = knowledgeEffects.aquatic3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      isFinalRotation: false,
    });
    // Block should still be present, no duplicate
    expect(result.blockedSlots[1].filter(i => i === fieldSlotIndex).length).toBe(1);
  });
});
