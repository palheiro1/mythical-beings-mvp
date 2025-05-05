import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, Knowledge } from '../../../src/game/types';
import { knowledgeEffects } from '../../../src/game/effects';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const tsunamiKnowledge = knowledges.find(k => k.id === 'aquatic1') as Knowledge;
const rotatableKnowledge = createTestKnowledge('terrestrial1'); // Example: Ursus

describe('Tsunami (aquatic1) Effect', () => {
  let gameState: GameState;
  const playerIndex = 0;
  const tsunamiSlotIndex = 0; // Where Tsunami is placed
  const targetSlotIndex = 1; // Where the rotatable knowledge is placed
  const p1CreatureId1 = 'adaro';
  const p1CreatureId2 = 'pele'; // Need two creatures for the player
  const p2CreatureId = 'pele'; // Use a valid opponent creature ID

  beforeEach(() => {
    // Use valid creature IDs for both players
    gameState = createInitialTestState('tsunami-test', [p1CreatureId1, p1CreatureId2], [p2CreatureId]);

    // Place Tsunami
    const tsunamiSlot = gameState.players[playerIndex].field.find(s => s.creatureId === p1CreatureId1);
    if (tsunamiSlot) {
        tsunamiSlot.knowledge = { ...tsunamiKnowledge, instanceId: 'tsunami1', rotation: 0 };
    } else {
        throw new Error(`Could not find field slot for creature ${p1CreatureId1}`);
    }

    // Place the target knowledge (Ursus)
    const targetSlot = gameState.players[playerIndex].field.find(s => s.creatureId === p1CreatureId2);
    if (targetSlot) {
        targetSlot.knowledge = { ...rotatableKnowledge, instanceId: 'target1', rotation: 0 };
    } else {
        throw new Error(`Could not find field slot for creature ${p1CreatureId2}`);
    }

    // Ensure field indices match setup if tests rely on index 0 and 1
    // This assumes createInitialTestState places creatures in the order given
    if (gameState.players[playerIndex].field[tsunamiSlotIndex]?.creatureId !== p1CreatureId1 ||
        gameState.players[playerIndex].field[targetSlotIndex]?.creatureId !== p1CreatureId2) {
         console.warn("Field slot indices might not match expected setup in Tsunami test.");
         // Adjust indices based on actual field if necessary, or rely on finding slots by creatureId
    }

    gameState.players[playerIndex].power = 20;
    gameState.players[1].power = 20;
  });

  it('should rotate the first available other knowledge card 90 degrees', () => {
    const initialTargetRotation = gameState.players[playerIndex].field[targetSlotIndex].knowledge!.rotation;

    const newState = knowledgeEffects.aquatic1({
      state: gameState,
      playerIndex,
      fieldSlotIndex: tsunamiSlotIndex, // Tsunami's own slot index
      knowledge: gameState.players[playerIndex].field[tsunamiSlotIndex].knowledge!,
      trigger: 'onPhase',
      // rotation and isFinalRotation are not used by aquatic1
    });

    const targetKnowledgeAfter = newState.players[playerIndex].field[targetSlotIndex].knowledge;
    expect(targetKnowledgeAfter).toBeDefined();
    expect(targetKnowledgeAfter!.rotation).toBe(initialTargetRotation + 90);
    expect(newState.log.some(log => log.includes(`Tsunami rotates ${rotatableKnowledge.name}`))).toBe(true);
    expect(newState.log.some(log => log.includes(`New rotation: ${initialTargetRotation + 90}º`))).toBe(true);
  });

  it('should not rotate itself', () => {
    // Remove the other knowledge card to ensure Tsunami doesn't target itself
    gameState.players[playerIndex].field[targetSlotIndex].knowledge = null;
    const initialTsunamiRotation = gameState.players[playerIndex].field[tsunamiSlotIndex].knowledge!.rotation;

    const newState = knowledgeEffects.aquatic1({
      state: gameState,
      playerIndex,
      fieldSlotIndex: tsunamiSlotIndex,
      knowledge: gameState.players[playerIndex].field[tsunamiSlotIndex].knowledge!,
      trigger: 'onPhase',
    });

    const tsunamiKnowledgeAfter = newState.players[playerIndex].field[tsunamiSlotIndex].knowledge;
    expect(tsunamiKnowledgeAfter!.rotation).toBe(initialTsunamiRotation); // Rotation should be unchanged
    expect(newState.log.some(log => log.includes('Tsunami: No other knowledge cards to rotate.'))).toBe(true);
  });

  it('should not rotate a card that is already at max rotation', () => {
     // Set target knowledge to its actual max rotation value
     // Ursus maxRotations = 3 -> max degrees = 270
    const maxRotationValue = (rotatableKnowledge.maxRotations ?? 4) * 90;
    gameState.players[playerIndex].field[targetSlotIndex].knowledge!.rotation = maxRotationValue;

    const newState = knowledgeEffects.aquatic1({
      state: gameState,
      playerIndex,
      fieldSlotIndex: tsunamiSlotIndex,
      knowledge: gameState.players[playerIndex].field[tsunamiSlotIndex].knowledge!,
      trigger: 'onPhase',
    });

    const targetKnowledgeAfter = newState.players[playerIndex].field[targetSlotIndex].knowledge;
    expect(targetKnowledgeAfter!.rotation).toBe(maxRotationValue); // Rotation should be unchanged
    // Check the log message indicating no cards were available to rotate
    expect(newState.log.some(log => log.includes(`${tsunamiKnowledge.name}: No other knowledge cards to rotate.`))).toBe(true);
  });

   it('should do nothing if there are no other knowledge cards', () => {
    // Remove the other knowledge card
    gameState.players[playerIndex].field[targetSlotIndex].knowledge = null;
    const initialTsunamiRotation = gameState.players[playerIndex].field[tsunamiSlotIndex].knowledge!.rotation;

    const newState = knowledgeEffects.aquatic1({
      state: gameState,
      playerIndex,
      fieldSlotIndex: tsunamiSlotIndex,
      knowledge: gameState.players[playerIndex].field[tsunamiSlotIndex].knowledge!,
      trigger: 'onPhase',
    });

    expect(newState.players[playerIndex].field[tsunamiSlotIndex].knowledge!.rotation).toBe(initialTsunamiRotation);
    expect(newState.players[playerIndex].field.length).toBe(gameState.players[playerIndex].field.length); // No field changes
    expect(newState.log.some(log => log.includes('Tsunami: No other knowledge cards to rotate.'))).toBe(true);
  });

  // TODO: Add test for when Tsunami rotates a card, does that card's effect trigger immediately?
  // This depends on whether the rotation effect itself should trigger effects, which is complex.
  // For now, we only test the rotation itself.

});