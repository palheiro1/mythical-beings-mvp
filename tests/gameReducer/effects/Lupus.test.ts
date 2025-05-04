import { describe, it, expect, beforeEach } from 'vitest'; // Added beforeEach
import { GameState, PlayerState } from '../../../src/game/types';
import { knowledgeEffects } from '../../../src/game/effects';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers'; // Use createInitialTestState and createTestKnowledge
import { Knowledge } from '../../../src/game/types';
import knowledges from '../../../src/assets/knowledges.json';
// Import creatures to ensure IDs are valid (optional but good practice)
// import creatures from '../../../src/assets/creatures.json';

const lupusKnowledge = knowledges.find(k => k.id === 'terrestrial5') as Knowledge;
const opponentTestKnowledge = createTestKnowledge('aerial1'); // Example knowledge

describe('Lupus (terrestrial5) Effect', () => {
  let gameState: GameState;
  const playerIndex = 0;
  const opponentIndex = 1;
  const fieldSlotIndex = 0;
  // Use valid creature IDs from creatures.json
  const p1CreatureId = 'adaro'; // Replace if 'adaro' is not a valid ID
  const p2CreatureId = 'pele';  // Replace if 'pele' is not a valid ID

  beforeEach(() => {
    // Initialize using valid creature IDs
    gameState = createInitialTestState('lupus-test', [p1CreatureId], [p2CreatureId]);

    // Manually ensure field slots correspond to creatures and place Lupus
    // Note: createInitialTestState should already set up the field based on IDs
    // We just need to add the knowledge card
    const playerFieldSlot = gameState.players[playerIndex].field.find(slot => slot.creatureId === p1CreatureId);
    if (playerFieldSlot) {
        playerFieldSlot.knowledge = {
            ...lupusKnowledge,
            instanceId: 'lupus1',
            rotation: 0 // Start at 0 rotation
        };
    } else {
        throw new Error(`Could not find field slot for creature ${p1CreatureId} in beforeEach`);
    }

    // Ensure opponent field is set up (createInitialTestState should handle this)
    const opponentFieldSlot = gameState.players[opponentIndex].field.find(slot => slot.creatureId === p2CreatureId);
     if (!opponentFieldSlot) {
        throw new Error(`Could not find field slot for creature ${p2CreatureId} in beforeEach`);
    }
    opponentFieldSlot.knowledge = null; // Ensure opponent starts with no knowledge in this slot

    // Set initial power if needed (createInitialTestState might set defaults)
    gameState.players[playerIndex].power = 20;
    gameState.players[opponentIndex].power = 20;
    gameState.discardPile = []; // Ensure discard pile is empty
  });

  it('should deal 1 damage at 0 degrees rotation', () => {
    const rotation = 0;
    // Find the correct knowledge instance in the potentially modified state
    const currentKnowledge = gameState.players[playerIndex].field[fieldSlotIndex].knowledge;
    if (!currentKnowledge) throw new Error("Lupus knowledge not found in test setup");

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: currentKnowledge,
      rotation,
      isFinalRotation: false,
    });

    expect(newState.players[opponentIndex].power).toBe(19);
    expect(newState.log.some(log => log.includes('Lupus deals 1 damage (Rotation: 0º)'))).toBe(true);
  });

  it('should deal 1 damage at 90 degrees rotation', () => {
    const rotation = 90;
    const currentKnowledge = gameState.players[playerIndex].field[fieldSlotIndex].knowledge;
    if (!currentKnowledge) throw new Error("Lupus knowledge not found in test setup");
    currentKnowledge.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: currentKnowledge,
      rotation,
      isFinalRotation: false,
    });

    expect(newState.players[opponentIndex].power).toBe(19);
    expect(newState.log.some(log => log.includes('Lupus deals 1 damage (Rotation: 90º)'))).toBe(true);
  });

  it('should deal 2 damage at 180 degrees rotation', () => {
    const rotation = 180;
    const currentKnowledge = gameState.players[playerIndex].field[fieldSlotIndex].knowledge;
    if (!currentKnowledge) throw new Error("Lupus knowledge not found in test setup");
    currentKnowledge.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: currentKnowledge,
      rotation,
      isFinalRotation: false,
    });

    expect(newState.players[opponentIndex].power).toBe(18);
    expect(newState.log.some(log => log.includes('Lupus deals 2 damage (Rotation: 180º)'))).toBe(true);
  });

  it('should deal 3 damage at 270 degrees rotation (final rotation)', () => {
    const rotation = 270;
    const currentKnowledge = gameState.players[playerIndex].field[fieldSlotIndex].knowledge;
    if (!currentKnowledge) throw new Error("Lupus knowledge not found in test setup");
    currentKnowledge.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: currentKnowledge,
      rotation,
      isFinalRotation: true,
    });

    expect(newState.players[opponentIndex].power).toBe(17);
    expect(newState.log.some(log => log.includes('Lupus deals 3 damage (Rotation: 270º)'))).toBe(true);
  });

  it('should discard opponent knowledge on final rotation (270 degrees)', () => {
    const rotation = 270;
    const opponentKnowledgeInstance: Knowledge = { ...opponentTestKnowledge, instanceId: 'oppoK1' };
    // Ensure opponent knowledge is placed in the correct slot
    const opponentFieldSlot = gameState.players[opponentIndex].field.find(slot => slot.creatureId === p2CreatureId);
    if (!opponentFieldSlot) throw new Error(`Could not find field slot for creature ${p2CreatureId} in test`);
    opponentFieldSlot.knowledge = opponentKnowledgeInstance;

    // Set rotation for Lupus
    const playerFieldSlot = gameState.players[playerIndex].field.find(slot => slot.creatureId === p1CreatureId);
    if (!playerFieldSlot || !playerFieldSlot.knowledge) throw new Error("Lupus knowledge not found in test setup");
    playerFieldSlot.knowledge.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex, // Assuming Lupus is still at index 0
      knowledge: playerFieldSlot.knowledge,
      rotation,
      isFinalRotation: true,
    });

    // Find the opponent slot again in the new state to check knowledge
    const opponentSlotAfter = newState.players[opponentIndex].field.find(slot => slot.creatureId === p2CreatureId);
    expect(opponentSlotAfter?.knowledge).toBeNull();

    expect(newState.discardPile).toEqual(expect.arrayContaining([
        expect.objectContaining({ instanceId: 'oppoK1' })
    ]));
    expect(newState.log.some(log => log.includes(`[Final] Lupus attempts to discard opponent knowledge. Discarded ${opponentKnowledgeInstance.name}`))).toBe(true);
    expect(newState.players[opponentIndex].power).toBe(17);
  });

  it('should not discard opponent knowledge if not final rotation', () => {
    const rotation = 180; // Not final
    const opponentKnowledgeInstance: Knowledge = { ...opponentTestKnowledge, instanceId: 'oppoK1' };
    const opponentFieldSlot = gameState.players[opponentIndex].field.find(slot => slot.creatureId === p2CreatureId);
    if (!opponentFieldSlot) throw new Error(`Could not find field slot for creature ${p2CreatureId} in test`);
    opponentFieldSlot.knowledge = opponentKnowledgeInstance;

    const playerFieldSlot = gameState.players[playerIndex].field.find(slot => slot.creatureId === p1CreatureId);
    if (!playerFieldSlot || !playerFieldSlot.knowledge) throw new Error("Lupus knowledge not found in test setup");
    playerFieldSlot.knowledge.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: playerFieldSlot.knowledge,
      rotation,
      isFinalRotation: false, // Not final
    });

    expect(opponentFieldSlot.knowledge).toEqual(opponentKnowledgeInstance);
    expect(newState.discardPile).toEqual([]); // Discard pile should be empty
    expect(newState.log.some(log => log.includes('[Final] Lupus attempts to discard opponent knowledge.'))).toBe(false);
    expect(newState.players[opponentIndex].power).toBe(18);
  });

  it('should handle final rotation discard when opponent has no knowledge', () => {
    const rotation = 270;
    const playerFieldSlot = gameState.players[playerIndex].field.find(slot => slot.creatureId === p1CreatureId);
    if (!playerFieldSlot || !playerFieldSlot.knowledge) throw new Error("Lupus knowledge not found in test setup");
    playerFieldSlot.knowledge.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: playerFieldSlot.knowledge,
      rotation,
      isFinalRotation: true, // Final rotation
    });

    const opponentFieldSlot = newState.players[opponentIndex].field.find(slot => slot.creatureId === p2CreatureId);
    expect(opponentFieldSlot?.knowledge).toBeNull();
    expect(newState.log.some(log => log.includes('[Final] Lupus attempts to discard opponent knowledge. No knowledge cards to discard.'))).toBe(true);
    expect(newState.players[opponentIndex].power).toBe(17);
  });

});