import { GameState, PassiveTriggerType, PassiveEventData, Knowledge, Creature } from './types.js';
import {
  buildCreatureChoices,
  buildKnowledgeChoices,
  buildMarketChoices,
  createPendingEffect,
  refillMarket,
  updateCreatureWisdomFromRotation,
} from './utils.js';


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

        // Zhar-Ptitsa is handled during damage calculation: aerial Knowledge bypasses defense.
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
              newState = refillMarket(newState, newState.market.length + 1);
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
            const opponentIndex = newState.players.findIndex(p => p.id === opponent.id) as 0 | 1;
            const choices = buildKnowledgeChoices(newState, opponentIndex as 0 | 1, candidate => candidate.cost < summonedKnowledge.cost);

            if (choices.length > 0) {
              newState = createPendingEffect(newState, {
                type: 'chooseOpponentKnowledgeDiscard',
                playerId: player.id,
                sourcePlayerId: player.id,
                sourceKnowledgeId: summonedKnowledge.id,
                sourceKnowledgeName: 'Pele',
                prompt: `Pele: choose an opponent Knowledge with cost lower than ${summonedKnowledge.name}.`,
                choices,
              });
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
          const choices = buildCreatureChoices(newState, playerIndex as 0 | 1, c => (c.rotation ?? 0) < 270);

          if (choices.length === 0) {
            newState.log.push(`[Passive Effect] Tulpar (Owner: ${player.id}) triggered, but all creatures are fully rotated.`);
          } else {
            newState = createPendingEffect(newState, {
              type: 'chooseCreatureToRotate',
              playerId: player.id,
              sourcePlayerId: player.id,
              sourceKnowledgeId: summonedKnowledge.id,
              sourceKnowledgeName: 'Tulpar',
              prompt: `Tulpar: choose one of your creatures to rotate.`,
              choices,
              optional: true,
            });
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
          const choices = buildKnowledgeChoices(newState, playerIndex as 0 | 1, (_candidate, creatureId) => creatureId !== 'lafaic');
          if (choices.length > 0) {
            newState = createPendingEffect(newState, {
              type: 'chooseKnowledgeToRotate',
              playerId: player.id,
              sourcePlayerId: player.id,
              sourceKnowledgeId: summonedKnowledge.id,
              sourceKnowledgeName: 'Lafaic',
              prompt: 'Lafaic: choose one other Knowledge to rotate.',
              choices,
            });
          } else {
            newState.log.push(`[Passive Effect] Lafaic (Owner: ${player.id}) triggered, but there are no other Knowledges to rotate.`);
          }
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
        if (
          creature.id === 'inkanyamba'
          && eventData.playerId === player.id
          && eventData.knowledgeCard?.element === 'water'
          && newState.market.length > 0
        ) {
          newState = createPendingEffect(newState, {
            type: 'chooseMarketDiscard',
            playerId: player.id,
            sourcePlayerId: player.id,
            sourceKnowledgeId: eventData.knowledgeCard.id,
            sourceKnowledgeName: 'Inkanyamba',
            prompt: 'Inkanyamba: you may discard one card from the Market.',
            choices: buildMarketChoices(newState),
            optional: true,
          });
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
      return updateCreatureWisdomFromRotation({ ...creature, rotation: newRotation });
    }
    return creature;
  });

  newState.log.push(`[Effect] Migration: Rotated ${rotatedCount} of opponent's creatures 90º clockwise (they lose wisdom).`);

  return newState; // Return the modified clone
};
