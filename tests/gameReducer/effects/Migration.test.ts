import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { createInitialTestState } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const migrationKnowledge = knowledges.find(k => k.id === 'aerial5');
const p1CreatureId = 'adaro';
const p2CreatureId = 'pele';
const fieldSlotIndex = 0;

describe('Migration (aerial5) Effect', () => {
  let gameState;
  beforeEach(() => {
    gameState = createInitialTestState('migration-test', [p1CreatureId], [p2CreatureId]);
    // Place Migration on player's field
    const playerSlot = gameState.players[0].field.find(s => s.creatureId === p1CreatureId);
    if (!playerSlot) throw new Error('Could not find field slot for creature');
    playerSlot.knowledge = { ...migrationKnowledge, instanceId: 'migration1', rotation: 0 };
    // Set up rival's creatures with nonzero rotation
    gameState.players[1].creatures.forEach(creature => {
      creature.rotation = 90;
      creature.baseWisdom = 2;
      creature.currentWisdom = 2;
    });
    gameState.log = [];
  });

  it('should reduce all rival creatures rotation by 90º (to minimum 0) at 0º rotation', () => {
    const result = knowledgeEffects.aerial5({
      state: gameState,
      playerIndex: 0,
      trigger: 'onPhase',
    });
    result.players[1].creatures.forEach(creature => {
      expect(creature.rotation).toBe(0);
    });
    // Accept both 'Migration' and 'Aerial5' in the log for flexibility
    expect(result.log.some(log => (log.toLowerCase().includes('migration') || log.toLowerCase().includes('aerial5')) && log.toLowerCase().includes('rotated') && log.includes('90º'))).toBe(true);
  });

  it('should not reduce below 0º rotation', () => {
    // Set rival's creatures to 0 rotation
    gameState.players[1].creatures.forEach(creature => {
      creature.rotation = 0;
    });
    const result = knowledgeEffects.aerial5({
      state: gameState,
      playerIndex: 0,
      trigger: 'onPhase',
    });
    result.players[1].creatures.forEach(creature => {
      expect(creature.rotation).toBe(0);
    });
  });
});
