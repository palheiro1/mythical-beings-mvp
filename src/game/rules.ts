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
  // Ensure payload exists and has playerId for player-specific actions
  // Allow SET_GAME_STATE and INITIALIZE_GAME without payload checks
  if (action.type !== 'SET_GAME_STATE' && action.type !== 'INITIALIZE_GAME') {
    if (!action.payload || typeof action.payload !== 'object' || !('playerId' in action.payload)) {
      console.log('[isValidAction] Failed: Invalid payload structure for player action', action.type);
      return false;
    }
    const playerId = action.payload.playerId as string;
    const playerIndex = state.players.findIndex(p => p.id === playerId);

    if (playerIndex === -1) {
      console.log(`[isValidAction] Failed: Player ${playerId} not found`);
      return false; // Player not found
    }

    // Basic checks: Correct player, correct phase, actions available
    if (state.currentPlayerIndex !== playerIndex) {
      console.log(`[isValidAction] Failed: Not player ${playerIndex}'s turn (Current: ${state.currentPlayerIndex})`);
      return false; // Not player's turn
    }
    if (state.phase !== 'action') {
      console.log(`[isValidAction] Failed: Not action phase (Current: ${state.phase})`);
      return false; // Not action phase
    }
    // Allow END_TURN even if actions are 0 or more, but other actions require < ACTIONS_PER_TURN
    if (state.actionsTakenThisTurn >= ACTIONS_PER_TURN && action.type !== 'END_TURN') {
      console.log(`[isValidAction] Failed: No actions left (Taken: ${state.actionsTakenThisTurn})`);
      return false; // No actions left (unless ending turn)
    }
  } // End of player-specific action checks

  // Action-specific validation
  switch (action.type) {
    case 'ROTATE_CREATURE': {
      // Payload structure already checked above for player actions
      const { creatureId } = action.payload as { playerId: string; creatureId: string }; // Added playerId for clarity
      const playerIndex = state.players.findIndex(p => p.id === (action.payload as { playerId: string }).playerId);
      const player = state.players[playerIndex];
      const creature = player.creatures.find(c => c.id === creatureId);
      if (!creature) {
        console.log(`[isValidAction] Failed ROTATE: Creature ${creatureId} not found for player ${player.id}`);
        return false; // Creature not found in player's base creatures
      }
      // Check if the creature is actually on the field
      const fieldSlot = player.field.find(f => f.creatureId === creatureId);
       if (!fieldSlot) {
         console.log(`[isValidAction] Failed ROTATE: Creature ${creatureId} not on field for player ${player.id}`);
         return false; // Creature not on field
       }
      // Rotating is generally always valid if the creature exists on field and it's the action phase,
      // even if it's at max rotation (the action handler can prevent over-rotation).
      console.log(`[isValidAction] Passed: ROTATE_CREATURE for ${creatureId}`);
      return true;
    }
    case 'DRAW_KNOWLEDGE': {
      const { knowledgeId } = action.payload as { playerId: string; knowledgeId: string };
      const playerIndex = state.players.findIndex(p => p.id === (action.payload as { playerId: string }).playerId);
      const player = state.players[playerIndex];
      if (!state.market.some(k => k.id === knowledgeId)) {
        console.log(`[isValidAction] Failed DRAW: Knowledge ${knowledgeId} not in market`);
        return false; // Card not in market
      }
      if (player.hand.length >= MAX_HAND_SIZE) {
        console.log(`[isValidAction] Failed DRAW: Hand full for player ${player.id}`);
        return false; // Hand full
      }
      console.log(`[isValidAction] Passed: DRAW_KNOWLEDGE for ${knowledgeId}`);
      return true;
    }
    case 'SUMMON_KNOWLEDGE': {
      const { knowledgeId, creatureId } = action.payload as { playerId: string; knowledgeId: string; creatureId: string };
      const playerIndex = state.players.findIndex(p => p.id === (action.payload as { playerId: string }).playerId);
      const player = state.players[playerIndex];
      const knowledgeCard = player.hand.find(k => k.id === knowledgeId);
      if (!knowledgeCard) {
        console.log(`[isValidAction] Failed SUMMON: Knowledge ${knowledgeId} not in hand for player ${player.id}`);
        return false; // Card not in hand
      }
      const creatureSlot = player.field.find(f => f.creatureId === creatureId);
      if (!creatureSlot) {
        console.log(`[isValidAction] Failed SUMMON: Creature ${creatureId} not on field for player ${player.id}`);
        return false; // Creature not on field
      }
      if (creatureSlot.knowledge) {
        console.log(`[isValidAction] Failed SUMMON: Creature ${creatureId} already has knowledge`);
        return false; // Creature already has knowledge
      }

      const creature = player.creatures.find(c => c.id === creatureId);
      if (!creature) {
        console.log(`[isValidAction] Failed SUMMON: Base creature data ${creatureId} not found (data inconsistency)`);
        return false; // Base creature data not found (shouldn't happen if fieldSlot exists)
      }

      let effectiveCost = knowledgeCard.cost;
      // Apply cost reductions (consider moving this to a helper or central place if complex)
      // Kappa Passive: Aquatic knowledge costs 1 less (min 1)
      if (knowledgeCard.element === 'water' && player.creatures.some(c => c.id === 'kappa')) {
        effectiveCost = Math.max(1, effectiveCost - 1);
      }
      // Dudugera Passive: Terrestrial knowledge costs 1 less (min 1)
      if (knowledgeCard.element === 'earth' && player.creatures.some(c => c.id === 'dudugera')) {
        effectiveCost = Math.max(1, effectiveCost - 1);
      }

      const creatureWisdom = getCreatureWisdom(creature); // Use helper
      if (creatureWisdom < effectiveCost) {
          console.log(`[isValidAction] Failed SUMMON: Creature ${creatureId} wisdom (${creatureWisdom}) < cost (${effectiveCost})`);
          return false; // Insufficient wisdom
      }
      console.log(`[isValidAction] Passed: SUMMON_KNOWLEDGE ${knowledgeId} onto ${creatureId}`);
      return true;
    }
    case 'END_TURN':
      // Ending turn is always valid if it's your turn (basic checks already cover this)
      console.log(`[isValidAction] Passed: END_TURN`);
      return true;
    // Add cases for non-player actions if needed
    case 'SET_GAME_STATE':
    case 'INITIALIZE_GAME':
        console.log(`[isValidAction] Passed: ${action.type} (System Action)`);
        return true; // Always allow system actions
    default:
      // Ensure exhaustive check - this should ideally not be reached if types are correct
      console.log(`[isValidAction] Failed: Unhandled action type`, action);
      // const _exhaustiveCheck: never = action; // This might cause issues depending on action type definition
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
