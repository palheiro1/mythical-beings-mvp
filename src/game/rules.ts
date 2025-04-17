import { knowledgeEffects } from './effects';
import knowledgeData from '../assets/knowledges.json';
import { GameState, GameAction, PlayerState, CombatBuffers } from './types'; // Removed unused Knowledge import
import { getCreatureWisdom } from './utils'; // Import helper
import { applyPassiveAbilities } from './passives'; // Import for passive abilities

// Constants
const MAX_HAND_SIZE = 5;
const ACTIONS_PER_TURN = 2;

/**
 * Checks if a given action is valid based on the current game state and rules.
 * @param state The current game state.
 * @param action The action to validate.
 * @returns True if the action is valid, false otherwise.
 */
export function isValidAction(state: GameState, action: GameAction): boolean {
  const playerIndex = state.players.findIndex(p => p.id === action.payload.playerId);
  if (playerIndex === -1) return false; // Player not found

  const player = state.players[playerIndex];
  const opponentIndex = playerIndex === 0 ? 1 : 0;
  const opponent = state.players[opponentIndex];

  // Basic checks: Correct player, correct phase, actions available
  if (state.currentPlayerIndex !== playerIndex) return false; // Not player's turn
  if (state.phase !== 'action') return false; // Not action phase
  if (state.actionsTakenThisTurn >= ACTIONS_PER_TURN && action.type !== 'END_TURN') return false; // No actions left (unless ending turn)

  switch (action.type) {
    case 'ROTATE_CREATURE': {
      // Check if creature exists and has knowledge attached
      const fieldSlot = player.field.find(f => f.creatureId === action.payload.creatureId);
      return !!fieldSlot?.knowledge;
    }
    case 'DRAW_KNOWLEDGE': {
      // Check if hand is full and card is in market
      if (player.hand.length >= MAX_HAND_SIZE) return false;
      return state.market.some(k => k.id === action.payload.knowledgeId);
    }
    case 'SUMMON_KNOWLEDGE': {
      // Check if card is in hand
      const knowledgeCard = player.hand.find(k => k.id === action.payload.knowledgeId);
      if (!knowledgeCard) return false;

      // Check if creature exists and has no knowledge attached
      const creature = player.creatures.find(c => c.id === action.payload.creatureId);
      const fieldSlot = player.field.find(f => f.creatureId === action.payload.creatureId);
      if (!creature || fieldSlot?.knowledge) return false;

      // Check if opponent has aquatic3 active
      const opponentHasAquatic3 = opponent.field.some(slot => slot.knowledge?.id === 'aquatic3');
      if (opponentHasAquatic3) {
        console.log("Validation failed: Opponent has aquatic3 active, cannot summon knowledge.");
        return false;
      }

      // Check wisdom cost (consider passives like Kappa/Dudugera)
      let effectiveCost = knowledgeCard.cost;
      // Kappa Passive: Aquatic knowledge costs 1 less (min 1)
      if (knowledgeCard.element === 'water' && player.creatures.some(c => c.id === 'kappa')) {
        effectiveCost = Math.max(1, effectiveCost - 1);
      }
      // Dudugera Passive: Terrestrial knowledge costs 1 less (min 1)
      if (knowledgeCard.element === 'earth' && player.creatures.some(c => c.id === 'dudugera')) {
        effectiveCost = Math.max(1, effectiveCost - 1);
      }

      const creatureWisdom = creature.currentWisdom ?? creature.baseWisdom;
      return creatureWisdom >= effectiveCost;
    }
    case 'END_TURN':
      // Always valid during action phase
      return true;
    // Add cases for other actions if any
    default:
      return false;
  }
}

/**
 * Executes the Knowledge Phase logic.
 * - Executes effects of summoned knowledge cards.
 * - Resolves damage/defense events centrally.
 * - Rotates and discards knowledge cards.
 * @param state The current game state.
 * @returns The updated game state after the Knowledge Phase.
 */
export function executeKnowledgePhase(state: GameState): GameState {
  // Initialize combat buffers
  const buffers: CombatBuffers = { damage: [0, 0], defense: [0, 0] };

  let newState = { ...state, log: [...state.log, `Turn ${state.turn}: Knowledge Phase started.`] };

  // Execute effects and collect combat events
  newState.players.forEach((player, playerIndex) => {
    player.field.forEach((fieldSlot, fieldSlotIndex) => {
      if (fieldSlot.knowledge) {
        const rotation = fieldSlot.knowledge.rotation ?? 0;
        const cardData = (knowledgeData as any[]).find(k => k.id === fieldSlot.knowledge!.id);
        const maxRotations = cardData?.maxRotations ?? 4;
        const isFinalRotation = (rotation + 90) / 90 >= maxRotations;
        const effectFn = knowledgeEffects[fieldSlot.knowledge.id];
        if (effectFn) {
          newState = effectFn({
            state: newState,
            playerIndex,
            fieldSlotIndex,
            knowledge: fieldSlot.knowledge,
            rotation,
            isFinalRotation,
            buffers
          });
        } else {
          newState.log.push(`Executing effect for ${fieldSlot.knowledge.name} on ${fieldSlot.creatureId} for Player ${playerIndex + 1}`);
        }
      }
    });
  });

  // --- Integrate Trepulcahue passive (bonus defense) ---
  newState.players.forEach((player, playerIndex) => {
    const trepulcahueCount = player.creatures.filter(c => c.id === 'trepulcahue').length;
    if (trepulcahueCount > 0) {
      const knowledgeCount = player.field.filter(slot => slot.knowledge).length;
      const bonusDefense = trepulcahueCount * knowledgeCount;
      if (bonusDefense > 0) {
        buffers.defense[playerIndex] += bonusDefense;
        newState.log.push(`Trepulcahue passive: +${bonusDefense} defense for Player ${playerIndex + 1}.`);
      }
    }
  });

  // Resolve combat: apply damage minus defense for each player
  newState.players.forEach((_, playerIndex) => {
    const totalDamage = buffers.damage[playerIndex];
    const totalDefense = buffers.defense[playerIndex];
    const net = Math.max(0, totalDamage - totalDefense);
    if (net > 0) {
      const updatedPlayers = [...newState.players];
      const target = { ...updatedPlayers[playerIndex], power: Math.max(0, updatedPlayers[playerIndex].power - net) };
      updatedPlayers[playerIndex] = target;
      newState = { ...newState, players: updatedPlayers as [PlayerState, PlayerState] };
      newState.log.push(`Combat: Player ${playerIndex + 1} takes ${net} damage (raw ${totalDamage} - defense ${totalDefense}).`);
    } else {
      newState.log.push(`Combat: Player ${playerIndex + 1} absorbs all damage (raw ${totalDamage} - defense ${totalDefense}).`);
    }
  });

  // Rotate and discard knowledge cards using maxRotations from knowledges.json
  const updatedPlayers = newState.players.map((player, playerIndex) => {
    const updatedField = player.field.map(fieldSlot => {
      if (fieldSlot.knowledge) {
        // Find maxRotations for this card
        const cardData = (knowledgeData as any[]).find(k => k.id === fieldSlot.knowledge!.id);
        const maxRotations = cardData?.maxRotations ?? 4; // Default to 4 if not found
        const prevRotation = fieldSlot.knowledge.rotation ?? 0;
        const newRotation = prevRotation + 90;
        // If completed all cycles, discard
        if (newRotation / 90 >= maxRotations) {
          const discardedKnowledge = { ...fieldSlot.knowledge }; // Make a copy of the knowledge card to be discarded
          newState.log.push(`${discardedKnowledge.name} on ${fieldSlot.creatureId} (Player ${playerIndex + 1}) completed rotation and is discarded.`);
          
          // Add the discarded card to the discard pile
          newState.discardPile.push(discardedKnowledge);
          
          // Trigger KNOWLEDGE_LEAVE passive abilities
          newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
            playerId: player.id,
            knowledgeCard: discardedKnowledge,
            creatureId: fieldSlot.creatureId
          });
          
          return { ...fieldSlot, knowledge: null };
        } else {
          newState.log.push(`${fieldSlot.knowledge.name} on ${fieldSlot.creatureId} (Player ${playerIndex + 1}) rotated to ${newRotation} degrees.`);
          return { ...fieldSlot, knowledge: { ...fieldSlot.knowledge, rotation: newRotation } };
        }
      }
      return fieldSlot;
    });
    return { ...player, field: updatedField };
  });

  newState = { ...newState, players: updatedPlayers as [PlayerState, PlayerState], phase: 'action', actionsTakenThisTurn: 0 };
  newState.log.push(`Turn ${state.turn}: Knowledge Phase ended. Action Phase started for Player ${state.currentPlayerIndex + 1}.`);

  return newState;
}

/**
 * Checks if a win condition has been met.
 * @param state The current game state.
 * @returns The ID of the winning player, or null if no winner yet.
 */
export function checkWinCondition(state: GameState): string | null {
  const player1 = state.players[0];
  const player2 = state.players[1];

  if (player2.power <= 0) {
    return player1.id; // Player 1 wins
  }
  if (player1.power <= 0) {
    return player2.id; // Player 2 wins
  }

  return null; // No winner yet
}
