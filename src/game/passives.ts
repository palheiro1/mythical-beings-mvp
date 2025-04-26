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

  // Iterate through both players by index
  for (let pIdx = 0; pIdx < newState.players.length; pIdx++) {
    const player = newState.players[pIdx]; // Direct reference to player in newState
    const opponentIdx = getOpponentPlayerIndex(newState, player.id);
    // Ensure opponent exists before proceeding with passives that affect them
    const opponent = opponentIdx !== -1 ? newState.players[opponentIdx] : null;

    if (!player) continue; // Should not happen

    // Iterate through creatures of the current player (pIdx)
    for (const creature of player.creatures) {
      if (!creature || !creature.passiveAbility) continue; // Skip if no creature or no passive

      // --- Trigger Logic --- Refactored to modify newState directly ---

      // Caapora
      if (creature.id === 'caapora' && trigger === 'TURN_START' && eventData.playerId === player.id) {
        if (opponent && opponent.hand.length > player.hand.length) {
          const oldPower = opponent.power;
          opponent.power -= 1; // Modify opponent directly in newState
          newState.log.push(`[Passive Effect] Caapora (Owner: ${player.id}) deals 1 damage to ${opponent.id}. Power: ${oldPower} -> ${opponent.power}`);
        }
      }

      // Adaro
      else if (creature.id === 'adaro' && trigger === 'AFTER_PLAYER_SUMMON' && eventData.playerId === player.id && eventData.creatureId === creature.id) {
        const summonedKnowledge = eventData.knowledgeCard;
        if (summonedKnowledge && summonedKnowledge.element === 'water') {
          newState.log.push(`[Passive Effect] Adaro (Owner: ${player.id}) triggers free draw.`);
          if (newState.market.length > 0) {
             const drawnCard = newState.market.shift();
             if (drawnCard) {
               player.hand.push(drawnCard); // Modify player directly in newState
               newState.log.push(`[Passive Effect] Adaro (Owner: ${player.id}) draws ${drawnCard.name}. Hand size: ${player.hand.length}`);
               if (newState.knowledgeDeck.length > 0) {
                 const refillCard = { ...newState.knowledgeDeck.shift()!, instanceId: uuidv4() };
                 newState.market.push(refillCard);
                 newState.log.push(`[Passive Effect] Market refilled with ${refillCard.name}.`);
               }
             }
          } else {
            newState.log.push(`[Passive Effect] Adaro (Owner: ${player.id}) triggered, but Market is empty.`);
          }
           // No need to save player back, already modified newState.players[pIdx]
        }
      }

      // Kyzy
      else if (creature.id === 'kyzy' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
          const summonedKnowledge = eventData.knowledgeCard;
          const summoningPlayerId = eventData.playerId;
          const opponentOfSummonerIdx = getOpponentPlayerIndex(newState, summoningPlayerId);
          const opponentOfSummoner = opponentOfSummonerIdx !== -1 ? newState.players[opponentOfSummonerIdx] : null;

          // Check if *this* Kyzy's owner (player) is the opponent of the summoner
          if (summonedKnowledge && summonedKnowledge.element === 'earth' && opponentOfSummoner && opponentOfSummoner.id === player.id) {
              newState.log.push(`[Passive Effect] Kyzy (Owner: ${player.id}) forces discard from ${summoningPlayerId} (summoner).`);
              const summonerIdx = getPlayerIndex(newState, summoningPlayerId);
              if (summonerIdx !== -1) {
                  const summoner = newState.players[summonerIdx];
                  if (summoner.hand.length > 0) {
                      const discardedCard = summoner.hand.pop(); // Discard last card from summoner
                      if (discardedCard) {
                          newState.discardPile.push(discardedCard);
                          newState.log.push(`[Passive Effect] ${summoner.id} discarded ${discardedCard.name}.`);
                      }
                  } else {
                      newState.log.push(`[Passive Effect] ${summoner.id} had no cards to discard.`);
                  }
              }
          }
      }

      // Japinunus
      else if (creature.id === 'japinunus' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
          const summonedKnowledge = eventData.knowledgeCard;
          const summoningPlayerId = eventData.playerId;
          // Check if the owner of this Japinunus (player) is the one who summoned
          if (summonedKnowledge && summonedKnowledge.element === 'air' && player.id === summoningPlayerId) {
              const oldPower = player.power;
              player.power += 1; // Modify player directly in newState
              newState.log.push(`[Passive Effect] Japinunus (Owner: ${player.id}) grants +1 Power due to summoning ${summonedKnowledge.name}. Power: ${oldPower} -> ${player.power}`);
              // No need to save player back
          }
      }

      // Kappa - Logic handled in isValidAction

      // Dudugera - Logic handled in isValidAction / reducer

      // Inkanyamba
      else if (creature.id === 'inkanyamba' && trigger === 'AFTER_PLAYER_DRAW' && eventData.playerId === player.id) {
          newState.log.push(`[Passive Effect] Inkanyamba (Owner: ${player.id}) triggers market discard.`);
          if (newState.market.length > 0) {
              const discardedCard = newState.market.shift();
              if (discardedCard) {
                  newState.discardPile.push(discardedCard);
                  newState.log.push(`[Passive Effect] ${discardedCard.name} discarded from Market.`);
                  if (newState.knowledgeDeck.length > 0) {
                      const refillCard = { ...newState.knowledgeDeck.shift()!, instanceId: uuidv4() };
                      newState.market.push(refillCard);
                      newState.log.push(`[Passive Effect] Market refilled with ${refillCard.name}.`);
                  }
              }
          } else {
              newState.log.push(`[Passive Effect] Inkanyamba triggered, but Market is empty.`);
          }
      }

      // Lisovik
      else if (creature.id === 'lisovik' && trigger === 'KNOWLEDGE_LEAVE' && eventData.playerId === player.id) {
          const leavingKnowledge = eventData.knowledgeCard;
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
                  // Directly modify the creature within newState.players[pIdx].creatures
                  newState.players[pIdx].creatures[creatureIndex].rotation = currentRotation + 90;
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

    } // End loop through creatures
  } // End loop through players

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
