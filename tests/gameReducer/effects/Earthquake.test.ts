import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, Knowledge, Creature } from '../../../src/game/types';
import { knowledgeEffects } from '../../../src/game/effects';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';
import creatures from '../../../src/assets/creatures.json'; // Import creatures to get base wisdom

const earthquakeKnowledge = knowledges.find(k => k.id === 'terrestrial3') as Knowledge;
const testCreatureData = creatures.find(c => c.id === 'adaro'); // Use a known creature, e.g., Adaro

if (!testCreatureData) {
  throw new Error("Test setup failed: Could not find creature 'adaro' in creatures.json");
}

describe('Earthquake (terrestrial3) Effect', () => {
  let gameState: GameState;
  const playerIndex = 0;
  const opponentIndex = 1;
  const fieldSlotIndex = 0;
  const p1CreatureId = testCreatureData.id;
  const p2CreatureId = 'pele'; // Opponent creature

  beforeEach(() => {
    gameState = createInitialTestState('earthquake-test', [p1CreatureId], [p2CreatureId]);

    // Place Earthquake knowledge on the player's creature
    const playerSlot = gameState.players[playerIndex].field.find(s => s.creatureId === p1CreatureId);
    if (playerSlot) {
        playerSlot.knowledge = { ...earthquakeKnowledge, instanceId: 'earthquake1', rotation: 0 };
    } else {
        throw new Error(`Could not find field slot for creature ${p1CreatureId}`);
    }

    // Ensure creature has correct wisdom in the state
    const creatureInState = gameState.players[playerIndex].creatures.find(c => c.id === p1CreatureId);
    if (!creatureInState) {
        throw new Error(`Creature ${p1CreatureId} not found in player's state`);
    }
    // Explicitly set currentWisdom, defaulting to 0 if baseWisdom is missing
    creatureInState.currentWisdom = creatureInState.baseWisdom ?? 0;

    // Set initial state details
    gameState.players[playerIndex].power = 20;
    gameState.players[opponentIndex].power = 20;
    gameState.log = []; // Clear log
  });

  it('should deal damage equal to the summoning creature\'s current wisdom', () => {
    // Use ?? 0 to match effect's handling of potentially undefined wisdom
    const creatureWisdom = gameState.players[playerIndex].creatures.find(c => c.id === p1CreatureId)!.currentWisdom ?? 0;
    const initialOpponentPower = gameState.players[opponentIndex].power;

    const newState = knowledgeEffects.terrestrial3({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
    });

    // Assert based on the wisdom value used (potentially 0)
    expect(newState.players[opponentIndex].power).toBe(initialOpponentPower - creatureWisdom);

    // Adjust log check based on actual damage dealt
    if (creatureWisdom > 0) {
        expect(newState.log.some(log => log.includes(`deals ${creatureWisdom} damage`))).toBe(true);
        expect(newState.log.some(log => log.includes(`Base: ${creatureWisdom}`))).toBe(true);
    } else {
        // If wisdom was 0, check for the no-damage log added in the effect
         expect(newState.log.some(log => log.includes(`${earthquakeKnowledge.name} causes no damage as creature wisdom is 0.`))).toBe(true);
    }
  });

  it('should deal 0 damage if the summoning creature\'s wisdom is 0', () => {
    // Modify creature's wisdom in the state for this test
    const creatureInState = gameState.players[playerIndex].creatures.find(c => c.id === p1CreatureId)!;
    creatureInState.currentWisdom = 0;
    const creatureWisdom = 0; // Explicitly 0 for assertion
    const initialOpponentPower = gameState.players[opponentIndex].power;

    const newState = knowledgeEffects.terrestrial3({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
    });

    expect(newState.players[opponentIndex].power).toBe(initialOpponentPower - creatureWisdom); // 20 - 0 = 20
    expect(newState.log.some(log => log.includes(`${earthquakeKnowledge.name} causes no damage as creature wisdom is 0.`))).toBe(true);
  });

  it('should deal damage considering opponent defense (if any)', () => {
    // Use ?? 0 for wisdom calculation
    const creatureWisdom = gameState.players[playerIndex].creatures.find(c => c.id === p1CreatureId)!.currentWisdom ?? 0;
    const initialOpponentPower = gameState.players[opponentIndex].power;

    // Give opponent a defensive knowledge (e.g., Asteroid)
    const defenseKnowledge = createTestKnowledge('aquatic2');
    const opponentSlot = gameState.players[opponentIndex].field.find(s => s.creatureId === p2CreatureId);
    if (opponentSlot) {
        opponentSlot.knowledge = { ...defenseKnowledge, instanceId: 'defense1', rotation: 0 };
        // Assuming Asteroid at rotation 0 provides 1 defense (valueCycle: [-1, ...])
    } else {
        throw new Error(`Could not find opponent field slot for creature ${p2CreatureId}`);
    }

    // Assume calculateDamage applies 1 defense correctly
    const defenseValue = 1; // Based on Asteroid's assumed valueCycle[0] being -1
    const expectedDamage = Math.max(0, creatureWisdom - defenseValue);

    const newState = knowledgeEffects.terrestrial3({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
    });

    expect(newState.players[opponentIndex].power).toBe(initialOpponentPower - expectedDamage);

    // Adjust log checks based on actual damage
     if (expectedDamage > 0) {
        expect(newState.log.some(log => log.includes(`deals ${expectedDamage} damage`))).toBe(true);
        expect(newState.log.some(log => log.includes(`Defense: ${defenseValue}`))).toBe(true); // Check defense log
    } else {
        // Check if damage was reduced to 0 or less by defense
        expect(newState.log.some(log => log.includes(`Damage reduced to 0 or less`))).toBe(true);
    }
  });

});
