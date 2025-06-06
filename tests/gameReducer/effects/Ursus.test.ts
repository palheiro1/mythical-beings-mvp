import { describe, it, expect, beforeEach } from 'vitest';
import { knowledgeEffects } from '../../../src/game/effects';
import { GameState, Knowledge, PlayerState } from '../../../src/game/types';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';

describe('Ursus (terrestrial1) Effect', () => {
  let initialState: GameState;
  let ursusCard: Knowledge;
  const p1Id = 'player1';
  const p2Id = 'player2';
  const p1CreatureId = 'adaro'; // Assume Adaro is at index 0 for P1
  const p2CreatureId = 'pele';  // Assume Pele is at index 0 for P2
  const fieldSlotIndex = 0; // Both creatures are in the first slot

  beforeEach(() => {
    // Ensure creatures are in the first slot for consistent testing
    initialState = createInitialTestState('ursus-test', [p1CreatureId], [p2CreatureId]);
    ursusCard = createTestKnowledge('terrestrial1');

    // Manually ensure field slots correspond to creatures for simplicity
    initialState.players[0].field = [{ creatureId: p1CreatureId, knowledge: null }];
    initialState.players[1].field = [{ creatureId: p2CreatureId, knowledge: null }];

  });

  const placeUrsus = (state: GameState, rotation: number): GameState => {
    const newState = JSON.parse(JSON.stringify(state)); // Deep clone
    const p1Field = newState.players[0].field;
    p1Field[fieldSlotIndex].knowledge = { ...ursusCard, rotation };
    return newState;
  };

  const placeOpponentKnowledge = (state: GameState): GameState => {
    const newState = JSON.parse(JSON.stringify(state)); // Deep clone
    const p2Field = newState.players[1].field;
    p2Field[fieldSlotIndex].knowledge = createTestKnowledge('aerial1'); // Any knowledge card
    return newState;
  };

  it('should deal 1 damage at 0 degrees rotation (opponent has knowledge)', () => {
    let state = placeUrsus(initialState, 0);
    state = placeOpponentKnowledge(state);
    const p2InitialPower = state.players[1].power;

    const result = knowledgeEffects.terrestrial1({
      state,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: state.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });

    expect(result.players[1].power).toBe(p2InitialPower - 1);
    const lastLogEntry = result.log[result.log.length - 1];
    expect(lastLogEntry).toMatch(/Ursus deals 1 damage to player2/);
  });

  it('should deal 2 damage at 0 degrees rotation (opponent has NO knowledge)', () => {
    let state = placeUrsus(initialState, 0);
    // Opponent slot is empty by default in beforeEach
    const p2InitialPower = state.players[1].power;

    const result = knowledgeEffects.terrestrial1({
      state,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: state.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 0,
      isFinalRotation: false,
      trigger: 'onPhase',
    });

    expect(result.players[1].power).toBe(p2InitialPower - 2);
    const lastLogEntry = result.log[result.log.length - 1];
    expect(lastLogEntry).toMatch(/Ursus deals 2 damage to player2/);
  });

  it('should deal 0 damage at 90 degrees rotation', () => {
    let state = placeUrsus(initialState, 90);
    // Doesn't matter if opponent has knowledge or not
    const p2InitialPower = state.players[1].power;

    const result = knowledgeEffects.terrestrial1({
      state,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: state.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 90,
      isFinalRotation: false,
      trigger: 'onPhase',
    });

    expect(result.players[1].power).toBe(p2InitialPower);
    const lastLogEntry = result.log[result.log.length - 1];
    expect(lastLogEntry).toMatch(/Ursus causes no damage this rotation/);
  });

  it('should deal 2 damage at 180 degrees rotation (opponent has knowledge)', () => {
    let state = placeUrsus(initialState, 180);
    state = placeOpponentKnowledge(state);
    const p2InitialPower = state.players[1].power;

    const result = knowledgeEffects.terrestrial1({
      state,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: state.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 180,
      isFinalRotation: false, // Assuming not final rotation for this test
      trigger: 'onPhase',
    });

    expect(result.players[1].power).toBe(p2InitialPower - 2);
    const lastLogEntry = result.log[result.log.length - 1];
    expect(lastLogEntry).toMatch(/Ursus deals 2 damage to player2/);
  });

  it('should deal 3 damage at 180 degrees rotation (opponent has NO knowledge)', () => {
    let state = placeUrsus(initialState, 180);
    // Opponent slot is empty
    const p2InitialPower = state.players[1].power;

    const result = knowledgeEffects.terrestrial1({
      state,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: state.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 180,
      isFinalRotation: false,
      trigger: 'onPhase',
    });

    expect(result.players[1].power).toBe(p2InitialPower - 3);
    const lastLogEntry = result.log[result.log.length - 1];
    expect(lastLogEntry).toMatch(/Ursus deals 3 damage to player2/);
  });

  // Optional: Test for 270 degrees if it should do nothing
  it('should deal 0 damage at 270 degrees rotation', () => {
    let state = placeUrsus(initialState, 270);
    const p2InitialPower = state.players[1].power;

    const result = knowledgeEffects.terrestrial1({
      state,
      playerIndex: 0,
      fieldSlotIndex,
      knowledge: state.players[0].field[fieldSlotIndex].knowledge!,
      rotation: 270,
      isFinalRotation: true, // Assuming 270 is final rotation
      trigger: 'onPhase',
    });

    expect(result.players[1].power).toBe(p2InitialPower);
    const lastLogEntry = result.log[result.log.length - 1];
    expect(lastLogEntry).toMatch(/Ursus causes no damage this rotation/);
  });
});
