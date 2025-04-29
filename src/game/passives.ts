import { GameState, PassiveTriggerType, PassiveEventData, Knowledge } from './types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Applies passive abilities based on a trigger event.
 * IMPORTANT: This function MUTATES the newState object directly for simplicity in nested logic.
 * Ensure a deep copy is made before calling if mutation is not desired upstream.
 * @param state The current game state (will be copied internally).
 * @param trigger The event that triggered the passive check.
 * @param eventData Contextual data about the event.
 * @returns The potentially modified game state.
 */
export function applyPassiveAbilities(
  state: GameState,
  trigger: PassiveTriggerType,
  eventData: PassiveEventData
): GameState {
  // Create a deep copy to avoid mutating the original state unintentionally
  let newState = JSON.parse(JSON.stringify(state)) as GameState;

  newState.players.forEach((player, playerIndex) => {
    player.creatures.forEach(creature => {
      if (!creature || !creature.passiveAbility) return; // Skip if no creature or no passive

      // --- Trigger Logic --- Refactored to modify newState directly ---

      // Caapora
      if (creature.id === 'caapora' && trigger === 'TURN_START' && eventData.playerId === player.id) {
        const opponentIdx = getOpponentPlayerIndex(newState, player.id);
        const opponent = opponentIdx !== -1 ? newState.players[opponentIdx] : null;
        if (opponent && opponent.hand.length > player.hand.length) {
          const oldPower = opponent.power;
          opponent.power -= 1; // Modify opponent directly in newState
          newState.log.push(`[Passive Effect] Caapora (Owner: ${player.id}) deals 1 damage to ${opponent.id}. Power: ${oldPower} -> ${opponent.power}`);
        }
      }

      // Adaro: AFTER_PLAYER_SUMMON (on self) - If summoned knowledge is water, draw 1 card from market (free).
      else if (creature.id === 'adaro' && trigger === 'AFTER_PLAYER_SUMMON') {
        const summoningPlayerId = eventData.playerId;
        const targetCreatureId = eventData.creatureId;
        const summonedKnowledge = eventData.knowledgeCard;

        if (player.id === summoningPlayerId && creature.id === targetCreatureId && summonedKnowledge && summonedKnowledge.element === 'water') {
          newState.log.push(`[Passive Effect] Adaro (Owner: ${player.id}) triggers free draw.`);
          if (newState.market.length > 0) {
            const drawnCard = newState.market.shift(); // Remove from market
            if (drawnCard) {
              player.hand.push(drawnCard); // Modify player directly in newState
              newState.log.push(`[Passive Effect] ${player.id} drew ${drawnCard.name} from Market due to Adaro passive.`);
              // Refill market
              if (newState.knowledgeDeck.length > 0) {
                const refillCard = newState.knowledgeDeck.shift();
                if (refillCard) {
                  newState.market.push(refillCard);
                  newState.log.push(`[Passive Effect] Market refilled with ${refillCard.name}.`); // Log refill
                }
              }
            }
          } else {
            newState.log.push(`[Passive Effect] Adaro triggered, but Market is empty.`);
          }
        }
      }

      // Kyzy: AFTER_PLAYER_SUMMON or AFTER_OPPONENT_SUMMON - If ANY player summons earth knowledge, force the OPPONENT of Kyzy's owner to discard 1 card.
      else if (creature.id === 'kyzy' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
        const summonedKnowledge = eventData.knowledgeCard;

        // NEW LOGIC: Check if the summoned knowledge is earth
        if (summonedKnowledge && summonedKnowledge.element === 'earth') {
          // Identify the opponent of Kyzy's owner ('player')
          const opponentOfOwnerIdx = getOpponentPlayerIndex(newState, player.id);
          if (opponentOfOwnerIdx === -1) return; // Should not happen in a 2-player game

          const opponentOfOwner = newState.players[opponentOfOwnerIdx];
          // Find a card in the opponent's hand to discard.
          // If the opponent was the one summoning, don't discard the card they just summoned.
          const cardToDiscard = opponentOfOwner.hand.find(card => card.instanceId !== summonedKnowledge.instanceId);

          if (cardToDiscard) {
            newState.log.push(`[Passive Effect] Kyzy (Owner: ${player.id}) forces discard from opponent ${opponentOfOwner.id}.`);
            // Modify opponent's hand directly in newState
            opponentOfOwner.hand = opponentOfOwner.hand.filter(card => card.instanceId !== cardToDiscard.instanceId);
            newState.discardPile.push(cardToDiscard);
            newState.log.push(`[Passive Effect] ${opponentOfOwner.id} discarded ${cardToDiscard.name} due to Kyzy passive.`);
          } else {
            // Check if the opponent's only card was the one they just summoned
            const onlyCardWasSummoned = opponentOfOwner.hand.length === 1 && opponentOfOwner.hand[0].instanceId === summonedKnowledge.instanceId;
            if (opponentOfOwner.hand.length === 0 || onlyCardWasSummoned) {
              newState.log.push(`[Passive Effect] Kyzy triggered discard, but opponent ${opponentOfOwner.id} had no other cards to discard.`);
            } else {
              // This case should ideally not be reached if the find logic is correct, but added for safety.
              // It implies the opponent had cards, but none could be chosen (e.g., only the summoned card was left).
              newState.log.push(`[Passive Effect] Kyzy triggered discard, but opponent ${opponentOfOwner.id} had no valid cards to discard.`);
            }
          }
        }
      }

      // Japinunus: AFTER_PLAYER_SUMMON or AFTER_OPPONENT_SUMMON - If owner summoned air knowledge, owner gains +1 Power.
      else if (creature.id === 'japinunus' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
        const summonedKnowledge = eventData.knowledgeCard;
        const summoningPlayerId = eventData.playerId;

        // Check if the summoner is the owner of this Japinunus AND the knowledge is air
        if (player.id === summoningPlayerId && summonedKnowledge && summonedKnowledge.element === 'air') {
          const initialPower = player.power; // Get power before modification
          player.power += 1; // Modify player directly in newState
          // Add the missing log messages
          newState.log.push(`[Passive Effect] Japinunus (Owner: ${player.id}) grants +1 Power to owner.`);
          newState.log.push(`Power: ${initialPower} -> ${player.power}`);
        }
      }

      // Kappa - Logic handled in isValidAction

      // Dudugera - Logic handled in isValidAction / reducer

      // Inkanyamba: AFTER_PLAYER_DRAW - Discard 1 card from market.
      else if (creature.id === 'inkanyamba' && trigger === 'AFTER_PLAYER_DRAW') {
        const drawingPlayerId = eventData.playerId;
        // Check if the drawing player is the owner of this Inkanyamba
        if (player.id === drawingPlayerId && newState.market.length > 0) {
          const cardToDiscard = newState.market[0]; // Discard the first card
          newState.market = newState.market.slice(1);
          newState.discardPile.push(cardToDiscard);
          // Add the missing log message
          newState.log.push(`[Passive Effect] Inkanyamba (Owner: ${player.id}) discards ${cardToDiscard.name} from Market.`);
          // Refill market if deck has cards
          if (newState.knowledgeDeck.length > 0) {
            const refillCard = newState.knowledgeDeck[0];
            newState.knowledgeDeck = newState.knowledgeDeck.slice(1);
            newState.market.push(refillCard);
          }
        }
      }

      // Lisovik
      else if (creature.id === 'lisovik' && trigger === 'KNOWLEDGE_LEAVE' && eventData.playerId === player.id) {
        const leavingKnowledge = eventData.knowledgeCard;
        const opponentIdx = getOpponentPlayerIndex(newState, player.id);
        const opponent = opponentIdx !== -1 ? newState.players[opponentIdx] : null;
        if (opponent && leavingKnowledge && leavingKnowledge.element === 'earth') {
          const oldPower = opponent.power;
          opponent.power -= 1; // Modify opponent directly in newState
          newState.log.push(`[Passive Effect] Lisovik (Owner: ${player.id}) deals 1 damage to ${opponent.id} due to terrestrial knowledge (${leavingKnowledge.name}) leaving play. Power: ${oldPower} -> ${opponent.power}`);
        }
      }

      // Pele
      else if (creature.id === 'pele' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
        const summonedKnowledge = eventData.knowledgeCard;
        const summoningPlayerId = eventData.playerId;
        const opponentIdx = getOpponentPlayerIndex(newState, player.id);
        const opponent = opponentIdx !== -1 ? newState.players[opponentIdx] : null;
        // Check if the owner of this Pele (player) is the one who summoned
        if (opponent && summonedKnowledge && summonedKnowledge.element === 'earth' && player.id === summoningPlayerId) {
          const lowerCostSlots = opponent.field
            .map((slot, idx) => ({ slot, idx }))
            .filter(({ slot }) => slot.knowledge && slot.knowledge.cost < summonedKnowledge.cost);

          if (lowerCostSlots.length === 0) {
            newState.log.push(`[Passive Effect] Pele (Owner: ${player.id}) triggered, but opponent has no knowledge with lower wisdom cost than ${summonedKnowledge.name}.`);
          } else {
            // MVP: Discard the first one found
            const { slot, idx } = lowerCostSlots[0];
            // Ensure the knowledge object passed to passives is complete
            const discardedKnowledge: Knowledge = {
              ...slot.knowledge!, // Use non-null assertion
              // Ensure required fields have defaults if potentially missing from spread
              type: slot.knowledge!.type ?? 'spell',
              element: slot.knowledge!.element ?? 'neutral',
              cost: slot.knowledge!.cost ?? 0,
              effect: slot.knowledge!.effect ?? '',
              maxRotations: slot.knowledge!.maxRotations ?? 4,
              id: slot.knowledge!.id ?? 'unknown',
              name: slot.knowledge!.name ?? 'Unknown Knowledge',
              instanceId: slot.knowledge!.instanceId ?? 'unknown-instance',
              rotation: slot.knowledge!.rotation ?? 0,
            };
            opponent.field[idx].knowledge = null; // Modify opponent directly in newState
            newState.discardPile.push(discardedKnowledge);
            newState.log.push(`[Passive Effect] Pele (Owner: ${player.id}) discards opponent's knowledge ${discardedKnowledge.name} (cost ${discardedKnowledge.cost}) due to summoning ${summonedKnowledge.name} (cost ${summonedKnowledge.cost}). [TODO: Let user choose if multiple]`);

            // Trigger KNOWLEDGE_LEAVE for the discarded card (recursive call - ensure base cases prevent infinite loops)
            // Pass the already modified newState to the recursive call
            newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
              playerId: opponent.id,
              creatureId: opponent.field[idx].creatureId, // Use the creatureId from the field slot
              knowledgeCard: discardedKnowledge // Pass validated object
            });
          }
        }
      }

      // Tsenehale
      else if (creature.id === 'tsenehale' && trigger === 'KNOWLEDGE_LEAVE' && eventData.playerId === player.id && eventData.creatureId === creature.id) {
        const leavingKnowledge = eventData.knowledgeCard;
        if (leavingKnowledge && leavingKnowledge.element === 'air') {
          const oldPower = player.power;
          player.power += 1; // Modify player directly in newState
          newState.log.push(`[Passive Effect] Tsenehale (Owner: ${player.id}) grants +1 Power due to ${leavingKnowledge.name} leaving. Power: ${oldPower} -> ${player.power}`);
        }
      }

      // Tulpar
      else if (creature.id === 'tulpar' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
        const summonedKnowledge = eventData.knowledgeCard;
        const summoningPlayerId = eventData.playerId;
        // Check if the owner of this Tulpar (player) is the one who summoned
        if (summonedKnowledge && summonedKnowledge.element === 'air' && player.id === summoningPlayerId) {
          const notFullyRotated = player.creatures
            .map((c, index) => ({ creature: c, index })) // Keep track of original index
            .filter(({ creature: c }) => (c.rotation ?? 0) < 270);

          if (notFullyRotated.length === 0) {
            newState.log.push(`[Passive Effect] Tulpar (Owner: ${player.id}) triggered, but all creatures are fully rotated.`);
          } else {
            // MVP: Rotate the first one found
            const { creature: c, index: creatureIndex } = notFullyRotated[0];
            const currentRotation = c.rotation ?? 0;
            // Directly modify the creature within newState.players[playerIndex].creatures
            newState.players[playerIndex].creatures[creatureIndex].rotation = currentRotation + 90;
            newState.log.push(`[Passive Effect] Tulpar (Owner: ${player.id}) rotates ${c.name} 90º due to summoning ${summonedKnowledge.name}. [TODO: Let user choose if multiple]`);
          }
        }
      }

      // Trepulcahue
      else if (creature.id === 'trepulcahue' && trigger === 'TURN_START' && eventData.playerId === player.id) {
        const opponentIdx = getOpponentPlayerIndex(newState, player.id);
        const opponent = opponentIdx !== -1 ? newState.players[opponentIdx] : null;
        if (opponent && player.hand.length > opponent.hand.length) {
          const oldPower = opponent.power;
          opponent.power -= 1; // Modify opponent directly in newState
          newState.log.push(`[Passive Effect] Trepulcahue (Owner: ${player.id}) deals 1 damage to ${opponent.id}. Power: ${oldPower} -> ${opponent.power}`);
        }
      }

      // Zhar-Ptitsa
      else if (creature.id === 'zhar-ptitsa' && trigger === 'TURN_START' && eventData.playerId === player.id) {
        newState.log.push(`[Passive Effect] Zhar-Ptitsa (Owner: ${player.id}) triggers free draw.`);
        if (newState.market.length > 0) {
          const drawnCard = newState.market.shift();
          if (drawnCard) {
            player.hand.push(drawnCard); // Modify player directly in newState
            newState.log.push(`[Passive Effect] Zhar-Ptitsa (Owner: ${player.id}) draws ${drawnCard.name}. Hand size: ${player.hand.length}`);
            if (newState.knowledgeDeck.length > 0) {
              const refillCard = { ...newState.knowledgeDeck.shift()!, instanceId: uuidv4() };
              newState.market.push(refillCard);
              newState.log.push(`[Passive Effect] Market refilled with ${refillCard.name}.`);
            }
          }
        } else {
          newState.log.push(`[Passive Effect] Zhar-Ptitsa triggered, but Market is empty.`);
        }
      }

      // --- Add other creature passives here using else if, modifying newState directly ---

    }); // End loop through creatures
  }); // End loop through players

  return newState; // Return the modified deep copy
}

// Helper to get opponent index (avoids direct dependency if utils are complex)
// Keep these local helpers as the import from utils was causing issues
function getOpponentPlayerIndex(state: GameState, playerId: string): number {
  return state.players.findIndex(p => p.id !== playerId);
}

// Helper to get player index
// Keep these local helpers
function getPlayerIndex(state: GameState, playerId: string): number {
  return state.players.findIndex(p => p.id === playerId);
}
