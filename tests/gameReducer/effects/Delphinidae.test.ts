import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const delphinidaeKnowledge = knowledges.find(k => k.id === 'aquatic4') as Knowledge;
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Delphinidae (aquatic4) Effect', () => {
  let gameState: GameState;
  beforeEach(() => {
    gameState = createInitialTestState('delphinidae-test', [p1CreatureId], [p2CreatureId]);
    // Place Delphinidae on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...delphinidaeKnowledge, instanceId: 'delph1', rotation: 0 };
    // Set initial power
    gameState.players[0].power = 20;
    gameState.players[1].power = 20;
    gameState.log = [];
    // Ensure market has cards
    if (gameState.market.length === 0) {
      gameState.market.push(createTestKnowledge('aerial1'));
    }
  });

  it('should draw 1 card from market on apparition (onSummon trigger)', () => {
    const initialHandSize = gameState.players[0].hand.length;
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onSummon',
    });
    expect(result.players[0].hand.length).toBe(initialHandSize + 1);
    expect(result.log.some(log => log.includes('Apparition') && log.includes('Delphinidae'))).toBe(true);
  });

  it('should deal 1 damage at 0º rotation', () => {
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 0 },
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(19);
    expect(result.log.some(log => log.includes('deals 1 damage') && log.includes('Delphinidae'))).toBe(true);
  });

  it('should grant 2 defense at 90º rotation', () => {
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 90 },
      rotation: 90,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.log.some(log => log.includes('provides 2 potential defense') && log.includes('Delphinidae'))).toBe(true);
  });

  it('should deal 1 damage at 180º rotation', () => {
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 180 },
      rotation: 180,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(19);
    expect(result.log.some(log => log.includes('deals 1 damage') && log.includes('Delphinidae'))).toBe(true);
  });

  it('should deal 2 damage at 270º rotation', () => {
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: { ...gameState.players[0].field[fieldSlotIndex].knowledge!, rotation: 270 },
      rotation: 270,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(18);
    expect(result.log.some(log => log.includes('deals 2 damage') && log.includes('Delphinidae'))).toBe(true);
  });

  it('should not draw from market if market is empty on apparition', () => {
    gameState.market = [];
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onSummon',
    });
    expect(result.players[0].hand.length).toBe(gameState.players[0].hand.length);
    expect(result.log.some(log => log.includes('Apparition') && log.includes('empty') && log.includes('Delphinidae'))).toBe(true);
  });
});
