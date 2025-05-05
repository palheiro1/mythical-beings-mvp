import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const lepidopteraKnowledge = knowledges.find(k => k.id === 'aerial1') as Knowledge;
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Lepidoptera (aerial1) Effect', () => {
  let gameState: GameState;
  beforeEach(() => {
    gameState = createInitialTestState('lepidoptera-test', [p1CreatureId], [p2CreatureId]);
    // Place Lepidoptera on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...lepidopteraKnowledge, instanceId: 'lepidoptera1', rotation: 0 };
    gameState.players[0].power = 20;
    gameState.players[1].power = 20;
    gameState.log = [];
  });

  it('should deal 1 damage at 0º rotation', () => {
    const result = knowledgeEffects.aerial1({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 0 },
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(19);
    expect(result.log.some(log => log.includes('Lepidoptera deals 1 damage (Rotation: 0º)'))).toBe(true);
  });

  it('should deal 1 damage at 90º rotation', () => {
    const result = knowledgeEffects.aerial1({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 90 },
      rotation: 90,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(19);
    expect(result.log.some(log => log.includes('Lepidoptera deals 1 damage (Rotation: 90º)'))).toBe(true);
  });

  it('should deal 0 damage at 180º rotation', () => {
    const result = knowledgeEffects.aerial1({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 180 },
      rotation: 180,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(20);
    expect(result.log.some(log => log.includes('Lepidoptera causes no damage this rotation'))).toBe(true);
  });
});
