import { GameState, PassiveTriggerType, PassiveEventData, Knowledge, PlayerState } from './types'; // Added PlayerState
import { getOpponentState, getPlayerState } from './utils'; // Added getPlayerState

// Helper function to find a specific knowledge card on a player's field
function findKnowledgeOnField(player: PlayerState, knowledgeId: string): Knowledge | null {
    for (const slot of player.field) {
        if (slot.knowledge && slot.knowledge.id === knowledgeId) {
            return slot.knowledge;
        }
    }
    return null;
}

// Helper function to find the field slot index for a specific knowledge card
function findFieldSlotIndexWithKnowledge(player: PlayerState, knowledgeId: string): number {
    return player.field.findIndex(slot => slot.knowledge && slot.knowledge.id === knowledgeId);
}


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
  // Note: Standard structuredClone might be better if available/compatible
  let newState = JSON.parse(JSON.stringify(state)) as GameState;

  // Iterate through both players
  for (let playerIndex = 0; playerIndex < newState.players.length; playerIndex++) {
    const pId = newState.players[playerIndex].id;
    // Re-fetch player and opponent states inside the loop for safety,
    // as the newState object can be modified by passives.
    let player = getPlayerState(newState, pId);
    let opponent = getOpponentState(newState, pId);

    if (!player) continue; // Should not happen

    for (const creature of player.creatures) {
      if (!creature || !creature.passiveAbility) continue; // Skip if no creature or no passive

      // Re-fetch opponent state as it might have been modified by a previous creature's passive
      opponent = getOpponentState(newState, pId);
      if (!opponent) continue; // Should always find an opponent

      // --- Trigger Logic ---

      // Example: Caapora - "At the start of your turn, if the Opponent has more cards in hand than you, deal 1 damage to the Opponent."
      if (creature.id === 'caapora' && trigger === 'TURN_START' && eventData.playerId === pId) {
        if (opponent.hand.length > player.hand.length) {
          console.log(`Passive Triggered: Caapora deals 1 damage to ${opponent.id}`);
          opponent.power -= 1;
          newState.log.push(`${player.id}'s Caapora passive deals 1 damage to ${opponent.id}.`);
          // Update the opponent state in the main state object
          const opponentIndex = newState.players.findIndex(p => p.id === opponent!.id);
          if (opponentIndex !== -1) {
            newState.players[opponentIndex] = opponent;
          }
        }
      }

      // Example: Adaro - "When Adaro summons an aquatic Knowledge, draw a card from the Market (no Action cost)."
      if (creature.id === 'adaro' && trigger === 'AFTER_PLAYER_SUMMON' && eventData.playerId === pId && eventData.creatureId === creature.id) {
        const summonedKnowledge = eventData.knowledgeCard;
        if (summonedKnowledge && summonedKnowledge.element === 'water') {
          console.log(`Passive Triggered: Adaro allows ${pId} to draw a card.`);
          newState.log.push(`${player.id}'s Adaro passive triggers a free draw.`);
          // Call the draw action logic directly or dispatch a new action if needed
          // For simplicity, let's assume we can call a part of the draw logic here.
          // This needs careful implementation to avoid side effects or infinite loops.
          // We'll simulate the core draw logic here for now.
          if (newState.market.length > 0) {
             const drawnCard = newState.market.shift(); // Take from market
             if (drawnCard) {
               player.hand.push(drawnCard);
               newState.log.push(`${player.id} draws ${drawnCard.name} via Adaro passive.`);
               // Refill market (simplified)
               if (newState.knowledgeDeck.length > 0) {
                 newState.market.push(newState.knowledgeDeck.shift()!);
               }
             }
          } else {
            newState.log.push(`Adaro passive triggered, but Market is empty.`);
          }
           // Update player state
           const playerIndex = newState.players.findIndex(p => p.id === pId);
           if (playerIndex !== -1) {
             newState.players[playerIndex] = player;
           }
        }
      }

      // --- Add logic for other creatures and triggers here ---
      // Example: Kyzy - "When any player summons a terrestrial Knowledge, the Opponent must discard 1 card."
      if (creature.id === 'kyzy' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
          const summonedKnowledge = eventData.knowledgeCard;
          const summoningPlayerId = eventData.playerId;
          const opponentOfSummoner = getOpponentState(newState, summoningPlayerId);

          if (summonedKnowledge && summonedKnowledge.element === 'earth' && opponentOfSummoner && opponentOfSummoner.id === pId) { // Check if *this* Kyzy's owner is the opponent of the summoner
              console.log(`Passive Triggered: Kyzy forces ${opponentOfSummoner.id} (summoner's opponent) to discard.`);
              if (opponentOfSummoner.hand.length > 0) {
                  const discardedCard = opponentOfSummoner.hand.pop(); // Discard last card for simplicity
                  newState.discardPile.push(discardedCard!);
                  newState.log.push(`${opponentOfSummoner.id} discards ${discardedCard!.name} due to Kyzy passive.`);
                  // Update opponent state
                  const opponentIndex = newState.players.findIndex(p => p.id === opponentOfSummoner!.id);
                  if (opponentIndex !== -1) {
                      newState.players[opponentIndex] = opponentOfSummoner;
                  }
              } else {
                  newState.log.push(`Kyzy passive triggered, but ${opponentOfSummoner.id} has no cards to discard.`);
              }
          }
      }


      // Example: Tarasca - "When the Opponent summons a terrestrial Knowledge, deal 1 damage to the Opponent."
       if (creature.id === 'tarasca' && trigger === 'AFTER_OPPONENT_SUMMON' && eventData.playerId !== pId) { // Triggered by opponent's action
           const summonedKnowledge = eventData.knowledgeCard;
           let opponentPlayer = getPlayerState(newState, eventData.playerId); // The player who summoned

           if (summonedKnowledge && summonedKnowledge.element === 'earth' && opponentPlayer) {
               console.log(`Passive Triggered: Tarasca deals 1 damage to ${opponentPlayer.id}`);
               opponentPlayer.power -= 1;
               newState.log.push(`${pId}'s Tarasca passive deals 1 damage to ${opponentPlayer.id}.`);
               // Update opponent state
               const opponentPlayerIndex = newState.players.findIndex(p => p.id === opponentPlayer!.id);
               if (opponentPlayerIndex !== -1) {
                   newState.players[opponentPlayerIndex] = opponentPlayer;
               }
           }
       }

      // Example: Inkanyamba - "When you draw an aquatic Knowledge, you may discard 1 card from the Market."
      if (creature.id === 'inkanyamba' && trigger === 'AFTER_PLAYER_DRAW' && eventData.playerId === pId) {
          const drawnKnowledge = eventData.knowledgeCard; // Assuming eventData contains the drawn card
          if (drawnKnowledge && drawnKnowledge.element === 'water') {
              if (newState.market.length > 0) {
                  const discardedCard = newState.market.shift(); // Discard top card
                  newState.discardPile.push(discardedCard!);
                  newState.log.push(`${pId}'s Inkanyamba passive discards ${discardedCard!.name} from the Market.`);
                  // Refill market (simplified) - TODO: Ensure this doesn't conflict with standard refill logic
                  if (newState.knowledgeDeck.length > 0) {
                      newState.market.push(newState.knowledgeDeck.shift()!);
                  }
              } else {
                  newState.log.push(`Inkanyamba passive triggered, but Market is empty.`);
              }
          }
      }

      // Example: Japinunus - "Your aeric Knowledges gain: 'On Summon: +1 Power'."
      if (creature.id === 'japinunus' && trigger === 'AFTER_PLAYER_SUMMON' && eventData.playerId === pId) {
          const summonedKnowledge = eventData.knowledgeCard;
          if (summonedKnowledge && summonedKnowledge.element === 'air') {
              // Grant +1 Power directly to the player for MVP
              player.power += 1;
              newState.log.push(`${pId}'s Japinunus passive grants +1 Power due to summoning ${summonedKnowledge.name}.`);
              // Update player state in newState
              newState.players[playerIndex] = player;
          }
      }

      // Example: Lisovik - "Your terrestrial Knowledges gain: 'On Leave: Deal 1 damage'."
      if (creature.id === 'lisovik' && trigger === 'KNOWLEDGE_LEAVE' && eventData.playerId === pId) {
          const leavingKnowledge = eventData.knowledgeCard; // Assuming eventData contains the leaving card
          if (leavingKnowledge && leavingKnowledge.element === 'earth') {
              console.log(`Passive Triggered: Lisovik deals 1 damage to ${opponent.id}`);
              opponent.power -= 1;
              newState.log.push(`${pId}'s Lisovik passive (via ${leavingKnowledge.name}) deals 1 damage to ${opponent.id}.`);
              // Update opponent state
              const opponentIndex = newState.players.findIndex(p => p.id === opponent!.id);
              if (opponentIndex !== -1) {
                  newState.players[opponentIndex] = opponent;
              }
          }
      }

      // Example: Pele - "When Pele summons a terrestrial Knowledge, discard an Opponent's Knowledge with a lower Wisdom cost."
      if (creature.id === 'pele' && trigger === 'AFTER_PLAYER_SUMMON' && eventData.playerId === pId && eventData.creatureId === creature.id) {
          const summonedKnowledge = eventData.knowledgeCard;
          if (summonedKnowledge && summonedKnowledge.element === 'earth') {
              let targetToDiscard: { knowledge: Knowledge; fieldSlotIndex: number } | null = null;
              let minCostFound = summonedKnowledge.cost;

              // Find the lowest cost knowledge on opponent's field that costs less than the summoned one
              opponent.field.forEach((oppFieldSlot, oppFieldSlotIndex) => {
                  if (oppFieldSlot.knowledge && oppFieldSlot.knowledge.cost < minCostFound) {
                      minCostFound = oppFieldSlot.knowledge.cost; // Update the minimum cost found so far
                      targetToDiscard = { knowledge: oppFieldSlot.knowledge, fieldSlotIndex: oppFieldSlotIndex };
                  } else if (oppFieldSlot.knowledge && oppFieldSlot.knowledge.cost === minCostFound && targetToDiscard) {
                      // Optional: Tie-breaking logic if multiple targets have the same lowest cost.
                      // For now, we just keep the first one found with the minimum cost.
                  }
              });


              if (targetToDiscard) {
                  const discardedKnowledge = targetToDiscard.knowledge;
                  const discardSlotIndex = targetToDiscard.fieldSlotIndex;
                  console.log(`Passive Triggered: Pele targets ${discardedKnowledge.name} (Cost ${discardedKnowledge.cost}) in slot ${discardSlotIndex} on ${opponent.id}'s field.`);

                  // Remove from opponent's field and add to discard pile
                  opponent.field[discardSlotIndex].knowledge = null; // Clear the knowledge from the slot
                  newState.discardPile.push(discardedKnowledge);
                  newState.log.push(`${pId}'s Pele passive discards ${discardedKnowledge.name} (Cost ${discardedKnowledge.cost}) from ${opponent.id}.`);

                  // --- Trigger KNOWLEDGE_LEAVE for the discarded card ---
                  // Important: Call applyPassiveAbilities recursively AFTER updating the state
                  // to reflect the discard, but BEFORE returning the final state.
                  // Pass the opponent's ID as the player who owned the knowledge.
                  const stateBeforeLeaveTrigger = JSON.parse(JSON.stringify(newState)) as GameState; // Snapshot state before potential recursive changes
                  newState = applyPassiveAbilities(stateBeforeLeaveTrigger, 'KNOWLEDGE_LEAVE', {
                      playerId: opponent.id, // The owner of the knowledge that left
                      knowledgeCard: discardedKnowledge,
                      // Optional: Add context like 'discardedByPassive: true' if needed
                  });
                  // --- End KNOWLEDGE_LEAVE trigger ---


                  // Update opponent state in newState (redundant if getOpponentState fetches fresh copy, but safe)
                  const opponentIndex = newState.players.findIndex(p => p.id === opponent!.id);
                  if (opponentIndex !== -1) {
                      newState.players[opponentIndex] = opponent;
                  }

              } else {
                  newState.log.push(`Pele passive triggered, but no valid target (lower cost knowledge) found on ${opponent.id}'s field.`);
              }
          }
      }

      // Example: Tsenehale - "Your aeric Knowledges gain: 'On Leave: +1 Power'."
      if (creature.id === 'tsenehale' && trigger === 'KNOWLEDGE_LEAVE' && eventData.playerId === pId) {
          const leavingKnowledge = eventData.knowledgeCard;
          if (leavingKnowledge && leavingKnowledge.element === 'air') {
              console.log(`Passive Triggered: Tsenehale grants +1 Power to ${pId}`);
              player.power += 1; // Grant power to the player owning Tsenehale
              newState.log.push(`${pId}'s Tsenehale passive (via ${leavingKnowledge.name}) grants +1 Power.`);
              // Update player state
              newState.players[playerIndex] = player;
          }
      }

      // Example: Tulpar - "When Tulpar summons an aeric Knowledge, rotate this creature 1 time (no Action cost)."
      if (creature.id === 'tulpar' && trigger === 'AFTER_PLAYER_SUMMON' && eventData.playerId === pId && eventData.creatureId === creature.id) {
          const summonedKnowledge = eventData.knowledgeCard;
          if (summonedKnowledge && summonedKnowledge.element === 'air') {
              console.log(`Passive Triggered: Tulpar rotates.`);
              const tulparCreatureIndex = player.creatures.findIndex(c => c.id === 'tulpar');
              if (tulparCreatureIndex !== -1) {
                  const tulparCreature = player.creatures[tulparCreatureIndex];
                  const currentRotation = tulparCreature.rotation ?? 0;
                  // Check if max rotation reached (assuming 270 is max for creatures)
                  if (currentRotation < 270) {
                      tulparCreature.currentWisdom = (tulparCreature.currentWisdom ?? tulparCreature.baseWisdom) + 1;
                      tulparCreature.rotation = currentRotation + 90;
                      newState.log.push(`${pId}'s Tulpar passive triggers a rotation. Wisdom: ${tulparCreature.currentWisdom}, Rotation: ${tulparCreature.rotation}deg.`);
                      // Update player state
                      newState.players[playerIndex] = player;
                  } else {
                      newState.log.push(`${pId}'s Tulpar passive triggered, but Tulpar is already at max rotation.`);
                  }
              }
          }
      }

      // --- Update player/opponent references after potential modifications ---
      // Re-fetch player and opponent states from the potentially modified newState
      // This is crucial because a passive might modify player/opponent state,
      // affecting subsequent passive checks within the same trigger event.
      player = getPlayerState(newState, pId);
      opponent = getOpponentState(newState, pId);
      if (!player || !opponent) break; // Exit inner loop if state becomes invalid

      // --- Passives requiring integration elsewhere ---

      // TODO: Dudugera/Kappa - Affect action cost. Needs check during 'summonKnowledge' validation or 'BEFORE_ACTION_VALIDATION' trigger.
      // if ((creature.id === 'dudugera' || (creature.id === 'kappa' && summonedKnowledge?.element === 'water')) && trigger === 'BEFORE_ACTION_VALIDATION'...)

      // TODO: Trepulcahue - "+1 Defense to Knowledges". Static effect. Apply during damage calculation or modify base stats.
      // if (creature.id === 'trepulcahue' && trigger === 'DAMAGE_CALCULATION'...)

      // TODO: Zhar Ptitsa - "Aeric Knowledges cannot be blocked". Static effect. Apply during block declaration/validation phase.


      // TODO: Implement other passives based on creatures.json and triggers
      // - Inkanyamba: Needs 'AFTER_PLAYER_DRAW' trigger - DONE
      // - Japinunus: Needs modification in summonKnowledge action or 'AFTER_PLAYER_SUMMON' trigger to add power - DONE (Placeholder)
      // - Lisovik: Needs 'KNOWLEDGE_LEAVE' trigger - DONE
      // - Pele: Needs 'AFTER_PLAYER_SUMMON' trigger (check element, compare cost, discard opponent knowledge) - DONE
      // - Trepulcahue: Needs 'DAMAGE_CALCULATION' trigger or modification in damage logic - TODO (Comment added)
      // - Tsenehale: Needs 'KNOWLEDGE_LEAVE' trigger - DONE
      // - Tulpar: Needs 'AFTER_PLAYER_SUMMON' trigger (check element, rotate self) - DONE (Placeholder)
      // - Zhar Ptitsa: Needs modification in how knowledge effects/blocking are handled - TODO (Comment added)

    } // End loop through creatures
  } // End loop through players

  return newState; // Return the modified state
}
