import { knowledgeEffects } from './effects.js';
// Removed unused CombatBuffers import
import { GameState, GameAction, Knowledge, PlayerState } from './types';
import { applyPassiveAbilities } from './passives.js';

// Constants
const MAX_HAND_SIZE = 5;
export const ACTIONS_PER_TURN = 2;

// Define the return type for validation
interface ValidationResult {
    isValid: boolean;
    reason?: string;
}

/**
 * Checks if a given action is valid based on the current game state and rules.
 * @param state The current game state.
 * @param action The action to validate.
 * @returns An object indicating if the action is valid and an optional reason if not.
 */
export function isValidAction(state: GameState, action: GameAction): ValidationResult {
  // Allow SET_GAME_STATE and INITIALIZE_GAME without player/turn checks
  if (action.type === 'SET_GAME_STATE' || action.type === 'INITIALIZE_GAME') {
    return { isValid: true }; // Always allow system actions
  }

  // Handle END_TURN before payload check
  if (action.type === 'END_TURN') {
    // Basic checks for END_TURN (can be done here or in reducer)
    if (state.phase !== 'action') {
      const reason = `Cannot end turn outside action phase (Current: ${state.phase})`;
      return { isValid: false, reason };
    }
    // No need to check actionsTakenThisTurn for END_TURN
    return { isValid: true };
  }

  // All other actions require payload and player/turn checks
  if (!action.payload || typeof action.payload !== 'object' || !('playerId' in action.payload)) {
    const reason = `Invalid payload structure for player action ${action.type}`;
    console.log(`[isValidAction] Failed: ${reason}`);
    return { isValid: false, reason };
  }

  // Cast to access playerId after validation
  const payload = action.payload as { playerId: string; [key: string]: any };
  const playerId = payload.playerId;
  const playerIndex = state.players.findIndex(p => p.id === playerId);

  if (playerIndex === -1) {
    const reason = `Player ${playerId} not found`;
    return { isValid: false, reason }; // Player not found
  }

  // Basic checks: Correct player, correct phase, actions available
  if (state.currentPlayerIndex !== playerIndex) {
    const reason = `Not player ${playerIndex}'s turn (Current: ${state.currentPlayerIndex})`;
    return { isValid: false, reason }; // Not player's turn
  }
  if (state.phase !== 'action') {
    const reason = `Not action phase (Current: ${state.phase})`;
    return { isValid: false, reason }; // Not action phase
  }
  const currentActionsPerTurn = state.actionsPerTurn ?? ACTIONS_PER_TURN;
  if (state.actionsTakenThisTurn >= currentActionsPerTurn) {
    const reason = `No actions left (Taken: ${state.actionsTakenThisTurn}/${currentActionsPerTurn})`;
    console.log(`[isValidAction] Failed: ${reason}`);
    return { isValid: false, reason }; // No actions left
  }

  // Action-specific validation
  switch (action.type) {
    case 'ROTATE_CREATURE': {
      const { creatureId } = action.payload as { playerId: string; creatureId: string };
      const player = state.players[playerIndex];
      const creature = player.creatures.find(c => c.id === creatureId);
      if (!creature) {
        return { isValid: false, reason: `Creature ${creatureId} not found` };
      }
      const fieldSlot = player.field.find(f => f.creatureId === creatureId);
      if (!fieldSlot) {
        return { isValid: false, reason: `Creature ${creatureId} not on field` };
      }
      return { isValid: true };
    }
    case 'DRAW_KNOWLEDGE': {
      const { instanceId } = action.payload as { playerId: string; knowledgeId: string; instanceId: string };
      const player = state.players[playerIndex];
      // Check 1: Market not empty
      if (state.market.length === 0) {
        return { isValid: false, reason: `Market is empty` };
      }
      // Check 2: Card exists in market (using instanceId for precision)
      if (!state.market.some(k => k.instanceId === instanceId)) {
        return { isValid: false, reason: `Knowledge instance ${instanceId} not in market` };
      }
      // Check 3: Hand not full
      if (player.hand.length >= MAX_HAND_SIZE) {
        return { isValid: false, reason: `Hand full` };
      }
      return { isValid: true };
    }
    case 'SUMMON_KNOWLEDGE': {
      const { knowledgeId, creatureId, instanceId } = action.payload as { playerId: string; knowledgeId: string; instanceId: string; creatureId: string };
      const player = state.players[playerIndex];
      // Find knowledge in hand using instanceId for precision
      const knowledgeCard = player.hand.find(k => k.instanceId === instanceId);
      if (!knowledgeCard) {
        return { isValid: false, reason: `Knowledge instance ${instanceId} not in hand` };
      }
      // Ensure knowledgeId matches (consistency check)
      if (knowledgeCard.id !== knowledgeId) {
         return { isValid: false, reason: `Knowledge instance ${instanceId} ID mismatch (found ${knowledgeCard.id}, expected ${knowledgeId})` };
      }

      const creatureSlotIndex = player.field.findIndex(f => f.creatureId === creatureId);
      if (creatureSlotIndex === -1) {
        return { isValid: false, reason: `Creature ${creatureId} not on field` };
      }
      const creatureSlot = player.field[creatureSlotIndex];

      const creature = player.creatures.find(c => c.id === creatureId);
      if (!creature) {
        return { isValid: false, reason: `Creature ${creatureId} not found for player ${playerId}` };
      }

      const creatureWisdom = creature.currentWisdom;
      if (typeof creatureWisdom !== 'number') {
        return { isValid: false, reason: `Creature ${creatureId} has invalid wisdom` };
      }

      let effectiveCost = knowledgeCard.cost;
      // Apply cost reductions (consider moving to a helper function)
      if (knowledgeCard.element === 'water' && player.creatures.some(c => c.id === 'kappa' && player.field.some(f => f.creatureId === 'kappa'))) {
        effectiveCost = Math.max(1, effectiveCost - 1);
      }
      if (knowledgeCard.element === 'earth' && player.creatures.some(c => c.id === 'dudugera' && player.field.some(f => f.creatureId === 'dudugera'))) {
        effectiveCost = Math.max(1, effectiveCost - 1);
      }

      // Check if the *target slot* for *this player* is blocked by an *opponent's* aquatic3
      const opponentIndex = playerIndex === 0 ? 1 : 0;
      const blockedSlots = state.blockedSlots;
      if (blockedSlots && blockedSlots[opponentIndex] && blockedSlots[opponentIndex].includes(creatureSlotIndex)) {
        return { isValid: false, reason: `This slot (${creatureSlotIndex}) is currently blocked by an opponent's aquatic3 effect.` };
      }

      if (state.blockedSlots[playerIndex]?.includes(creatureId)) {
        return { isValid: false, reason: `Creature slot ${creatureId} is currently blocked.` };
      }

      if (creatureWisdom < effectiveCost) {
        return { isValid: false, reason: `Insufficient wisdom on ${creature.id} (${creatureWisdom}) for ${knowledgeCard.name} (cost ${effectiveCost})` };
      }
      return { isValid: true };
    }
    default:
      const unknownAction: never = action; // This will cause a compile error if any GameAction type is missed
      const reason = `Unhandled action type: ${(unknownAction as any).type}`;
      console.log(`[isValidAction] Failed: ${reason}`, action);
      return { isValid: false, reason };
  }
}

/**
 * Executes the knowledge phase: rotates knowledge, applies effects, handles combat.
 * @param state The current game state.
 * @returns The updated game state after the knowledge phase.
 */
export function executeKnowledgePhase(state: GameState): GameState {
  // Use deep clone for the overall phase state
  let newState = JSON.parse(JSON.stringify(state)) as GameState; // Use GameState directly
  newState.log.push(`Turn ${newState.turn}: Knowledge Phase started.`);

  // No need to manually initialize properties if initialGameState and types are correct

  // 1. Rotate Knowledge Cards and Apply Effects
  const knowledgeToDiscard: { playerIndex: number; slotIndex: number; card: Knowledge }[] = [];

  for (let playerIndex = 0; playerIndex < newState.players.length; playerIndex++) {
    for (let slotIndex = 0; slotIndex < newState.players[playerIndex].field.length; slotIndex++) {
      const slot = newState.players[playerIndex].field[slotIndex];

      if (slot.knowledge) {
        const originalKnowledge = slot.knowledge;

        // --- Calculate Rotation --- 
        const currentRotation = originalKnowledge.rotation ?? 0;
        const maxRotationDegrees = (originalKnowledge.maxRotations || 4) * 90;
        const nextRotation = currentRotation + 90;
        const willBeDiscarded = nextRotation >= maxRotationDegrees;
        const finalRotationValue = willBeDiscarded ? maxRotationDegrees : nextRotation;

        // --- Prepare State for Effect --- 
        let stateWithRotationUpdated = JSON.parse(JSON.stringify(newState)) as GameState;
        const slotInClonedState = stateWithRotationUpdated.players[playerIndex]?.field[slotIndex];
        let knowledgeAfterRotation: Knowledge | null = null;

        if (slotInClonedState?.knowledge?.instanceId === originalKnowledge.instanceId) {
          slotInClonedState.knowledge.rotation = finalRotationValue;
          knowledgeAfterRotation = slotInClonedState.knowledge;
        } else {
          console.error(`[executeKnowledgePhase] Mismatch finding knowledge ${originalKnowledge.instanceId} in cloned state before effect.`);
          knowledgeAfterRotation = { ...originalKnowledge, rotation: finalRotationValue };
        }

        // --- Apply Effect (if any) --- 
        const effectFn = knowledgeEffects[originalKnowledge.id];
        if (effectFn && knowledgeAfterRotation) {
           newState = effectFn({
             state: stateWithRotationUpdated,
             playerIndex: playerIndex,
             fieldSlotIndex: slotIndex,
             knowledge: knowledgeAfterRotation,
             rotation: finalRotationValue,
             isFinalRotation: willBeDiscarded
           });
        } else {
           newState = stateWithRotationUpdated;
        }

        // --- Check for Discard --- 
        if (willBeDiscarded) {
          const finalKnowledgeInSlot = newState.players[playerIndex]?.field[slotIndex]?.knowledge;
          if (finalKnowledgeInSlot?.instanceId === originalKnowledge.instanceId && finalKnowledgeInSlot.rotation === finalRotationValue) {
             knowledgeToDiscard.push({ playerIndex, slotIndex, card: { ...finalKnowledgeInSlot } });
          }
        }
      } // end if(slot.knowledge)
    } // end for slotIndex
  } // end for playerIndex

  // --- Discard Phase --- 
  if (knowledgeToDiscard.length > 0) {
    newState = processKnowledgeDiscards(newState, knowledgeToDiscard);
  }

  // 2. Resolve Pending Damage/Effects (if any were queued)
  // newState = resolvePendingEffects(newState);

  // 3. Check Win Conditions
  newState = checkWinConditions(newState); // Renamed from checkWinCondition

  newState.log.push(`Turn ${newState.turn}: Knowledge Phase ended.`);

  // Return the final state - type assertion might not be strictly needed if handled well
  return newState;
}

/**
 * Checks if the game has reached a win condition.
 * @param state The current game state.
 * @returns The updated game state, potentially with a winner and phase change.
 */
export function checkWinConditions(state: GameState): GameState {
  const player1 = state.players[0];
  const player2 = state.players[1];
  let winner: string | null = null;

  if (player2.power <= 0) {
    winner = player1.id;
  }
  if (player1.power <= 0) {
    // If player 1 also reached 0 or less (e.g. simultaneous damage), player 2 might still win if they have more power
    if (winner === player1.id && player1.power < player2.power) {
       winner = player2.id; // Player 2 wins if player 1 is also <= 0 but has less power
    } else if (winner === null) {
       winner = player2.id; // Player 2 wins if only player 1 is <= 0
    }
    // If both are <= 0 and equal power, could be a draw or player1 wins based on tie-breaker rule (currently player1 wins)
  }

  if (winner && state.winner !== winner) { // Only update if winner changed
    console.log(`[WinCondition] Player ${winner} has won!`);
    return {
      ...state,
      winner: winner,
      phase: 'gameOver',
      log: [...state.log, `Game Over! Player ${winner} wins!`]
    };
  }

  return state; // No winner or winner already set
}
