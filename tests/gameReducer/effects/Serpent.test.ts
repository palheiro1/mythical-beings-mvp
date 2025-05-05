import { describe, it, expect, beforeEach } from 'vitest';
import { GameState, Knowledge, Card } from '../../../src/game/types';
import { knowledgeEffects } from '../../../src/game/effects';
import { createInitialTestState, createTestKnowledge } from '../../utils/testHelpers';
import knowledges from '../../../src/assets/knowledges.json';

const serpentKnowledge = knowledges.find(k => k.id === 'terrestrial2') as Knowledge;
const opponentCard1 = createTestKnowledge('aerial1'); // Example card in opponent hand
const opponentCard2 = createTestKnowledge('aquatic2'); // Another example card

describe('Serpent (terrestrial2) Effect', () => {
  let gameState: GameState;
  const playerIndex = 0;
  const opponentIndex = 1;
  const fieldSlotIndex = 0;
  const p1CreatureId = 'adaro';
  const p2CreatureId = 'pele';

  beforeEach(() => {
    gameState = createInitialTestState('serpent-test', [p1CreatureId], [p2CreatureId]);

    // Place Serpent knowledge
    const playerSlot = gameState.players[playerIndex].field.find(s => s.creatureId === p1CreatureId);
    if (playerSlot) {
        playerSlot.knowledge = { ...serpentKnowledge, instanceId: 'serpent1', rotation: 0 };
    } else {
        throw new Error(`Could not find field slot for creature ${p1CreatureId}`);
    }

    // Give opponent cards in hand
    gameState.players[opponentIndex].hand = [
        { ...opponentCard1, instanceId: 'oppCard1' },
        { ...opponentCard2, instanceId: 'oppCard2' }
    ];

    // Set initial state details
    gameState.players[playerIndex].power = 20;
    gameState.players[opponentIndex].power = 20;
    gameState.discardPile = [];
    gameState.log = []; // Clear log
  });

  it('should force opponent to discard the first card from hand', () => {
    const initialOpponentHandSize = gameState.players[opponentIndex].hand.length;
    const cardToDiscard = gameState.players[opponentIndex].hand[0]; // The first card

    const newState = knowledgeEffects.terrestrial2({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
      trigger: 'onPhase',
      // rotation and isFinalRotation are not used by terrestrial2
    });

    // Check opponent's hand
    expect(newState.players[opponentIndex].hand.length).toBe(initialOpponentHandSize - 1);
    expect(newState.players[opponentIndex].hand.find(c => c.instanceId === cardToDiscard.instanceId)).toBeUndefined();

    // Check discard pile
    expect(newState.discardPile.length).toBe(1);
    expect(newState.discardPile[0].instanceId).toBe(cardToDiscard.instanceId);

    // Check log
    expect(newState.log.some(log => log.includes(`Serpent forces opponent to discard ${cardToDiscard.name}`))).toBe(true);
  });

  it('should do nothing if opponent has no cards in hand', () => {
    // Empty opponent's hand
    gameState.players[opponentIndex].hand = [];
    const initialDiscardPileSize = gameState.discardPile.length;

    const newState = knowledgeEffects.terrestrial2({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
      trigger: 'onPhase',
    });

    // Check opponent's hand (still empty)
    expect(newState.players[opponentIndex].hand.length).toBe(0);

    // Check discard pile (unchanged)
    expect(newState.discardPile.length).toBe(initialDiscardPileSize);

    // Check log
    expect(newState.log.some(log => log.includes('Serpent: Opponent has no cards to discard.'))).toBe(true);
  });

  it('should not discard from the player\'s own hand', () => {
     // Give player a card
     const playerCard = createTestKnowledge('terrestrial3');
     gameState.players[playerIndex].hand = [{ ...playerCard, instanceId: 'playerCard1' }];
     const initialPlayerHandSize = gameState.players[playerIndex].hand.length;
     const initialOpponentHandSize = gameState.players[opponentIndex].hand.length;
     const cardToDiscard = gameState.players[opponentIndex].hand[0]; // Opponent's first card

    const newState = knowledgeEffects.terrestrial2({
      state: gameState,
      playerIndex,
      fieldSlotIndex,
      knowledge: gameState.players[playerIndex].field[fieldSlotIndex].knowledge!,
      trigger: 'onPhase',
    });

    // Check player's hand (unchanged)
    expect(newState.players[playerIndex].hand.length).toBe(initialPlayerHandSize);
    expect(newState.players[playerIndex].hand[0].instanceId).toBe('playerCard1');

    // Check opponent's hand (one card discarded)
    expect(newState.players[opponentIndex].hand.length).toBe(initialOpponentHandSize - 1);

    // Check discard pile (contains opponent's card)
    expect(newState.discardPile.length).toBe(1);
    expect(newState.discardPile[0].instanceId).toBe(cardToDiscard.instanceId);
  });

});
