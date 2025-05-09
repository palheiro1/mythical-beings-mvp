// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/tsenehale.test.ts
import { describe, it, expect } from 'vitest';
import { GameState, Knowledge } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import { executeKnowledgePhase } from '../../../src/game/rules';

describe('Tsenehale Passive', () => {
  it('should give owner +1 Power when air knowledge on Tsenehale is discarded by rotation', () => {
    const p1Id = 'player1';
    const p2Id = 'player2';
    // P1 has Tsenehale, P2 has Pele
    const initialState = createInitialTestState('tsenehale-rotation', ['tsenehale'], ['pele']);
    const airKnowledge = createTestKnowledge('aerial1', { cost: 1 });
    // Place air knowledge on Tsenehale at max rotation (will be discarded)
    const tsenehaleField = initialState.players[0].field.find(f => f.creatureId === 'tsenehale');
    if (!tsenehaleField) throw new Error('Tsenehale field not found');
    tsenehaleField.knowledge = { ...airKnowledge, rotation: 270, maxRotations: 4 };
    const initialPower = initialState.players[0].power;
    // Execute knowledge phase (should rotate and discard)
    const result = executeKnowledgePhase(initialState);
    expect(result.players[0].power).toBe(initialPower + 1);
    expect(result.discardPile.some(k => k.instanceId === airKnowledge.instanceId)).toBe(true);
    expect(result.players[0].field.find(f => f.creatureId === 'tsenehale')?.knowledge).toBeNull();
  });

  it('should NOT give power if non-air knowledge is discarded from Tsenehale', () => {
    const p1Id = 'player1';
    const initialState = createInitialTestState('tsenehale-nonair', ['tsenehale'], ['pele']);
    const earthKnowledge = createTestKnowledge('terrestrial1', { cost: 1 });
    const tsenehaleField = initialState.players[0].field.find(f => f.creatureId === 'tsenehale');
    if (!tsenehaleField) throw new Error('Tsenehale field not found');
    tsenehaleField.knowledge = { ...earthKnowledge, rotation: 270, maxRotations: 4 };
    const initialPower = initialState.players[0].power;
    const result = executeKnowledgePhase(initialState);
    expect(result.players[0].power).toBe(initialPower);
    expect(result.discardPile.some(k => k.instanceId === earthKnowledge.instanceId)).toBe(true);
    expect(result.players[0].field.find(f => f.creatureId === 'tsenehale')?.knowledge).toBeNull();
  });

  it('should NOT give power if air knowledge is rotated but not discarded', () => {
    const p1Id = 'player1';
    const initialState = createInitialTestState('tsenehale-rotatenotdiscard', ['tsenehale'], ['pele']);
    const airKnowledge = createTestKnowledge('aerial1', { cost: 1 });
    const tsenehaleField = initialState.players[0].field.find(f => f.creatureId === 'tsenehale');
    if (!tsenehaleField) throw new Error('Tsenehale field not found');
    tsenehaleField.knowledge = { ...airKnowledge, rotation: 180, maxRotations: 4 };
    const initialPower = initialState.players[0].power;
    const result = executeKnowledgePhase(initialState);
    expect(result.players[0].power).toBe(initialPower);
    expect(result.players[0].field.find(f => f.creatureId === 'tsenehale')?.knowledge).not.toBeNull();
  });
});