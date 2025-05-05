import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const galapagoKnowledge = knowledges.find(k => k.id === 'aquatic5') as Knowledge;
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Galapago (aquatic5) Effect', () => {
  let gameState: GameState;
  beforeEach(() => {
    gameState = createInitialTestState('galapago-test', [p1CreatureId], [p2CreatureId]);
    // Place Galapago on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...galapagoKnowledge, instanceId: 'galapago1', rotation: 0 };
    gameState.players[0].power = 20;
    gameState.players[1].power = 20;
    gameState.log = [];
    gameState.extraActionsNextTurn = { 0: 0, 1: 0 };
  });

  it('should grant 2 defense at 0º rotation', () => {
    const result = knowledgeEffects.aquatic5({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 0 },
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.log.some(log => log.includes('provides 2 potential defense') && log.includes('Galapago'))).toBe(true);
    // No power change
    expect(result.players[1].power).toBe(20);
  });

  it('should deal 2 damage at 90º rotation', () => {
    const result = knowledgeEffects.aquatic5({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 90 },
      rotation: 90,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(18);
    expect(result.log.some(log => log.includes('Galapago deals 2 damage (Rotation: 90º)'))).toBe(true);
  });

  it('should grant 2 defense at 180º rotation', () => {
    const result = knowledgeEffects.aquatic5({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 180 },
      rotation: 180,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.log.some(log => log.includes('provides 2 potential defense') && log.includes('Galapago'))).toBe(true);
    expect(result.players[1].power).toBe(20);
  });

  it('should deal 2 damage at 270º rotation and grant extra action (final rotation)', () => {
    const result = knowledgeEffects.aquatic5({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 270 },
      rotation: 270,
      isFinalRotation: true,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(18);
    expect(result.log.some(log => log.includes('Galapago deals 2 damage (Rotation: 270º)'))).toBe(true);
    expect(result.extraActionsNextTurn[0]).toBe(1);
    expect(result.log.some(log => log.includes('grants 1 extra action') && log.includes('Galapago'))).toBe(true);
  });
});
