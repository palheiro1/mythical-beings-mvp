import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const blueSkyKnowledge = knowledges.find(k => k.id === 'aerial2') as Knowledge;
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Blue Sky (aerial2) Effect', () => {
  let gameState: GameState;
  beforeEach(() => {
    gameState = createInitialTestState('bluesky-test', [p1CreatureId], [p2CreatureId]);
    // Place Blue Sky on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...blueSkyKnowledge, instanceId: 'bluesky1', rotation: 0 };
    gameState.players[0].power = 20;
    gameState.players[1].power = 20;
    gameState.log = [];
  });

  it('should grant 1 power at 0º rotation', () => {
    const result = knowledgeEffects.aerial2({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      rotation: 0,
      trigger: 'onPhase',
    });
    expect(result.players[0].power).toBe(21);
    expect(result.log.some(log => log.includes('gains +1 Power'))).toBe(true);
  });

  it('should grant 2 power at 90º rotation', () => {
    const result = knowledgeEffects.aerial2({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      rotation: 90,
      trigger: 'onPhase',
    });
    expect(result.players[0].power).toBe(22);
    expect(result.log.some(log => log.includes('gains +2 Power'))).toBe(true);
  });

  it('should grant 3 power at 180º rotation', () => {
    const result = knowledgeEffects.aerial2({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      rotation: 180,
      trigger: 'onPhase',
    });
    expect(result.players[0].power).toBe(23);
    expect(result.log.some(log => log.includes('gains +3 Power'))).toBe(true);
  });

  it('should grant 0 power at 270º rotation', () => {
    const result = knowledgeEffects.aerial2({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      rotation: 270,
      trigger: 'onPhase',
    });
    expect(result.players[0].power).toBe(20);
    expect(result.log.some(log => log.includes('gains +'))).toBe(false);
  });
});
