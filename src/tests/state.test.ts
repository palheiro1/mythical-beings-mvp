import { describe, it, expect, beforeEach } from 'vitest';
import { gameReducer, initializeGame } from '../game/state';
import { GameState, GameAction, Knowledge, Creature } from '../game/types';
import creatureData from '../assets/creatures.json';
import knowledgeData from '../assets/knowledges.json';

// Helper to find cards
const findCreature = (id: string): Creature | undefined => (creatureData as Creature[]).find(c => c.id === id);
const findKnowledge = (id: string): Knowledge | undefined => (knowledgeData as Knowledge[]).find(k => k.id === k.id); // Find first instance

describe('gameReducer - Passive Abilities', () => {
  let initialState: GameState;
  const player1Id = 'player1';
  const player2Id = 'player2';
  const dudugeraCreature = findCreature('dudugera');
  const otherCreature = findCreature('adaro'); // Just need another creature
  const testKnowledge = findKnowledge('terrestrial1'); // A low-cost knowledge

  beforeEach(() => {
    if (!dudugeraCreature || !otherCreature || !testKnowledge) {
      throw new Error('Required test data (Dudugera, Adaro, terrestrial1) not found.');
    }

    // Initialize game with Dudugera for player 1
    initialState = initializeGame({
      gameId: 'test-game-dudugera',
      player1Id,
      player2Id,
      player1SelectedIds: [dudugeraCreature.id, otherCreature.id], // Player 1 has Dudugera
      player2SelectedIds: [otherCreature.id, otherCreature.id], // Player 2 setup doesn't matter much here
    });

    // Manually adjust state for the test scenario
    initialState.currentPlayerIndex = 0; // Player 1's turn
    initialState.phase = 'action';
    initialState.actionsTakenThisTurn = 0;
    initialState.players[0].hand = [{ ...testKnowledge, instanceId: 'test-knowledge-instance' }]; // Give knowledge to player 1
    // Ensure Dudugera has enough wisdom (adjust if needed based on knowledge cost and wisdom cycle)
    const dudugeraIndex = initialState.players[0].creatures.findIndex(c => c.id === 'dudugera');
    if (dudugeraIndex !== -1) {
        initialState.players[0].creatures[dudugeraIndex].currentWisdom = 5; // Ensure enough wisdom
    }
     // Ensure Dudugera is on the field (should be by default from initializeGame)
     const dudugeraFieldSlot = initialState.players[0].field.find(f => f.creatureId === 'dudugera');
     if (!dudugeraFieldSlot) {
         throw new Error("Test setup failed: Dudugera not found on player 1's field.");
     }

  });

  it('should allow Dudugera to summon knowledge without spending an action', () => {
    if (!testKnowledge) throw new Error('Test knowledge missing');

    // Action: Player 1 summons knowledge using Dudugera
    const summonAction: GameAction = {
      type: 'SUMMON_KNOWLEDGE',
      payload: {
        playerId: player1Id,
        knowledgeId: testKnowledge.id,
        instanceId: 'test-knowledge-instance', // Match the instanceId in hand
        creatureId: 'dudugera',
      },
    };

    const stateAfterSummon = gameReducer(initialState, summonAction);

    // Assertion 1: Action count should still be 0
    expect(stateAfterSummon?.actionsTakenThisTurn).toBe(0);
    // Assertion 2: Log should mention the passive effect
    expect(stateAfterSummon?.log.some(log => log.includes('Dudugera allows summoning') && log.includes('without spending an action'))).toBe(true);
     // Assertion 3: Knowledge should be on the field
     const dudugeraFieldSlot = stateAfterSummon?.players[0].field.find(f => f.creatureId === 'dudugera');
     expect(dudugeraFieldSlot?.knowledge?.id).toBe(testKnowledge.id);


    // Action 2: Player 1 performs another action (e.g., rotate)
    const rotateAction: GameAction = {
        type: 'ROTATE_CREATURE',
        payload: {
            playerId: player1Id,
            creatureId: 'dudugera',
        }
    };

    const stateAfterRotate = gameReducer(stateAfterSummon, rotateAction);

    // Assertion 4: Action count should now be 1
    expect(stateAfterRotate?.actionsTakenThisTurn).toBe(1);
  });

  // Add more tests for other passives or reducer logic here...
});
