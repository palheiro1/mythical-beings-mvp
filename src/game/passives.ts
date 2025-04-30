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
  let newState = JSON.parse(JSON.stringify(state)) as GameState; // Deep clone

  console.log(`[Passives] Applying ${trigger} passives. Event Data:`, eventData);

  newState.players.forEach((player, playerIndex) => { // 'player' is the potential owner of the passive creature
    const opponent = newState.players[(playerIndex + 1) % 2]; // Get opponent relative to passive owner

    player.creatures.forEach(creature => {
      if (!creature || !creature.passiveAbility) return; // Skip if no creature or no passive

      // --- Trigger Logic ---

      // Caapora
      if (creature.id === 'caapora' && trigger === 'TURN_START' && eventData.playerId === player.id) {
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
          // Find a card in the opponent's hand to discard.
          const cardToDiscard = opponent.hand.find(card => card.instanceId !== summonedKnowledge.instanceId);

          if (cardToDiscard) {
            newState.log.push(`[Passive Effect] Kyzy (Owner: ${player.id}) forces discard from opponent ${opponent.id}.`);
            // Modify opponent's hand directly in newState
            opponent.hand = opponent.hand.filter(card => card.instanceId !== cardToDiscard.instanceId);
            newState.discardPile.push(cardToDiscard);
            newState.log.push(`[Passive Effect] ${opponent.id} discarded ${cardToDiscard.name} due to Kyzy passive.`);
          } else {
            const onlyCardWasSummoned = opponent.hand.length === 1 && opponent.hand[0].instanceId === summonedKnowledge.instanceId;
            if (opponent.hand.length === 0 || onlyCardWasSummoned) {
              newState.log.push(`[Passive Effect] Kyzy triggered discard, but opponent ${opponent.id} had no other cards to discard.`);
            } else {
              newState.log.push(`[Passive Effect] Kyzy triggered discard, but opponent ${opponent.id} had no valid cards to discard.`);
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
          newState.log.push(`[Passive Effect] Japinunus (Owner: ${player.id}) grants +1 Power to owner.`);
          newState.log.push(`Power: ${initialPower} -> ${player.power}`);
        }
      }

      // Inkanyamba: AFTER_PLAYER_DRAW - Discard 1 card from market.
      else if (creature.id === 'inkanyamba' && trigger === 'AFTER_PLAYER_DRAW') {
        const drawingPlayerId = eventData.playerId;
        // Check if the drawing player is the owner of this Inkanyamba
        if (player.id === drawingPlayerId && newState.market.length > 0) {
          const cardToDiscard = newState.market[0]; // Discard the first card
          newState.market = newState.market.slice(1);
          newState.discardPile.push(cardToDiscard);
          newState.log.push(`[Passive Effect] Inkanyamba (Owner: ${player.id}) discards ${cardToDiscard.name} from Market.`);
          // Refill market if deck has cards
          if (newState.knowledgeDeck.length > 0) {
            const refillCard = { ...newState.knowledgeDeck.shift()!, instanceId: uuidv4() };
            newState.market.push(refillCard);
            newState.log.push(`[Passive Effect] Market refilled with ${refillCard.name}.`);
          }
        }
      }

      // --- KNOWLEDGE_LEAVE Trigger ---
      else if (trigger === 'KNOWLEDGE_LEAVE') {
        const leavingKnowledge = eventData.knowledgeCard;
        const ownerOfLeavingKnowledgeId = eventData.playerId;

        if (!leavingKnowledge) {
          console.warn("[Passives] KNOWLEDGE_LEAVE triggered without knowledgeCard data.");
          return; // Skip if no knowledge card info
        }

        // Lisovik: KNOWLEDGE_LEAVE (owner's knowledge) - If leaving knowledge is earth, deal 1 damage to opponent.
        if (creature.id === 'lisovik' && player.id === ownerOfLeavingKnowledgeId && leavingKnowledge.element === 'earth') {
          if (opponent) {
            const initialOpponentPower = opponent.power;
            opponent.power -= 1;
            newState.log.push(`[Passive Effect] Lisovik (Owner: ${player.id}) deals 1 damage to ${opponent.id} as ${leavingKnowledge.name} leaves play.`);
            newState.log.push(`Power: ${initialOpponentPower} -> ${opponent.power}`);
            console.log(`[Passives] Lisovik triggered. Opponent ${opponent.id} power: ${initialOpponentPower} -> ${opponent.power}`);
          } else {
            console.warn("[Passives] Lisovik triggered but opponent not found.");
          }
        }

        // Tsenehale: KNOWLEDGE_LEAVE (on self) - If leaving knowledge is air, owner gains +1 Power.
        if (creature.id === 'tsenehale' && player.id === ownerOfLeavingKnowledgeId && leavingKnowledge.element === 'air') {
          const oldPower = player.power;
          player.power += 1; // Modify player directly in newState
          newState.log.push(`[Passive Effect] Tsenehale (Owner: ${player.id}) grants +1 Power due to ${leavingKnowledge.name} leaving. Power: ${oldPower} -> ${player.power}`);
        }
      } // --- End KNOWLEDGE_LEAVE ---

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
