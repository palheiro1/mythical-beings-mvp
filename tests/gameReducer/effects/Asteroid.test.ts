import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects, calculateDamage } from '../../../src/game/effects';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const aquatic2Knowledge = knowledges.find(k => k.id === 'aquatic2') as Knowledge;
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Aquatic2 (Asteroid) Effect', () => {
  let gameState: GameState;
  beforeEach(() => {
    gameState = createInitialTestState('aquatic2-test', [p1CreatureId], [p2CreatureId]);
    // Place Aquatic2 on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...aquatic2Knowledge, instanceId: 'aq2-1', rotation: 0 };
    // Set initial power
    gameState.players[0].power = 20;
    gameState.players[1].power = 20;
    gameState.log = [];
  });

  it('should provide defense at 0º rotation (no damage dealt)', () => {
    const result = knowledgeEffects.aquatic2({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: gameState.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    // No damage dealt, only defense is provided (handled in calculateDamage when attacked)
    expect(result.players[1].power).toBe(20);
    expect(result.log.some(log => log.includes('causes no damage this rotation') || log.includes('defense'))).toBe(true);
  });

  it('should deal 1 damage at 90º rotation', () => {
    const knowledge = gameState.players[0].field[fieldSlotIndex].knowledge!;
    knowledge.rotation = 90;
    const result = knowledgeEffects.aquatic2({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge,
      rotation: 90,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(19);
    expect(result.log.some(log => log.includes('deals 1 damage'))).toBe(true);
  });

  it('should provide defense at 180º rotation (no damage dealt)', () => {
    const knowledge = gameState.players[0].field[fieldSlotIndex].knowledge!;
    knowledge.rotation = 180;
    const result = knowledgeEffects.aquatic2({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge,
      rotation: 180,
      isFinalRotation: false,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(20);
    expect(result.log.some(log => log.includes('causes no damage this rotation') || log.includes('defense'))).toBe(true);
  });

  it('should deal 1 damage at 270º rotation', () => {
    const knowledge = gameState.players[0].field[fieldSlotIndex].knowledge!;
    knowledge.rotation = 270;
    const result = knowledgeEffects.aquatic2({
      state: gameState,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge,
      rotation: 270,
      isFinalRotation: true,
      trigger: 'onPhase',
    });
    expect(result.players[1].power).toBe(19);
    expect(result.log.some(log => log.includes('deals 1 damage'))).toBe(true);
  });

  it('should provide +1 defense when attacked and opposing slot is empty', () => {
    // Simulate an attack: Asteroid is in fieldSlotIndex 0 for player 0, opponent has no knowledge in slot 0
    // We call calculateDamage directly to test the passive defense
    const attackerKnowledge = createTestKnowledge('terrestrial1');
    const damageAmount = 2;
    // Opponent slot is empty (default in beforeEach)
    const result = calculateDamage(
      gameState,
      0, // targetPlayerIndex (defender, has Asteroid)
      damageAmount,
      1, // sourcePlayerIndex (attacker)
      attackerKnowledge,
      fieldSlotIndex
    );
    // Should reduce damage by 1 (defense)
    expect(result.finalDamage).toBe(1);
    expect(result.logs.some(log => log.includes('Asteroid') && log.includes('+1 defense'))).toBe(true);
  });

  it('should NOT provide defense if opposing slot has knowledge', () => {
    // Place a knowledge in the attacker's slot
    gameState.players[1].field[fieldSlotIndex].knowledge = createTestKnowledge('aerial1');
    const attackerKnowledge = createTestKnowledge('terrestrial1');
    const damageAmount = 2;
    const result = calculateDamage(
      gameState,
      0, // targetPlayerIndex (defender, has Asteroid)
      damageAmount,
      1, // sourcePlayerIndex (attacker)
      attackerKnowledge,
      fieldSlotIndex
    );
    // No defense should be applied
    expect(result.finalDamage).toBe(2);
    expect(result.logs.some(log => log.includes('Asteroid') && log.includes('has knowledge. No defense'))).toBe(true);
  });
});
