import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const chiropterKnowledge = knowledges.find(k => k.id === 'aerial4') as Knowledge;
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Chiropter (aerial4) Effect', () => {
  let gameState: GameState;
  beforeEach(() => {
    gameState = createInitialTestState('chiropter-test', [p1CreatureId], [p2CreatureId]);
    // Place Chiropter on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...chiropterKnowledge, instanceId: 'chiropter1', rotation: 0 };
    gameState.players[0].power = 20;
    gameState.players[1].power = 20;
    gameState.log = [];
  });

  it('should deal 1 damage and gain 1 power at 0º rotation', () => {
    const result = knowledgeEffects.aerial4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 0 },
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(19);
    expect(result.players[0].power).toBe(21);
    expect(result.log.some(log => log.includes('deals 1 damage') && log.includes('Chiropter'))).toBe(true);
    expect(result.log.some(log => log.includes('grants 1 power to') && log.includes('Chiropter'))).toBe(true);
  });

  it('should deal 2 damage and gain 2 power at 90º rotation', () => {
    const result = knowledgeEffects.aerial4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 90 },
      rotation: 90,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(18);
    expect(result.players[0].power).toBe(22);
    expect(result.log.some(log => log.includes('deals 2 damage') && log.includes('Chiropter'))).toBe(true);
    expect(result.log.some(log => log.includes('grants 2 power to') && log.includes('Chiropter'))).toBe(true);
  });

  it('should deal 2 damage and gain 2 power at 180º rotation', () => {
    const result = knowledgeEffects.aerial4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 180 },
      rotation: 180,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(18);
    expect(result.players[0].power).toBe(22);
    expect(result.log.some(log => log.includes('deals 2 damage') && log.includes('Chiropter'))).toBe(true);
    expect(result.log.some(log => log.includes('grants 2 power to') && log.includes('Chiropter'))).toBe(true);
  });

  it('should deal 0 damage and gain 0 power at 270º rotation', () => {
    const result = knowledgeEffects.aerial4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 270 },
      rotation: 270,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(20);
    expect(result.players[0].power).toBe(20);
    expect(result.log.some(log => log.includes('causes no damage or power gain') && log.includes('Chiropter'))).toBe(true);
  });
});
