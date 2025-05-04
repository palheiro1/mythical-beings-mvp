import { describe, it, expect } from 'vitest';
import { GameState, PlayerState } from '../../../src/game/types';
import { knowledgeEffects } from '../../../src/game/effects';
import { initializeTestGame } from '../../testHelpers'; // Assuming a helper exists
import { Knowledge } from '../../../src/game/types';
import knowledges from '../../../src/assets/knowledges.json';

const lupusKnowledge = knowledges.find(k => k.id === 'terrestrial5') as Knowledge;

describe('Lupus (terrestrial5) Effect', () => {
  let gameState: GameState;
  const playerIndex = 0;
  const opponentIndex = 1;
  const fieldSlotIndex = 0;

  beforeEach(() => {
    // Initialize a basic game state before each test
    gameState = initializeTestGame({
      player1Hand: [],
      player2Hand: [],
      player1Field: [
        { creatureId: 'p1c1', knowledge: { ...lupusKnowledge, instanceId: 'lupus1', rotation: 0 } }
      ],
      player2Field: [
        { creatureId: 'p2c1', knowledge: null } // Opponent slot
      ],
      player1Power: 20,
      player2Power: 20,
    });
    // Ensure the knowledge card is correctly placed for the test
    gameState.players[playerIndex].field[fieldSlotIndex].knowledge = {
        ...lupusKnowledge,
        instanceId: 'lupus1',
        rotation: 0 // Start at 0 rotation
    };
  });

  it('should deal 1 damage at 0 degrees rotation', () => {
    const rotation = 0;
    gameState.players[playerIndex].field[fieldSlotIndex].knowledge!.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
      rotation,
      isFinalRotation: false,
    });

    expect(newState.players[opponentIndex].power).toBe(19);
    expect(newState.log).toContain(`Lupus deals 1 damage (Rotation: 0º).`);
  });

  it('should deal 1 damage at 90 degrees rotation', () => {
    const rotation = 90;
     gameState.players[playerIndex].field[fieldSlotIndex].knowledge!.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
      rotation,
      isFinalRotation: false,
    });

    expect(newState.players[opponentIndex].power).toBe(19);
    expect(newState.log).toContain(`Lupus deals 1 damage (Rotation: 90º).`);
  });

  it('should deal 2 damage at 180 degrees rotation', () => {
    const rotation = 180;
     gameState.players[playerIndex].field[fieldSlotIndex].knowledge!.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
      rotation,
      isFinalRotation: false,
    });

    expect(newState.players[opponentIndex].power).toBe(18);
    expect(newState.log).toContain(`Lupus deals 2 damage (Rotation: 180º).`);
  });

   it('should deal 3 damage at 270 degrees rotation (final rotation)', () => {
    const rotation = 270;
     gameState.players[playerIndex].field[fieldSlotIndex].knowledge!.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
      rotation,
      isFinalRotation: true, // Mark as final rotation
    });

    expect(newState.players[opponentIndex].power).toBe(17);
    expect(newState.log).toContain(`Lupus deals 3 damage (Rotation: 270º).`);
  });

  it('should discard opponent knowledge on final rotation (270 degrees)', () => {
    const rotation = 270;
    const opponentKnowledge: Knowledge = { ...knowledges.find(k => k.id === 'aerial1')!, instanceId: 'oppoK1' };
    gameState.players[opponentIndex].field[fieldSlotIndex].knowledge = opponentKnowledge; // Give opponent knowledge
    gameState.players[playerIndex].field[fieldSlotIndex].knowledge!.rotation = rotation;


    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
      rotation,
      isFinalRotation: true, // Mark as final rotation
    });

    expect(newState.players[opponentIndex].field[fieldSlotIndex].knowledge).toBeNull();
    expect(newState.discardPile).toContainEqual(opponentKnowledge);
    expect(newState.log).toContain(`[Final] Lupus attempts to discard opponent knowledge. Discarded ${opponentKnowledge.name}.`);
    // Also check damage dealt in final rotation
    expect(newState.players[opponentIndex].power).toBe(17);
  });

   it('should not discard opponent knowledge if not final rotation', () => {
    const rotation = 180; // Not final
    const opponentKnowledge: Knowledge = { ...knowledges.find(k => k.id === 'aerial1')!, instanceId: 'oppoK1' };
    gameState.players[opponentIndex].field[fieldSlotIndex].knowledge = opponentKnowledge;
    gameState.players[playerIndex].field[fieldSlotIndex].knowledge!.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
      rotation,
      isFinalRotation: false, // Not final
    });

    expect(newState.players[opponentIndex].field[fieldSlotIndex].knowledge).toEqual(opponentKnowledge);
    expect(newState.discardPile).not.toContainEqual(opponentKnowledge);
    expect(newState.log).not.toContain('[Final] Lupus attempts to discard opponent knowledge.');
    // Check damage dealt
    expect(newState.players[opponentIndex].power).toBe(18);
  });

  it('should handle final rotation discard when opponent has no knowledge', () => {
    const rotation = 270;
    // Ensure opponent has no knowledge
    gameState.players[opponentIndex].field[fieldSlotIndex].knowledge = null;
    gameState.players[playerIndex].field[fieldSlotIndex].knowledge!.rotation = rotation;

    const newState = knowledgeEffects.terrestrial5({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
      rotation,
      isFinalRotation: true, // Final rotation
    });

    expect(newState.players[opponentIndex].field[fieldSlotIndex].knowledge).toBeNull();
    expect(newState.log).toContain('[Final] Lupus attempts to discard opponent knowledge. No knowledge cards to discard.');
    // Check damage dealt
    expect(newState.players[opponentIndex].power).toBe(17);
  });

});