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
  let newState = JSON.parse(JSON.stringify(state)) as GameState;
  newState.log.push(`[Passive Check] Trigger: ${trigger}, Player: ${eventData.playerId}, Data: ${JSON.stringify(eventData)}`);

  // Iterate through both players
  for (let playerIndex = 0; playerIndex < newState.players.length; playerIndex++) {
    const pId = newState.players[playerIndex].id;
    let player = getPlayerState(newState, pId);
    let opponent = getOpponentState(newState, pId);

    if (!player) continue; // Should not happen

    for (const creature of player.creatures) {
      if (!creature || !creature.passiveAbility) continue; // Skip if no creature or no passive

      // Re-fetch opponent state as it might have been modified by a previous creature's passive
      opponent = getOpponentState(newState, pId);
      if (!opponent) continue; // Should always find an opponent

      // --- Trigger Logic ---
      newState.log.push(`[Passive Check] Evaluating ${creature.id} (Owner: ${pId}) for trigger ${trigger}`);

      // Caapora
      if (creature.id === 'caapora' && trigger === 'TURN_START' && eventData.playerId === pId) {
        newState.log.push(`[Passive Condition] Caapora (Owner: ${pId}) checks hand sizes: P ${player.hand.length}, Opp ${opponent.hand.length}`);
        if (opponent.hand.length > player.hand.length) {
          const oldPower = opponent.power;
          opponent.power -= 1;
          newState.log.push(`[Passive Effect] Caapora (Owner: ${pId}) deals 1 damage to ${opponent.id}. Power: ${oldPower} -> ${opponent.power}`);
          const opponentIndex = newState.players.findIndex(p => p.id === opponent!.id);
          if (opponentIndex !== -1) newState.players[opponentIndex] = opponent;
        }
      }

      // Adaro
      if (creature.id === 'adaro' && trigger === 'AFTER_PLAYER_SUMMON' && eventData.playerId === pId && eventData.creatureId === creature.id) {
        const summonedKnowledge = eventData.knowledgeCard;
        newState.log.push(`[Passive Condition] Adaro (Owner: ${pId}) checks summoned knowledge: ${summonedKnowledge?.name} (Element: ${summonedKnowledge?.element})`);
        if (summonedKnowledge && summonedKnowledge.element === 'water') {
          newState.log.push(`[Passive Effect] Adaro (Owner: ${pId}) triggers free draw.`);
          if (newState.market.length > 0) {
             const drawnCard = newState.market.shift();
             if (drawnCard) {
               player.hand.push(drawnCard);
               newState.log.push(`[Passive Effect] Adaro (Owner: ${pId}) draws ${drawnCard.name}. Hand size: ${player.hand.length}`);
               if (newState.knowledgeDeck.length > 0) {
                 const refillCard = newState.knowledgeDeck.shift()!;
                 newState.market.push(refillCard);
                 newState.log.push(`[Passive Effect] Market refilled with ${refillCard.name}.`);
               }
             }
          } else {
            newState.log.push(`[Passive Effect] Adaro (Owner: ${pId}) triggered, but Market is empty.`);
          }
           const currentPlayerIndex = newState.players.findIndex(p => p.id === pId);
           if (currentPlayerIndex !== -1) newState.players[currentPlayerIndex] = player;
        }
      }

      // Kyzy
      if (creature.id === 'kyzy' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
          const summonedKnowledge = eventData.knowledgeCard;
          const summoningPlayerId = eventData.playerId;
          const opponentOfSummoner = getOpponentState(newState, summoningPlayerId);
          newState.log.push(`[Passive Condition] Kyzy (Owner: ${pId}) checks summon: ${summonedKnowledge?.name} (Element: ${summonedKnowledge?.element}), Summoner: ${summoningPlayerId}, Kyzy's owner is Opponent?: ${opponentOfSummoner?.id === pId}`);

          if (summonedKnowledge && summonedKnowledge.element === 'earth' && opponentOfSummoner && opponentOfSummoner.id === pId) { // Check if *this* Kyzy's owner is the opponent of the summoner
              newState.log.push(`[Passive Effect] Kyzy (Owner: ${pId}) forces discard from ${opponentOfSummoner.id} (summoner's opponent).`);
              if (opponentOfSummoner.hand.length > 0) {
                  const discardedCard = opponentOfSummoner.hand.pop(); // Discard last card for simplicity
                  newState.discardPile.push(discardedCard!);
                  newState.log.push(`[Passive Effect] ${opponentOfSummoner.id} discards ${discardedCard!.name} due to Kyzy (Owner: ${pId}). Hand size: ${opponentOfSummoner.hand.length}`);
                  const opponentIndex = newState.players.findIndex(p => p.id === opponentOfSummoner!.id);
                  if (opponentIndex !== -1) newState.players[opponentIndex] = opponentOfSummoner;
              } else {
                  newState.log.push(`[Passive Effect] Kyzy (Owner: ${pId}) triggered, but ${opponentOfSummoner.id} has no cards to discard.`);
              }
          }
      }

      // Tarasca
       if (creature.id === 'tarasca' && trigger === 'AFTER_OPPONENT_SUMMON' && eventData.playerId !== pId) { // Triggered by opponent's action
           const summonedKnowledge = eventData.knowledgeCard;
           let opponentPlayer = getPlayerState(newState, eventData.playerId); // The player who summoned
           newState.log.push(`[Passive Condition] Tarasca (Owner: ${pId}) checks opponent summon: ${summonedKnowledge?.name} (Element: ${summonedKnowledge?.element}), Summoner: ${eventData.playerId}`);

           if (summonedKnowledge && summonedKnowledge.element === 'earth' && opponentPlayer) {
               const oldPower = opponentPlayer.power;
               opponentPlayer.power -= 1;
               newState.log.push(`[Passive Effect] Tarasca (Owner: ${pId}) deals 1 damage to ${opponentPlayer.id}. Power: ${oldPower} -> ${opponentPlayer.power}`);
               const opponentPlayerIndex = newState.players.findIndex(p => p.id === opponentPlayer!.id);
               if (opponentPlayerIndex !== -1) newState.players[opponentPlayerIndex] = opponentPlayer;
           }
       }

      // Inkanyamba
      if (creature.id === 'inkanyamba' && trigger === 'AFTER_PLAYER_DRAW' && eventData.playerId === pId) {
          const drawnKnowledge = eventData.knowledgeCard;
          newState.log.push(`[Passive Condition] Inkanyamba (Owner: ${pId}) checks drawn card: ${drawnKnowledge?.name} (Element: ${drawnKnowledge?.element})`);
          if (drawnKnowledge && drawnKnowledge.element === 'water') {
              newState.log.push(`[Passive Effect] Inkanyamba (Owner: ${pId}) triggers market discard.`);
              if (newState.market.length > 0) {
                  const discardedCard = newState.market.shift();
                  newState.discardPile.push(discardedCard!);
                  newState.log.push(`[Passive Effect] Inkanyamba (Owner: ${pId}) discards ${discardedCard!.name} from Market.`);
                  if (newState.knowledgeDeck.length > 0) {
                      const refillCard = newState.knowledgeDeck.shift()!;
                      newState.market.push(refillCard);
                      newState.log.push(`[Passive Effect] Market refilled with ${refillCard.name}.`);
                  }
              } else {
                  newState.log.push(`[Passive Effect] Inkanyamba (Owner: ${pId}) triggered, but Market is empty.`);
              }
          }
      }

      // Japinunus
      if (creature.id === 'japinunus' && trigger === 'AFTER_PLAYER_SUMMON' && eventData.playerId === pId) {
          const summonedKnowledge = eventData.knowledgeCard;
          newState.log.push(`[Passive Condition] Japinunus (Owner: ${pId}) checks summoned card: ${summonedKnowledge?.name} (Element: ${summonedKnowledge?.element})`);
          if (summonedKnowledge && summonedKnowledge.element === 'air') {
              const oldPower = player.power;
              player.power += 1;
              newState.log.push(`[Passive Effect] Japinunus (Owner: ${pId}) grants +1 Power due to summoning ${summonedKnowledge.name}. Power: ${oldPower} -> ${player.power}`);
              newState.players[playerIndex] = player;
          }
      }

      // Lisovik
      if (creature.id === 'lisovik' && trigger === 'KNOWLEDGE_LEAVE' && eventData.playerId === pId) {
          const leavingKnowledge = eventData.knowledgeCard;
          newState.log.push(`[Passive Condition] Lisovik (Owner: ${pId}) checks leaving card: ${leavingKnowledge?.name} (Element: ${leavingKnowledge?.element})`);
          if (leavingKnowledge && leavingKnowledge.element === 'earth') {
              const oldPower = opponent.power;
              opponent.power -= 1;
              newState.log.push(`[Passive Effect] Lisovik (Owner: ${pId}, via ${leavingKnowledge.name}) deals 1 damage to ${opponent.id}. Power: ${oldPower} -> ${opponent.power}`);
              const opponentIndex = newState.players.findIndex(p => p.id === opponent!.id);
              if (opponentIndex !== -1) newState.players[opponentIndex] = opponent;
          }
      }

      // Pele
      if (creature.id === 'pele' && trigger === 'AFTER_PLAYER_SUMMON' && eventData.playerId === pId && eventData.creatureId === creature.id) {
          const summonedKnowledge = eventData.knowledgeCard;
          newState.log.push(`[Passive Condition] Pele (Owner: ${pId}) checks summoned card: ${summonedKnowledge?.name} (Element: ${summonedKnowledge?.element}, Cost: ${summonedKnowledge?.cost})`);
          if (summonedKnowledge && summonedKnowledge.element === 'earth') {
              let targetToDiscard: { knowledge: Knowledge; fieldSlotIndex: number } | null = null;
              let minCostFound = summonedKnowledge.cost;
              newState.log.push(`[Passive Condition] Pele searching opponent (${opponent.id}) field for knowledge with cost < ${minCostFound}`);

              opponent.field.forEach((oppFieldSlot, oppFieldSlotIndex) => {
                  if (oppFieldSlot.knowledge) {
                      newState.log.push(`[Passive Condition] Pele checking slot ${oppFieldSlotIndex}: ${oppFieldSlot.knowledge.name} (Cost ${oppFieldSlot.knowledge.cost})`);
                      if (oppFieldSlot.knowledge.cost < minCostFound) {
                          minCostFound = oppFieldSlot.knowledge.cost;
                          targetToDiscard = { knowledge: oppFieldSlot.knowledge, fieldSlotIndex: oppFieldSlotIndex };
                          newState.log.push(`[Passive Condition] Pele found new potential target: ${targetToDiscard.knowledge.name} (Cost ${minCostFound})`);
                      } else if (oppFieldSlot.knowledge.cost === minCostFound && targetToDiscard) {
                          newState.log.push(`[Passive Condition] Pele found another card with same min cost (${oppFieldSlot.knowledge.name}), keeping first target.`);
                      }
                  }
              });

              if (targetToDiscard) {
                  const discardedKnowledge = targetToDiscard.knowledge;
                  const discardSlotIndex = targetToDiscard.fieldSlotIndex;
                  newState.log.push(`[Passive Effect] Pele (Owner: ${pId}) targets ${discardedKnowledge.name} (Cost ${discardedKnowledge.cost}) in slot ${discardSlotIndex} on ${opponent.id}'s field for discard.`);

                  opponent.field[discardSlotIndex].knowledge = null;
                  newState.discardPile.push(discardedKnowledge);
                  newState.log.push(`[Passive Effect] Pele (Owner: ${pId}) discarded ${discardedKnowledge.name} from ${opponent.id}.`);

                  // Trigger KNOWLEDGE_LEAVE
                  newState.log.push(`[Passive Trigger] KNOWLEDGE_LEAVE for ${discardedKnowledge.name} (Owner: ${opponent.id}) due to Pele passive`);
                  const stateBeforeLeaveTrigger = JSON.parse(JSON.stringify(newState));
                  newState = applyPassiveAbilities(stateBeforeLeaveTrigger, 'KNOWLEDGE_LEAVE', {
                      playerId: opponent.id,
                      knowledgeCard: discardedKnowledge,
                  });

                  const opponentIdx = newState.players.findIndex(p => p.id === opponent!.id);
                  if (opponentIdx !== -1) newState.players[opponentIdx] = opponent; // Ensure opponent state is updated in newState

              } else {
                  newState.log.push(`[Passive Effect] Pele (Owner: ${pId}) triggered, but no valid target (lower cost knowledge) found on ${opponent.id}'s field.`);
              }
          }
      }

      // Tsenehale
      if (creature.id === 'tsenehale' && trigger === 'KNOWLEDGE_LEAVE' && eventData.playerId === pId) {
          const leavingKnowledge = eventData.knowledgeCard;
          newState.log.push(`[Passive Condition] Tsenehale (Owner: ${pId}) checks leaving card: ${leavingKnowledge?.name} (Element: ${leavingKnowledge?.element})`);
          if (leavingKnowledge && leavingKnowledge.element === 'air') {
              const oldPower = player.power;
              player.power += 1;
              newState.log.push(`[Passive Effect] Tsenehale (Owner: ${pId}, via ${leavingKnowledge.name}) grants +1 Power. Power: ${oldPower} -> ${player.power}`);
              newState.players[playerIndex] = player;
          }
      }

      // Tulpar
      if (creature.id === 'tulpar' && trigger === 'AFTER_PLAYER_SUMMON' && eventData.playerId === pId && eventData.creatureId === creature.id) {
          const summonedKnowledge = eventData.knowledgeCard;
          newState.log.push(`[Passive Condition] Tulpar (Owner: ${pId}) checks summoned card: ${summonedKnowledge?.name} (Element: ${summonedKnowledge?.element})`);
          if (summonedKnowledge && summonedKnowledge.element === 'air') {
              newState.log.push(`[Passive Effect] Tulpar (Owner: ${pId}) triggers rotation.`);
              const tulparCreatureIndex = player.creatures.findIndex(c => c.id === 'tulpar');
              if (tulparCreatureIndex !== -1) {
                  const tulparCreature = player.creatures[tulparCreatureIndex];
                  const currentRotation = tulparCreature.rotation ?? 0;
                  newState.log.push(`[Passive Condition] Tulpar current rotation: ${currentRotation}°`);
                  if (currentRotation < 270) { // Assuming 270 is max for creatures
                      const oldWisdom = tulparCreature.currentWisdom ?? tulparCreature.baseWisdom;
                      tulparCreature.currentWisdom = oldWisdom + 1;
                      tulparCreature.rotation = currentRotation + 90;
                      newState.log.push(`[Passive Effect] Tulpar (Owner: ${pId}) rotates. Wisdom: ${oldWisdom} -> ${tulparCreature.currentWisdom}, Rotation: ${currentRotation}° -> ${tulparCreature.rotation}°.`);
                      newState.players[playerIndex] = player;
                  } else {
                      newState.log.push(`[Passive Effect] Tulpar (Owner: ${pId}) triggered, but Tulpar is already at max rotation.`);
                  }
              } else {
                 newState.log.push(`[Passive Error] Tulpar creature data not found for owner ${pId} despite matching creatureId.`);
              }
          }
      }

      // --- Update player/opponent references after potential modifications ---
      player = getPlayerState(newState, pId);
      opponent = getOpponentState(newState, pId);
      if (!player || !opponent) {
          newState.log.push(`[Passive Error] Player or Opponent state became invalid after passive effect for ${creature.id}. Exiting inner loop.`);
          break; // Exit inner loop if state becomes invalid
      }

      // --- Passives requiring integration elsewhere (Logging placeholders) ---
      if (creature.id === 'dudugera' || creature.id === 'kappa') {
          newState.log.push(`[Passive Info] ${creature.id} cost reduction handled in isValidAction.`);
      }
      if (creature.id === 'trepulcahue') {
          newState.log.push(`[Passive Info] ${creature.id} defense bonus handled in executeKnowledgePhase.`);
      }
      if (creature.id === 'zhar-ptitsa') {
          newState.log.push(`[Passive Info] ${creature.id} unblockable effect not implemented in MVP.`);
      }

    } // End loop through creatures
  } // End loop through players

  newState.log.push(`[Passive Check] Finished applying passives for trigger: ${trigger}`);
  return newState; // Return the modified state
}
