import { knowledgeEffects } from './effects.js';
import { cloneDeep } from 'lodash'; // Import cloneDeep
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
  let phaseState = cloneDeep(state); // Use cloneDeep for initial phase clone
  phaseState.log.push(`Turn ${phaseState.turn}: Knowledge Phase started.`);

  const knowledgeToDiscard: { playerIndex: number; slotIndex: number; card: Knowledge }[] = [];
  const effectStates: { playerIndex: number; slotIndex: number; state: GameState }[] = [];

  // 1. Calculate Rotations and Prepare Effect States (Read-only pass)
  for (let playerIndex = 0; playerIndex < phaseState.players.length; playerIndex++) {
    for (let slotIndex = 0; slotIndex < phaseState.players[playerIndex].field.length; slotIndex++) {
      const slot = phaseState.players[playerIndex].field[slotIndex];

      if (slot.knowledge) {
        const originalKnowledge = slot.knowledge;
        const currentRotation = originalKnowledge.rotation ?? 0;
        const maxRotationDegrees = (originalKnowledge.maxRotations || 4) * 90;
        const nextRotation = currentRotation + 90;
        const willBeDiscarded = nextRotation >= maxRotationDegrees;

        const effectFn = knowledgeEffects[originalKnowledge.id];
        if (effectFn) {
          // Prepare a state snapshot *before* this specific effect runs
          // Use cloneDeep for the snapshot as well, though maybe unnecessary if effects always clone
          let stateForEffect = cloneDeep(phaseState);

          effectStates.push({
            playerIndex,
            slotIndex,
            state: stateForEffect
          });
        }

        if (willBeDiscarded) {
          knowledgeToDiscard.push({ playerIndex, slotIndex, card: { ...originalKnowledge } });
        }

        const knowledgeInMainState = phaseState.players[playerIndex]?.field[slotIndex]?.knowledge;
        if (knowledgeInMainState?.instanceId === originalKnowledge.instanceId) {
           knowledgeInMainState.rotation = nextRotation;
        }
      }
    }
  }

  // 2. Apply Effects Sequentially (Mutating pass)
  let currentState = phaseState; // Start with the already cloned phaseState
  for (const { playerIndex, slotIndex, state: stateSnapshot } of effectStates) {
      const slot = stateSnapshot.players[playerIndex]?.field[slotIndex];
      if (slot?.knowledge) {
          const knowledgeForEffect = slot.knowledge;
          const effectFn = knowledgeEffects[knowledgeForEffect.id];
          const currentRotation = knowledgeForEffect.rotation ?? 0;
          const maxRotationDegrees = (knowledgeForEffect.maxRotations || 4) * 90;
          const nextRotation = currentRotation + 90;
          const willBeDiscarded = nextRotation >= maxRotationDegrees;

          if (effectFn) {
              // Apply effect to the *currentState*
              // The effect function itself now uses cloneDeep internally
              currentState = effectFn({
                  state: currentState,
                  playerIndex: playerIndex,
                  fieldSlotIndex: slotIndex,
                  knowledge: knowledgeForEffect,
                  rotation: currentRotation,
                  isFinalRotation: willBeDiscarded
              });
          }
      }
  }
  phaseState = currentState; // Update phaseState with the result of all effects

  // 3. Discard Phase
  if (knowledgeToDiscard.length > 0) {
    phaseState = processKnowledgeDiscards(phaseState, knowledgeToDiscard);
  }

  // 4. Check Win Conditions
  phaseState = checkWinConditions(phaseState);

  phaseState.log.push(`Turn ${phaseState.turn}: Knowledge Phase ended.`);
  return phaseState;
}

/**
 * Processes the discarding of knowledge cards at the end of the knowledge phase.
 * @param state The current game state.
 * @param discards An array of knowledge cards to discard.
 * @returns The updated game state.
 */
function processKnowledgeDiscards(
  state: GameState,
  discards: { playerIndex: number; slotIndex: number; card: Knowledge }[]
): GameState {
  let newState = state; // Start with the current state (already a clone from executeKnowledgePhase)
  const discardedInstanceIds = new Set(discards.map(d => d.card.instanceId));

  for (const { playerIndex, slotIndex, card } of discards) {
    const player = newState.players[playerIndex];
    const fieldSlot = player?.field[slotIndex];

    // Double-check if the card is still there and matches the instanceId before discarding
    if (fieldSlot?.knowledge?.instanceId === card.instanceId) {
      newState.log.push(`[Knowledge Phase] ${card.name} (Player ${playerIndex + 1}, Slot ${slotIndex}) reached max rotations and is discarded.`);
      newState.discardPile.push(fieldSlot.knowledge);
      fieldSlot.knowledge = null;

      // Apply KNOWLEDGE_LEAVE passives
      newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
        playerId: player.id,
        creatureId: fieldSlot.creatureId,
        knowledgeCard: card, // Pass the card that is leaving
      });
    } else {
       // This might happen if an effect already removed the card
       console.log(`[Knowledge Phase] Card ${card.name} (Instance: ${card.instanceId}) already removed from Player ${playerIndex + 1}, Slot ${slotIndex} before discard step.`);
    }
  }
  return newState;
}

/**
 * Checks if the game has reached a win condition.
 * @param state The current game state.
 * @returns The updated game state, potentially with a winner and phase change.
 */
export function checkWinConditions(state: GameState): GameState {
  // Avoid modifying state if game is already over
  if (state.phase === 'gameOver') {
    return state;
  }

  const player1 = state.players[0];
  const player2 = state.players[1];

  const p1Power = player1.power;
  const p2Power = player2.power;

  let winner: string | null = null;
  let isDraw = false;
  let logMsg = '';

  // Check for Draw first
  if (p1Power <= 0 && p2Power <= 0) {
    isDraw = true;
    winner = null; // Explicitly null for draw
    logMsg = '[Game] Draw! Both players reached 0 Power or less simultaneously.';
    console.log(`[WinCondition] Draw condition met! P1: ${p1Power}, P2: ${p2Power}`);
  }
  // Check for Player 1 win
  else if (p2Power <= 0) {
    winner = player1.id;
    logMsg = `[Game] ${winner} wins! ${player2.id} reached 0 Power or less.`;
    console.log(`[WinCondition] Player ${winner} wins! P2 power: ${p2Power}`);
  }
  // Check for Player 2 win
  else if (p1Power <= 0) {
    winner = player2.id;
    logMsg = `[Game] ${winner} wins! ${player1.id} reached 0 Power or less.`;
    console.log(`[WinCondition] Player ${winner} wins! P1 power: ${p1Power}`);
  }

  // Update state if a winner is found or it's a draw
  if (winner !== null || isDraw) {
    return {
      ...state,
      winner: winner,
      phase: 'gameOver',
      log: [...state.log, logMsg]
    };
  }

  return state; // No winner or draw yet
}
