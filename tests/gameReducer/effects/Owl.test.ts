import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const owlKnowledge = knowledges.find(k => k.id === 'aerial3') as Knowledge;
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Owl (aerial3) Effect', () => {
  let gameState: GameState;
  beforeEach(() => {
    gameState = createInitialTestState('owl-test', [p1CreatureId], [p2CreatureId]);
    // Place Owl on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...owlKnowledge, instanceId: 'owl1', rotation: 0 };
    gameState.players[0].power = 20;
    gameState.players[1].power = 20;
    gameState.players[0].creatures[0].baseWisdom = 2;
    gameState.players[0].creatures[0].currentWisdom = 2;
    gameState.log = [];
  });

  it('should deal 1 damage at 0º rotation', () => {
    const result = knowledgeEffects.aerial3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 0 },
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(19);
    expect(result.log.some(log => log.includes('Owl deals 1 damage (Rotation: 0º)'))).toBe(true);
  });

  it('should deal 1 damage at 90º rotation', () => {
    const result = knowledgeEffects.aerial3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 90 },
      rotation: 90,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(19);
    expect(result.log.some(log => log.includes('Owl deals 1 damage (Rotation: 90º)'))).toBe(true);
  });

  it('should deal 2 damage at 180º rotation', () => {
    const result = knowledgeEffects.aerial3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 180 },
      rotation: 180,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(18);
    expect(result.log.some(log => log.includes('Owl deals 2 damage (Rotation: 180º)'))).toBe(true);
  });

  it('should grant +1 wisdom to all your creatures while in play', () => {
    const result = knowledgeEffects.aerial3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 0 },
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[0].creatures[0].currentWisdom).toBe(3);
    expect(result.log.some(log => log.includes('Owl: While in play, all your creatures gain +1 Wisdom.'))).toBe(true);
  });

  it('should remove wisdom buff on final rotation', () => {
    // First, apply the buff
    let result = knowledgeEffects.aerial3({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 0 },
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    // Now, simulate final rotation
    result = knowledgeEffects.aerial3({
      state: result,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...result.players[0].field[fieldSlotIndex].knowledge!, rotation: 180 },
      rotation: 180,
      isFinalRotation: true,
      trigger: 'onPhase',
    });
    expect(result.players[0].creatures[0].currentWisdom).toBe(2);
    expect(result.log.some(log => log.includes('Owl: Wisdom buff removed.'))).toBe(true);
  });
});
