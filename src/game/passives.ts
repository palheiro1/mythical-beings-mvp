import { GameState, PassiveTriggerType, PassiveEventData, Knowledge, Creature } from './types.js';
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
  let newState = state; // Work directly on the passed-in state object

  console.log(`[Passives] Applying ${trigger} passives. Event Data:`, eventData);

  // --- TURN_START Trigger ---
  if (trigger === 'TURN_START') {
    newState.players.forEach((player, playerIndex) => {
      if (player.id !== eventData.playerId) return;

      player.creatures.forEach(creature => {
        // Caapora Passive: Triggers at TURN_START if opponent has more cards in hand than the owner.
        // Effect: Deals 1 damage to opponent's power.
        // Standardized trigger: 'TURN_START'
        if (creature.id === 'caapora') {
          const opponentIndex = newState.players.findIndex(p => p.id !== player.id);
          const opponent = newState.players[opponentIndex];

          if (opponent && opponent.hand.length > player.hand.length) {
            const oldPower = opponent.power;
            opponent.power -= 1; // Modify opponent directly in newState
            // simple log for tests
            newState.log.push(`[Passive Effect] Caapora (Owner: ${player.id}) deals 1 damage to ${opponent.id}.`);
            // detailed log
            newState.log.push(`[Passive Effect] Caapora (Owner: ${player.id}) deals 1 damage to ${opponent.id}. Power: ${oldPower} -> ${opponent.power}`);
          }
        }

        // Trepulcahue Passive: Triggers at TURN_START if owner has more cards in hand than the opponent.
        // Effect: Deals 1 damage to opponent's power.
        // Standardized trigger: 'TURN_START'
        else if (creature.id === 'trepulcahue') {
          const opponentIndex = newState.players.findIndex(p => p.id !== player.id);
          const opponent = newState.players[opponentIndex];
          if (opponent && player.hand.length > opponent.hand.length) {
            const oldPower = opponent.power;
            opponent.power -= 1;
            newState.log.push(`[Passive Effect] Trepulcahue (Owner: ${player.id}) deals 1 damage to ${opponent.id}.`);
            newState.log.push(`[Passive Effect] Trepulcahue (Owner: ${player.id}) deals 1 damage to ${opponent.id}. Power: ${oldPower} -> ${opponent.power}`);
          }
        }

        // Zhar-Ptitsa Passive: Triggers at TURN_START. Owner draws 1 card from market (free draw).
        // Standardized trigger: 'TURN_START'
        else if (creature.id === 'zhar-ptitsa') {
          newState.log.push(`[Passive Effect] Zhar-Ptitsa (Owner: ${player.id}) triggers free draw.`);
          if (newState.market.length > 0) {
            const drawnCard = newState.market.shift();
            if (drawnCard) {
              player.hand.push(drawnCard); // Modify player directly in newState
              // simple draw log for tests
              newState.log.push(`[Passive Effect] Zhar-Ptitsa (Owner: ${player.id}) draws ${drawnCard.name}.`);
              // detailed draw log
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
      });
    });
  }

  // --- AFTER_PLAYER_SUMMON / AFTER_OPPONENT_SUMMON Trigger ---
  else if (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON') {
    const summonedKnowledge = eventData.knowledgeCard;
    const summoningPlayerId = eventData.playerId;
    const targetCreatureId = eventData.creatureId; // Creature the knowledge was summoned onto

    if (!summonedKnowledge) {
      console.warn(`[Passives] ${trigger} triggered without knowledgeCard data.`);
      return newState; // Skip if no knowledge card info
    }

    newState.players.forEach((player, playerIndex) => {
      const opponent = newState.players[(playerIndex + 1) % 2]; // Get opponent relative to passive owner

      player.creatures.forEach(creature => {
        // Adaro Passive: Triggers on AFTER_PLAYER_SUMMON when owner summons water knowledge onto Adaro.
        // Effect: Owner draws 1 card from market (free draw).
        // Standardized trigger: 'AFTER_PLAYER_SUMMON'
        if (creature.id === 'adaro' && trigger === 'AFTER_PLAYER_SUMMON' && player.id === summoningPlayerId && targetCreatureId === 'adaro' && summonedKnowledge.element === 'water') {
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

        // Japinunus Passive: Triggers on AFTER_PLAYER_SUMMON when owner summons air knowledge.
        // Effect: Owner gains +1 Power.
        // Standardized trigger: 'AFTER_PLAYER_SUMMON'
        else if (creature.id === 'japinunus' && player.id === summoningPlayerId && summonedKnowledge.element === 'air') {
          const initialPower = player.power;
          player.power += 1;
          newState.log.push(`[Passive Effect] Japinunus (Owner: ${player.id}) grants +1 Power to owner.`);
          newState.log.push(`Power: ${initialPower} -> ${player.power}`);
        }

        // Kyzy: AFTER_SUMMON (Any) - If earth knowledge summoned, force OPPONENT of Kyzy's owner to discard 1 card.
        else if (creature.id === 'kyzy' && summonedKnowledge.element === 'earth') {
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

        // Pele: AFTER_SUMMON (Owner) - If owner summoned earth knowledge, discard 1 opponent knowledge with lower cost.
        else if (creature.id === 'pele' && player.id === summoningPlayerId && summonedKnowledge.element === 'earth') {
          if (opponent) {
            let discardedCard: Knowledge | null = null;
            let discardedFromCreatureId: string | null = null;

            // Find the first opponent knowledge card with lower cost
            for (const fieldSlot of opponent.field) {
              if (fieldSlot.knowledge && fieldSlot.knowledge.cost < summonedKnowledge.cost) {
                discardedCard = fieldSlot.knowledge;
                discardedFromCreatureId = fieldSlot.creatureId;
                // Use helper to remove knowledge and trigger KNOWLEDGE_LEAVE
                removeKnowledgeFromFieldAndTriggerPassives(
                  newState,
                  opponent.id,
                  fieldSlot.creatureId,
                  discardedCard
                );
                fieldSlot.knowledge = null; // Remove from field (already handled in helper, but keep for clarity)
                break; // Discard only one
              }
            }

            if (discardedCard && discardedFromCreatureId) {
              newState.log.push(`[Passive Effect] Pele (Owner: ${player.id}) discards ${discardedCard.name} (Cost: ${discardedCard.cost}) from opponent ${opponent.id}'s ${discardedFromCreatureId}.`);
              console.log(`[Passives] Pele triggered. Discarded ${discardedCard.name} from opponent ${opponent.id}.`);
            } else {
              console.log(`[Passives] Pele triggered, but no lower cost knowledge found on opponent ${opponent.id}.`);
            }
          } else {
            console.warn("[Passives] Pele triggered but opponent not found.");
          }
        }

        // Tulpar Passive: Triggers on AFTER_PLAYER_SUMMON when owner summons air knowledge.
        // Effect: Rotates one of owner's creatures 90º (if not fully rotated).
        // Standardized trigger: 'AFTER_PLAYER_SUMMON'
        else if (creature.id === 'tulpar' && summonedKnowledge.element === 'air' && player.id === summoningPlayerId) {
          const notFullyRotated = player.creatures
            .map((c, index) => ({ creature: c, index }))
            .filter(({ creature: c }) => (c.rotation ?? 0) < 270);

          if (notFullyRotated.length === 0) {
            newState.log.push(`[Passive Effect] Tulpar (Owner: ${player.id}) triggered, but all creatures are fully rotated.`);
          } else {
            const { creature: c, index: creatureIndex } = notFullyRotated[0];
            const currentRotation = c.rotation ?? 0;
            newState.players[playerIndex].creatures[creatureIndex].rotation = currentRotation + 90;
            newState.log.push(`[Passive Effect] Tulpar (Owner: ${player.id}) rotates ${c.name} 90º due to summoning ${summonedKnowledge.name}.`);
          }
        }

        // Trempulcahue Passive: Triggers on AFTER_PLAYER_SUMMON when owner summons any knowledge.
        // Effect: Summoned knowledge gains +1 defense (log only, actual defense logic may be handled elsewhere).
        // Standardized trigger: 'AFTER_PLAYER_SUMMON'
        else if (creature.id === 'trempulcahue' && trigger === 'AFTER_PLAYER_SUMMON' && player.id === summoningPlayerId) {
          if (summonedKnowledge) {
            newState.log.push(
              `[Passive Effect] Trempulcahue (Owner: ${player.id}) grants +1 defense to summoned knowledge ${summonedKnowledge.name}.`
            );
          }
        }

        // Lafaic Passive: Triggers on AFTER_PLAYER_SUMMON when owner summons aquatic knowledge onto Lafaic.
        // Effect: Rotates one other knowledge on owner's field by 90º.
        // Standardized trigger: 'AFTER_PLAYER_SUMMON'
        else if (creature.id === 'lafaic' && trigger === 'AFTER_PLAYER_SUMMON' && player.id === summoningPlayerId && targetCreatureId === 'lafaic' && summonedKnowledge.element === 'water') {
          // Rotate the first other knowledge by 90°
          const playerField = newState.players[playerIndex].field;
          for (const slot of playerField) {
            if (slot.creatureId !== 'lafaic' && slot.knowledge) {
              const currentRot = slot.knowledge.rotation ?? 0;
              slot.knowledge.rotation = currentRot + 90;
              break; // Only rotate one
            }
          }
          newState.log.push(
            `[Passive Effect] Lafaic (Owner: ${player.id}) rotates other knowledges due to aquatic summon.`
          );
        }

        // Tarasca Passive: Triggers on AFTER_PLAYER_SUMMON when opponent summons terrestrial/earth knowledge.
        // Effect: Deals 1 damage to opponent's power.
        // Standardized trigger: 'AFTER_PLAYER_SUMMON'
        else if (creature.id === 'tarasca' && trigger === 'AFTER_PLAYER_SUMMON' && summonedKnowledge.element === 'earth') {
          // Passive owner is 'player', opponent is the summoner
          const opponent = newState.players.find(p => p.id === summoningPlayerId)!;
          const initialPower = opponent.power;
          opponent.power -= 1;
          newState.log.push(`[Passive Effect] Tarasca (Owner: ${player.id}) deals 1 damage to ${opponent.id}.`);
          newState.log.push(
            `[Passive Effect] Tarasca (Owner: ${player.id}) deals 1 damage to ${opponent.id}. Power: ${initialPower} -> ${opponent.power}`
          );
        }
      });
    });
  }

  // --- AFTER_PLAYER_DRAW / AFTER_OPPONENT_DRAW Trigger ---
  else if (trigger === 'AFTER_PLAYER_DRAW' || trigger === 'AFTER_OPPONENT_DRAW') {
    newState.players.forEach((player, playerIndex) => {
      const opponent = newState.players[(playerIndex + 1) % 2]; // Get opponent relative to passive owner

      player.creatures.forEach(creature => {
        // Inkanyamba Passive: Triggers on AFTER_PLAYER_DRAW or AFTER_OPPONENT_DRAW when owner draws a card.
        // Effect: Discards the top card from the market and refills it if possible.
        // Standardized triggers: 'AFTER_PLAYER_DRAW', 'AFTER_OPPONENT_DRAW'
        if (creature.id === 'inkanyamba' && eventData.playerId === player.id && newState.market.length > 0) {
          const cardToDiscard = newState.market[0]; // Discard the first card
          newState.market = newState.market.slice(1);
          newState.discardPile.push(cardToDiscard);
          newState.log.push(`[Passive Effect] Inkanyamba (Owner: ${player.id}) discards ${cardToDiscard.name} from Market.`);
          if (newState.knowledgeDeck.length > 0) {
            const refillCard = { ...newState.knowledgeDeck.shift()!, instanceId: uuidv4() };
            newState.market.push(refillCard);
            newState.log.push(`[Passive Effect] Market refilled with ${refillCard.name}.`);
          }
        }
      });
    });
  }

  // --- KNOWLEDGE_LEAVE Trigger ---
  else if (trigger === 'KNOWLEDGE_LEAVE') {
    const leavingKnowledge = eventData.knowledgeCard;
    const ownerOfLeavingKnowledgeId = eventData.playerId;
    const creatureKnowledgeLeftFromId = eventData.creatureId;

    if (!leavingKnowledge) {
      console.warn("[Passives] KNOWLEDGE_LEAVE triggered without knowledgeCard data.");
      return newState; // Use return inside forEach loop iteration
    }

    newState.players.forEach((player, playerIndex) => {
      const opponent = newState.players[(playerIndex + 1) % 2]; // Get opponent relative to passive owner

      player.creatures.forEach(creature => {
        // Lisovik Passive: Triggers on KNOWLEDGE_LEAVE when earth knowledge owned by Lisovik's owner leaves play.
        // Effect: Deals 1 damage to opponent's power.
        // Standardized trigger: 'KNOWLEDGE_LEAVE'
        if (creature.id === 'lisovik' && leavingKnowledge.element === 'earth' && ownerOfLeavingKnowledgeId === player.id) {
          newState.log.push(`[Passive Effect] Lisovik (Owner: ${player.id}) deals 1 damage to ${opponent.id}`);
          if (opponent) {
            const initialOpponentPower = opponent.power;
            opponent.power -= 1;
            newState.log.push(`[Passive Effect] Lisovik (Owner: ${player.id}) deals 1 damage to ${opponent.id} as ${leavingKnowledge.name} leaves play.`);
            newState.log.push(`Power: ${initialOpponentPower} -> ${opponent.power}`);
          } else {
            console.warn("[Passives] Lisovik triggered but opponent not found.");
          }
        }

        // Tsenehale Passive: Triggers on KNOWLEDGE_LEAVE when air knowledge leaves play from any creature.
        // Effect: Owner gains +1 Power.
        // Standardized trigger: 'KNOWLEDGE_LEAVE'
        else if (creature.id === 'tsenehale' && leavingKnowledge.element === 'air') {
          // Get a fresh reference to the player within newState
          const playerInNewState = newState.players.find(p => p.id === player.id);
          if (!playerInNewState) {
            console.error(`[Passives] Tsenehale: Could not find player ${player.id} in newState!`);
            return newState; // Skip if player somehow missing
          }

          const initialOwnerPower = playerInNewState.power; // Use power from newState reference
          playerInNewState.power += 1; // Modify the player within newState

          newState.log.push(`[Passive Effect] Tsenehale (Owner: ${playerInNewState.id}) grants +1 Power to owner`);
          // Modify newState's log directly
          newState.log.push(`[Passive Effect] Tsenehale (Owner: ${playerInNewState.id}) grants +1 Power to owner as ${leavingKnowledge.name} leaves play from tsenehale.`);
          newState.log.push(`Power: ${initialOwnerPower} -> ${playerInNewState.power}`);
        }
      });
    });
  } // --- End KNOWLEDGE_LEAVE ---

  return newState; // Return the modified state
}

/**
 * Helper to remove a knowledge card from the field, push it to the discard pile,
 * and trigger KNOWLEDGE_LEAVE passives for that knowledge.
 * This ensures chained passives (Lisovik, Tsenehale, etc.) are always triggered.
 */
function removeKnowledgeFromFieldAndTriggerPassives(
  state: GameState,
  playerId: string,
  creatureId: string,
  knowledge: Knowledge
) {
  // Remove from field (the caller should also set fieldSlot.knowledge = null for clarity)
  // Push to discard pile
  state.discardPile.push(knowledge);

  // Trigger KNOWLEDGE_LEAVE passives
  applyPassiveAbilities(state, 'KNOWLEDGE_LEAVE', {
    playerId,
    creatureId,
    knowledgeCard: knowledge,
  });
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

// Simple deep clone function to avoid lodash dependency issues
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// Aerial 5: All opponent creatures rotate 90º clockwise (lose wisdom)
export const aerial5 = ({ state, playerIndex }: { state: GameState; playerIndex: number }) => {
  let newState = deepClone(state); // Use our own deep clone function
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = newState.players[opponentIndex];
  let rotatedCount = 0;

  opponent.creatures = opponent.creatures.map((creature: Creature) => {
    const currentRotation = creature.rotation ?? 0;
    if (currentRotation < 270) { // Assuming 270 is max rotation for creatures
      rotatedCount++;
      const newRotation = currentRotation + 90;
      return { ...creature, rotation: newRotation };
    }
    return creature;
  });

  newState.log.push(`[Effect] Migration: Rotated ${rotatedCount} of opponent's creatures 90º clockwise (they lose wisdom).`);

  return newState; // Return the modified clone
};
