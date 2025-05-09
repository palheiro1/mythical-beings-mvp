// File: /home/usuario/Documentos/GitHub/CardGame/mythical-beings-mvp/tests/gameReducer/passives/lisovik.test.ts
import { describe, it, expect } from 'vitest';
import { gameReducer } from '../../../src/game/state';
import { GameState, GameAction } from '../../../src/game/types'; // Added GameAction
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import { executeKnowledgePhase } from '../../../src/game/rules'; // Added import

describe('Lisovik Passive', () => {
  describe('KNOWLEDGE_LEAVE (Owner) - If leaving knowledge is earth, deal 1 damage to opponent', () => {
    it('should deal 1 damage to opponent when earth knowledge (owned by Lisovik\'s owner) leaves due to max rotations', () => {
      const p1Id = 'player1'; // Lisovik's owner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game-lisovik-rotation', ['lisovik', 'adaro'], ['pele'], {
        currentPlayerIndex: 0, // P1's turn context, though executeKnowledgePhase is global
        phase: 'knowledge', // Relevant for context
        actionsTakenThisTurn: 0,
      });

      // Place an earth knowledge card on P1's Adaro, poised to be discarded by rotation
      const earthKnowledge = createTestKnowledge('terrestrial1', {
        id: 'terrestrial1',
        name: 'Terrestrial Knowledge 1',
        cost: 1,
        element: 'earth',
        maxRotations: 4, // Default is 4, explicit for clarity
        rotation: 270,   // Next rotation (270 + 90 = 360) will trigger discard (360 >= 4*90)
      });
      const adaroPlayer1FieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[0].field[adaroPlayer1FieldIndex].knowledge = earthKnowledge;

      const initialOpponentPower = initialState.players[1].power;
      const initialDiscardSize = initialState.discardPile.length;
      const initialP1HandSize = initialState.players[0].hand.length;

      // Execute the knowledge phase
      const stateAfterKnowledgePhase = executeKnowledgePhase(initialState);

      // Assert: Opponent's power is DECREASED by 1
      expect(stateAfterKnowledgePhase.players[1].power).toBe(initialOpponentPower - 1);
      // Assert: Discard pile size is INCREASED by 1
      expect(stateAfterKnowledgePhase.discardPile.length).toBe(initialDiscardSize + 1);
      expect(stateAfterKnowledgePhase.discardPile.find(k => k.instanceId === earthKnowledge.instanceId)).toBeDefined();
      // Assert: The earth card is REMOVED from the field
      const adaroSlotP1After = stateAfterKnowledgePhase.players[0].field.find(f => f.creatureId === 'adaro');
      expect(adaroSlotP1After?.knowledge).toBeNull();
      // Assert: Log message indicates damage dealt
      expect(stateAfterKnowledgePhase.log).toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage to ${p2Id} as ${earthKnowledge.name} leaves play.`);
      expect(stateAfterKnowledgePhase.log).toContain(`Power: ${initialOpponentPower} -> ${initialOpponentPower - 1}`);
      // Assert: P1 hand size is unchanged (no draw/discard from hand in this specific flow)
      expect(stateAfterKnowledgePhase.players[0].hand.length).toBe(initialP1HandSize);
    });

    it('should NOT deal damage when OPPONENT\'S earth knowledge leaves due to max rotations', () => {
      const p1Id = 'player1'; // Lisovik's owner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game-lisovik-opp-rotation', ['lisovik'], ['pele', 'adaro'], { // P1 has Lisovik, P2 has Adaro
        currentPlayerIndex: 0, // Irrelevant for knowledge phase trigger, but good for context
        phase: 'knowledge', // To allow executeKnowledgePhase to proceed
        actionsTakenThisTurn: 0,
      });

      // Place an earth knowledge card on P2's Adaro, poised to be discarded by rotation
      const earthKnowledgeOnField = createTestKnowledge('terrestrial1', { 
        cost: 1, 
        rotation: 270, 
        maxRotations: 4,
        valueCycle: [0, 0, 0, 1] // Only index 3 (270 degrees) has damage value
      });
      const adaroIndex = initialState.players[1].creatures.findIndex(c => c.id === 'adaro');
      initialState.players[1].creatures[adaroIndex].currentWisdom = 1; // Ensure wisdom for summon
      const adaroFieldIndex = initialState.players[1].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[1].field[adaroFieldIndex].knowledge = earthKnowledgeOnField;

      const initialP1Power = initialState.players[0].power; // Lisovik's owner's power
      const initialP2Power = initialState.players[1].power; // Opponent's power
      const initialDiscardSize = initialState.discardPile.length;
      const initialP2HandSize = initialState.players[1].hand.length;

      // Execute the knowledge phase
      const stateAfterKnowledgePhase = executeKnowledgePhase(initialState);

      // Assert: Player 1's (Lisovik's owner) power is DECREASED by 2 due to P2's terrestrial1 (Ursus) effect, NOT by Lisovik's passive.
      expect(stateAfterKnowledgePhase.players[0].power).toBe(initialP1Power - 2);
      // Assert: Opponent's (P2) power is UNCHANGED by Lisovik's passive (and also not by its own Ursus effect on itself).
      expect(stateAfterKnowledgePhase.players[1].power).toBe(initialP2Power);
      // Assert: Discard pile size is INCREASED by 1 (opponent's card is discarded)
      expect(stateAfterKnowledgePhase.discardPile.length).toBe(initialDiscardSize + 1);
      expect(stateAfterKnowledgePhase.discardPile.find(k => k.instanceId === earthKnowledgeOnField.instanceId)).toBeDefined();
      // Assert: The earth card is REMOVED from P2's field
      const adaroSlotP2After = stateAfterKnowledgePhase.players[1].field.find(f => f.creatureId === 'adaro');
      expect(adaroSlotP2After?.knowledge).toBeNull();
      // Assert: Log message for Lisovik damage should NOT be present
      expect(stateAfterKnowledgePhase.log).not.toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage to ${p2Id} as ${earthKnowledgeOnField.name} leaves play.`);
      expect(stateAfterKnowledgePhase.log).not.toContain(`Power: ${initialP1Power} -> ${initialP1Power - 1}`);
    });

    it('should NOT deal damage when NON-EARTH knowledge (owned by Lisovik\'s owner) leaves due to max rotations', () => {
      const p1Id = 'player1'; // Lisovik's owner
      const p2Id = 'player2'; // Opponent
      const initialState = createInitialTestState('game-lisovik-non-earth-rotation', ['lisovik', 'adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'knowledge',
        actionsTakenThisTurn: 0,
      });

      // Place a NON-EARTH knowledge card on P1's Adaro, poised to be discarded by rotation
      const nonEarthKnowledge = createTestKnowledge('aerial1', { // Air type
        id: 'aerial1',
        name: 'Aerial Knowledge 1',
        cost: 1,
        element: 'air', // Explicitly non-earth
        maxRotations: 4,
        rotation: 270,   // Will be discarded after next rotation
      });
      const adaroPlayer1FieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[0].field[adaroPlayer1FieldIndex].knowledge = nonEarthKnowledge;

      const initialOpponentPower = initialState.players[1].power;
      const initialDiscardSize = initialState.discardPile.length;

      // Execute the knowledge phase
      const stateAfterKnowledgePhase = executeKnowledgePhase(initialState);

      // Assert: Opponent's power is UNCHANGED
      expect(stateAfterKnowledgePhase.players[1].power).toBe(initialOpponentPower);
      // Assert: Discard pile size is INCREASED by 1 (non-earth card is discarded)
      expect(stateAfterKnowledgePhase.discardPile.length).toBe(initialDiscardSize + 1);
      expect(stateAfterKnowledgePhase.discardPile.find(k => k.instanceId === nonEarthKnowledge.instanceId)).toBeDefined();
      // Assert: The non-earth card is REMOVED from P1's field
      const adaroSlotP1After = stateAfterKnowledgePhase.players[0].field.find(f => f.creatureId === 'adaro');
      expect(adaroSlotP1After?.knowledge).toBeNull();
      // Assert: Log message for Lisovik damage should NOT be present
      expect(stateAfterKnowledgePhase.log).not.toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage to ${p2Id}`);
    });

    it('should NOT deal damage when earth knowledge (owned by P1) leaves due to max rotations IF LISOVIK IS NOT IN PLAY', () => {
      const p1Id = 'player1'; // Potential Lisovik owner
      const p2Id = 'player2'; // Opponent
      // P1 has Adaro, but NO Lisovik. P2 has Pele.
      const initialState = createInitialTestState('game-no-lisovik-rotation', ['adaro'], ['pele'], {
        currentPlayerIndex: 0,
        phase: 'knowledge',
        actionsTakenThisTurn: 0,
      });

      // Place an earth knowledge card on P1's Adaro, poised to be discarded by rotation
      const earthKnowledgeP1 = createTestKnowledge('terrestrial1', { // Changed to use 'terrestrial1' as base ID
        id: 'terrestrial1', // This ID is for the test instance
        name: 'P1 Earth Knowledge',
        cost: 1,
        element: 'earth',
        maxRotations: 4,
        rotation: 270,   // Will be discarded after next rotation
      });
      const adaroPlayer1FieldIndex = initialState.players[0].field.findIndex(f => f.creatureId === 'adaro');
      initialState.players[0].field[adaroPlayer1FieldIndex].knowledge = earthKnowledgeP1;

      const initialOpponentPower = initialState.players[1].power;
      const initialDiscardSize = initialState.discardPile.length;

      // Execute the knowledge phase
      const stateAfterKnowledgePhase = executeKnowledgePhase(initialState);

      // Assert: Opponent's power is UNCHANGED (Lisovik is not there to trigger)
      expect(stateAfterKnowledgePhase.players[1].power).toBe(initialOpponentPower);
      // Assert: Discard pile size is INCREASED by 1 (P1's earth card is discarded)
      expect(stateAfterKnowledgePhase.discardPile.length).toBe(initialDiscardSize + 1);
      expect(stateAfterKnowledgePhase.discardPile.find(k => k.instanceId === earthKnowledgeP1.instanceId)).toBeDefined();
      // Assert: The earth card is REMOVED from P1's field
      const adaroSlotP1After = stateAfterKnowledgePhase.players[0].field.find(f => f.creatureId === 'adaro');
      expect(adaroSlotP1After?.knowledge).toBeNull();
      // Assert: Log message for Lisovik damage should NOT be present
      expect(stateAfterKnowledgePhase.log).not.toContain(`[Passive Effect] Lisovik (Owner: ${p1Id}) deals 1 damage to ${p2Id} as ${earthKnowledgeP1.name} leaves play.`);
      expect(stateAfterKnowledgePhase.log).not.toContain(`Power: ${initialOpponentPower} -> ${initialOpponentPower - 1}`);
    });
  });
});