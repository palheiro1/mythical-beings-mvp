import { knowledgeEffects } from './effects.js';
import { cloneDeep } from 'lodash';
import { GameState, GameAction, Knowledge, SummonKnowledgePayload } from './types'; // Import SummonKnowledgePayload
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
    return { isValid: true };
  }

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer) {
    return { isValid: false, reason: 'Current player not found.' };
  }

  // Most actions have a playerId in their payload, ensure it matches the current player
  if (action.payload && 'playerId' in action.payload && currentPlayer.id !== action.payload.playerId) {
    return { isValid: false, reason: 'Not the current player\'s turn or action not for this player.' };
  }

  if (state.phase !== 'action') {
    return { isValid: false, reason: 'Not in action phase.' };
  }

  if (state.actionsTakenThisTurn >= state.actionsPerTurn && action.type !== 'END_TURN') { // END_TURN is always allowed if it's the player's turn
    return { isValid: false, reason: 'No actions left this turn.' };
  }

  switch (action.type) {
    case 'SUMMON_KNOWLEDGE': {
      if (!action.payload) {
        return { isValid: false, reason: 'Missing payload for SUMMON_KNOWLEDGE.' };
      }
      const payload = action.payload as SummonKnowledgePayload;
      const actingPlayer = state.players.find((p: typeof state.players[number]) => p.id === payload.playerId);
      if (!actingPlayer) return { isValid: false, reason: 'Acting player not found for summon.' };

      const creature = actingPlayer.creatures.find((c: typeof actingPlayer.creatures[number]) => c.id === payload.creatureId);
      if (!creature) {
        return { isValid: false, reason: 'Target creature not found.' };
      }

      const fieldSlotIndex = actingPlayer.field.findIndex((s: typeof actingPlayer.field[number]) => s.creatureId === payload.creatureId);
      if (fieldSlotIndex === -1) {
        return { isValid: false, reason: 'Target field slot not found.' };
      }
      const fieldSlot = actingPlayer.field[fieldSlotIndex];

      const actingPlayerIndex = state.players.findIndex((p: typeof state.players[number]) => p.id === actingPlayer.id);
      const opponentPlayerIndex = actingPlayerIndex === 0 ? 1 : 0;

      // Check if the slot is blocked by the opponent
      if (state.blockedSlots[opponentPlayerIndex]?.includes(fieldSlotIndex)) {
        return { isValid: false, reason: `Creature slot ${payload.creatureId} is currently blocked by an opponent.` };
      }

      // Check if the slot is blocked by the current player (self-block)
      if (state.blockedSlots[actingPlayerIndex]?.includes(fieldSlotIndex)) {
        return { isValid: false, reason: `Creature slot ${payload.creatureId} is currently blocked.` };
      }

      // Check if the slot already has knowledge (new rule)
      if (fieldSlot.knowledge) {
        return { isValid: false, reason: 'Creature slot already has knowledge.' };
      }

      const knowledgeCardInHand = actingPlayer.hand.find((k: Knowledge) => k.instanceId === payload.instanceId);
      if (!knowledgeCardInHand) {
        return { isValid: false, reason: 'Knowledge card not in hand.' };
      }
      if (creature.currentWisdom < knowledgeCardInHand.cost) {
        return { isValid: false, reason: 'Creature does not have enough wisdom.' };
      }
      return { isValid: true };
    }
    case 'ROTATE_CREATURE': {
      if (!action.payload) {
        return { isValid: false, reason: 'Missing payload for ROTATE_CREATURE.' };
      }
      const payload = action.payload as { playerId: string; creatureId: string };
      const actingPlayer = state.players.find((p: typeof state.players[number]) => p.id === payload.playerId);
      if (!actingPlayer) return { isValid: false, reason: 'Acting player not found for rotate.' };

      const creature = actingPlayer.creatures.find((c: typeof actingPlayer.creatures[number]) => c.id === payload.creatureId);
      if (!creature) {
        return { isValid: false, reason: 'Creature to rotate not found.' };
      }
      // Add any specific rotation rules if necessary (e.g., cannot rotate if already max wisdom)
      return { isValid: true };
    }
    case 'DRAW_KNOWLEDGE': {
      if (!action.payload) {
        return { isValid: false, reason: 'Missing payload for DRAW_KNOWLEDGE.' };
      }
      const payload = action.payload as { playerId: string; knowledgeId: string; instanceId: string };
      const actingPlayer = state.players.find((p: typeof state.players[number]) => p.id === payload.playerId);
      if (!actingPlayer) return { isValid: false, reason: 'Acting player not found for draw.' };

      if (actingPlayer.hand.length >= MAX_HAND_SIZE) {
        return { isValid: false, reason: 'Hand is full.' };
      }
      const marketCard = state.market.find((k: Knowledge) => k.instanceId === payload.instanceId);
      if (!marketCard) {
        return { isValid: false, reason: 'Card not found in market.' };
      }
      // Potentially add cost check if drawing from market has a cost in your rules
      return { isValid: true };
    }
    case 'END_TURN':
      // Basic validation already handled (current player, action phase)
      return { isValid: true };
    default:
      // For actions not explicitly handled, assume valid if basic checks pass
      // Or, you can return { isValid: false, reason: 'Unknown action type.' } for stricter validation
      return { isValid: true };
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
                  isFinalRotation: willBeDiscarded,
                  trigger: 'onPhase',
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
