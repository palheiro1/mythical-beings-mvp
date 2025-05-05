import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const delphinidaeKnowledge = knowledges.find(k => k.id === 'aquatic4');
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Delphinidae (aquatic4) Effect', () => {
  let gameState;
  beforeEach(() => {
    gameState = createInitialTestState('delphinidae-test', [p1CreatureId], [p2CreatureId]);
    // Place Delphinidae on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...delphinidaeKnowledge, instanceId: 'delph1', rotation: 0 };
    gameState.log = [];
    // Set up a market with two cards
    gameState.market = [createTestKnowledge('aerial1'), createTestKnowledge('terrestrial1')];
    gameState.players[0].hand = [];
  });

  it('should draw the first card from the market on summon (rotation 0)', () => {
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge,
      rotation: 0,
      trigger: 'onPhase',
    });
    // Player should have drawn the first card
    expect(result.players[0].hand.length).toBe(1);
    expect(result.players[0].hand[0].id).toBe('aerial1');
    // Market should have one less card
    expect(result.market.length).toBe(1);
    // Log should mention drawing
    expect(result.log.some(log => log.includes('Delphinidae attempts to draw from market') && log.includes('Drew'))).toBe(true);
  });

  it('should do nothing if the market is empty on summon', () => {
    gameState.market = [];
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge,
      rotation: 0,
      trigger: 'onPhase',
    });
    expect(result.players[0].hand.length).toBe(0);
    expect(result.market.length).toBe(0);
    expect(result.log.some(log => log.includes('Delphinidae attempts to draw from market') && log.includes('Market is empty'))).toBe(true);
  });

  it('should deal 1 damage at 0º rotation', () => {
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge,
      rotation: 0,
      trigger: 'onPhase',
    });
    // Damage is 1 at 0º (see valueCycle)
    expect(result.log.some(log => log.includes('deals 1 damage'))).toBe(true);
  });

  it('should provide 2 defense at 90º rotation', () => {
    const knowledge = { ...gameState.players[0].field[fieldSlotIndex].knowledge, rotation: 90 };
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge,
      rotation: 90,
      trigger: 'onPhase',
    });
    // Defense is -2 at 90º (see valueCycle)
    expect(result.log.some(log => log.includes('provides 2 potential defense'))).toBe(true);
  });

  it('should deal 1 damage at 180º rotation', () => {
    const knowledge = { ...gameState.players[0].field[fieldSlotIndex].knowledge, rotation: 180 };
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge,
      rotation: 180,
      trigger: 'onPhase',
    });
    expect(result.log.some(log => log.includes('deals 1 damage'))).toBe(true);
  });

  it('should deal 2 damage at 270º rotation', () => {
    const knowledge = { ...gameState.players[0].field[fieldSlotIndex].knowledge, rotation: 270 };
    const result = knowledgeEffects.aquatic4({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge,
      rotation: 270,
      trigger: 'onPhase',
    });
    expect(result.log.some(log => log.includes('deals 2 damage'))).toBe(true);
  });
});
