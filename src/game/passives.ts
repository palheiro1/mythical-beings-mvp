import { GameState, PassiveTriggerType, PassiveEventData } from './types';
import { getOpponentState, getPlayerState } from './utils';
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

      // --- Trigger Logic --- Corrected Structure ---

      // Caapora
      if (creature.id === 'caapora' && trigger === 'TURN_START' && eventData.playerId === pId) {
        if (opponent.hand.length > player.hand.length) {
          const oldPower = opponent.power;
          opponent.power -= 1;
          newState.log.push(`[Passive Effect] Caapora (Owner: ${pId}) deals 1 damage to ${opponent.id}. Power: ${oldPower} -> ${opponent.power}`);
          const opponentIndex = newState.players.findIndex(p => p.id === opponent!.id);
          if (opponentIndex !== -1) newState.players[opponentIndex] = opponent;
        }
      }

      // Adaro
      else if (creature.id === 'adaro' && trigger === 'AFTER_PLAYER_SUMMON' && eventData.playerId === pId && eventData.creatureId === creature.id) {
        const summonedKnowledge = eventData.knowledgeCard;
        if (summonedKnowledge && summonedKnowledge.element === 'water') {
          newState.log.push(`[Passive Effect] Adaro (Owner: ${pId}) triggers free draw.`);
          if (newState.market.length > 0) {
             const drawnCard = newState.market.shift();
             if (drawnCard) {
               player.hand.push(drawnCard);
               newState.log.push(`[Passive Effect] Adaro (Owner: ${pId}) draws ${drawnCard.name}. Hand size: ${player.hand.length}`);
               // When refilling the market, always assign a new instanceId
               if (newState.knowledgeDeck.length > 0) {
                 const refillCard = { ...newState.knowledgeDeck.shift()!, instanceId: uuidv4() };
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
      else if (creature.id === 'kyzy' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
          const summonedKnowledge = eventData.knowledgeCard;
          const summoningPlayerId = eventData.playerId;
          const opponentOfSummoner = getOpponentState(newState, summoningPlayerId);
          if (summonedKnowledge && summonedKnowledge.element === 'earth' && opponentOfSummoner && opponentOfSummoner.id === pId) { // Check if *this* Kyzy's owner is the opponent of the summoner
              newState.log.push(`[Passive Effect] Kyzy (Owner: ${pId}) forces discard from ${opponentOfSummoner.id} (summoner's opponent).`);
              if (opponentOfSummoner.hand.length > 0) {
                  const discardedCard = opponentOfSummoner.hand.pop(); // Discard last card for simplicity
                  if (discardedCard) {
                      newState.discardPile.push(discardedCard);
                      newState.log.push(`[Passive Effect] ${opponentOfSummoner.id} discarded ${discardedCard.name}.`);
                  }
              } else {
                  newState.log.push(`[Passive Effect] ${opponentOfSummoner.id} had no cards to discard.`);
              }
              const opponentIndex = newState.players.findIndex(p => p.id === opponentOfSummoner!.id);
              if (opponentIndex !== -1) newState.players[opponentIndex] = opponentOfSummoner;
          }
      }

      // Japinunus
      else if (creature.id === 'japinunus' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
          const summonedKnowledge = eventData.knowledgeCard;
          const summoningPlayerId = eventData.playerId;
          if (summonedKnowledge && summonedKnowledge.element === 'air' && pId === summoningPlayerId) {
              const oldPower = player.power;
              player.power += 1;
              newState.log.push(`[Passive Effect] Japinunus (Owner: ${pId}) grants +1 Power due to summoning ${summonedKnowledge.name}. Power: ${oldPower} -> ${player.power}`);
              const currentPlayerIndex = newState.players.findIndex(p => p.id === pId);
              if (currentPlayerIndex !== -1) newState.players[currentPlayerIndex] = player;
          }
      }

      // Kappa
      else if (creature.id === 'kappa' && trigger === 'BEFORE_ACTION_VALIDATION') {
          // Logic handled in isValidAction
      }

      // Dudugera
      else if (creature.id === 'dudugera' && trigger === 'BEFORE_ACTION_VALIDATION') {
          const targetCreatureId = eventData.targetCreatureId;
          const knowledgeCard = eventData.knowledgeCard;
          if (targetCreatureId === creature.id && knowledgeCard && knowledgeCard.element !== 'earth') {
              newState.log.push(`[Passive Effect] Dudugera (Owner: ${pId}) prevents non-earth Knowledge from being summoned onto it.`);
              // Actual prevention must happen in the reducer or isValidAction
          }
      }

      // Inkanyamba
      else if (creature.id === 'inkanyamba' && trigger === 'AFTER_PLAYER_DRAW' && eventData.playerId === pId) {
          newState.log.push(`[Passive Effect] Inkanyamba (Owner: ${pId}) triggers market discard.`);
          if (newState.market.length > 0) {
              const discardedCard = newState.market.shift(); // Discard first card
              if (discardedCard) {
                  newState.discardPile.push(discardedCard);
                  newState.log.push(`[Passive Effect] ${discardedCard.name} discarded from Market.`);
                  // When refilling the market, always assign a new instanceId
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
      else if (creature.id === 'lisovik' && trigger === 'KNOWLEDGE_LEAVE' && eventData.playerId === pId) {
          const leavingKnowledge = eventData.knowledgeCard;
          if (leavingKnowledge && leavingKnowledge.element === 'earth') {
              const oldPower = opponent.power;
              opponent.power -= 1;
              newState.log.push(`[Passive Effect] Lisovik (Owner: ${pId}) deals 1 damage to ${opponent.id} due to terrestrial knowledge (${leavingKnowledge.name}) leaving play. Power: ${oldPower} -> ${opponent.power}`);
              const opponentIndex = newState.players.findIndex(p => p.id === opponent!.id);
              if (opponentIndex !== -1) newState.players[opponentIndex] = opponent;
          }
      }

      // Pele
      else if (creature.id === 'pele' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
          const summonedKnowledge = eventData.knowledgeCard;
          const summoningPlayerId = eventData.playerId;
          if (summonedKnowledge && summonedKnowledge.element === 'earth' && pId === summoningPlayerId) {
              // Find opponent's knowledges with lower wisdom cost
              const lowerCostSlots = opponent.field
                .map((slot, idx) => ({ slot, idx }))
                .filter(({ slot }) => slot.knowledge && slot.knowledge.cost < summonedKnowledge.cost);
              if (lowerCostSlots.length === 0) {
                  newState.log.push(`[Passive Effect] Pele (Owner: ${pId}) triggered, but opponent has no knowledge with lower wisdom cost than ${summonedKnowledge.name}.`);
              } else if (lowerCostSlots.length === 1) {
                  // Discard the only valid knowledge
                  const { slot, idx } = lowerCostSlots[0];
                  const discardedKnowledge = { ...slot.knowledge };
                  opponent.field[idx].knowledge = null;
                  newState.discardPile.push(discardedKnowledge);
                  newState.log.push(`[Passive Effect] Pele (Owner: ${pId}) discards opponent's knowledge ${discardedKnowledge.name} (cost ${discardedKnowledge.cost}) due to summoning ${summonedKnowledge.name} (cost ${summonedKnowledge.cost}).`);
                  // Trigger KNOWLEDGE_LEAVE for the discarded card
                  newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
                      playerId: opponent.id,
                      creatureId: opponent.field[idx].creatureId,
                      knowledgeCard: discardedKnowledge
                  });
              } else {
                  // MVP: Discard the first one, log that user choice is TODO
                  const { slot, idx } = lowerCostSlots[0];
                  const discardedKnowledge = { ...slot.knowledge };
                  opponent.field[idx].knowledge = null;
                  newState.discardPile.push(discardedKnowledge);
                  newState.log.push(`[Passive Effect] Pele (Owner: ${pId}) discards opponent's knowledge ${discardedKnowledge.name} (cost ${discardedKnowledge.cost}) due to summoning ${summonedKnowledge.name} (cost ${summonedKnowledge.cost}). [TODO: Let user choose which knowledge to discard if multiple are valid]`);
                  // Trigger KNOWLEDGE_LEAVE for the discarded card
                  newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
                      playerId: opponent.id,
                      creatureId: opponent.field[idx].creatureId,
                      knowledgeCard: discardedKnowledge
                  });
              }
              // Save opponent state
              const opponentIndex = newState.players.findIndex(p => p.id === opponent!.id);
              if (opponentIndex !== -1) newState.players[opponentIndex] = opponent;
          }
      }

      // Tsenehale
      else if (creature.id === 'tsenehale' && trigger === 'KNOWLEDGE_LEAVE' && eventData.playerId === pId && eventData.creatureId === creature.id) {
          const leavingKnowledge = eventData.knowledgeCard;
          if (leavingKnowledge && leavingKnowledge.element === 'air') {
              const oldPower = player.power;
              player.power += 1;
              newState.log.push(`[Passive Effect] Tsenehale (Owner: ${pId}) grants +1 Power due to ${leavingKnowledge.name} leaving. Power: ${oldPower} -> ${player.power}`);
              const currentPlayerIndex = newState.players.findIndex(p => p.id === pId);
              if (currentPlayerIndex !== -1) newState.players[currentPlayerIndex] = player;
          }
      }

      // Tulpar
      else if (creature.id === 'tulpar' && (trigger === 'AFTER_PLAYER_SUMMON' || trigger === 'AFTER_OPPONENT_SUMMON')) {
          const summonedKnowledge = eventData.knowledgeCard;
          const summoningPlayerId = eventData.playerId;
          if (summonedKnowledge && summonedKnowledge.element === 'air' && pId === summoningPlayerId) {
              // Find all player's creatures that are not fully rotated
              const notFullyRotated = player.creatures.filter(c => (c.rotation ?? 0) < 270);
              if (notFullyRotated.length === 0) {
                  newState.log.push(`[Passive Effect] Tulpar (Owner: ${pId}) triggered, but all creatures are fully rotated.`);
              } else if (notFullyRotated.length === 1) {
                  // Rotate the only available creature
                  const c = notFullyRotated[0];
                  c.rotation = (c.rotation ?? 0) + 90;
                  newState.log.push(`[Passive Effect] Tulpar (Owner: ${pId}) rotates ${c.name} 90º due to summoning ${summonedKnowledge.name}.`);
              } else {
                  // MVP: Rotate the first one, log that user choice is TODO
                  const c = notFullyRotated[0];
                  c.rotation = (c.rotation ?? 0) + 90;
                  newState.log.push(`[Passive Effect] Tulpar (Owner: ${pId}) rotates ${c.name} 90º due to summoning ${summonedKnowledge.name}. [TODO: Let user choose which creature to rotate if multiple are available]`);
              }
              // Save player state
              const playerIndex = newState.players.findIndex(p => p.id === pId);
              if (playerIndex !== -1) newState.players[playerIndex] = player;
          }
      }

      // Trepulcahue
      else if (creature.id === 'trepulcahue' && trigger === 'TURN_START' && eventData.playerId === pId) {
          if (player.hand.length > opponent.hand.length) {
              const oldPower = opponent.power;
              opponent.power -= 1;
              newState.log.push(`[Passive Effect] Trepulcahue (Owner: ${pId}) deals 1 damage to ${opponent.id}. Power: ${oldPower} -> ${opponent.power}`);
              const opponentIndex = newState.players.findIndex(p => p.id === opponent!.id);
              if (opponentIndex !== -1) newState.players[opponentIndex] = opponent;
          }
      }

      // Zhar-Ptitsa
      else if (creature.id === 'zhar-ptitsa' && trigger === 'TURN_START' && eventData.playerId === pId) {
          newState.log.push(`[Passive Effect] Zhar-Ptitsa (Owner: ${pId}) triggers free draw.`);
          if (newState.market.length > 0) {
              const drawnCard = newState.market.shift();
              if (drawnCard) {
                  player.hand.push(drawnCard);
                  newState.log.push(`[Passive Effect] Zhar-Ptitsa (Owner: ${pId}) draws ${drawnCard.name}. Hand size: ${player.hand.length}`);
                  // When refilling the market, always assign a new instanceId
                  if (newState.knowledgeDeck.length > 0) {
                      const refillCard = { ...newState.knowledgeDeck.shift()!, instanceId: uuidv4() };
                      newState.market.push(refillCard);
                      newState.log.push(`[Passive Effect] Market refilled with ${refillCard.name}.`);
                  }
              }
          } else {
              newState.log.push(`[Passive Effect] Zhar-Ptitsa triggered, but Market is empty.`);
          }
          const currentPlayerIndex = newState.players.findIndex(p => p.id === pId);
          if (currentPlayerIndex !== -1) newState.players[currentPlayerIndex] = player;
      }

      // --- Add other creature passives here using else if ---

    } // End loop through creatures
  } // End loop through players

  return newState; // Added missing return statement
}
