import { knowledgeEffects } from './effects.js';
// Removed unused CombatBuffers import
import { GameState, GameAction, Knowledge } from './types';
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
  // Restore deep clone to prevent mutation issues
  let newState = JSON.parse(JSON.stringify(state)) as GameState & { extraActionsNextTurn?: Record<number, number>; blockedSlots?: Record<number, number[]> };
  newState.log.push(`Turn ${newState.turn}: Knowledge Phase started.`);

  // Initialize extraActionsNextTurn for the current turn if it doesn't exist
  if (!newState.extraActionsNextTurn) {
    newState.extraActionsNextTurn = { 0: 0, 1: 0 };
  }
  // Ensure pendingEffects is initialized if missing (due to clone)
  if (!newState.pendingEffects) {
     newState.pendingEffects = [];
  }
  // Ensure blockedSlots is initialized if missing (due to clone)
   if (!newState.blockedSlots) {
     newState.blockedSlots = { 0: [], 1: [] };
   }


  // 1. Rotate Knowledge Cards and Apply Effects
  const knowledgeToDiscard: { playerIndex: number; slotIndex: number; card: Knowledge }[] = [];

  for (let playerIndex = 0; playerIndex < newState.players.length; playerIndex++) {
    const player = newState.players[playerIndex];

    player.field.forEach((slot, slotIndex) => {
      if (slot.knowledge) {
        const currentRotation = slot.knowledge.rotation ?? 0;
        const maxRotationDegrees = (slot.knowledge.maxRotations || 4) * 90; // Default to 4 if undefined
        const willBeDiscarded = currentRotation + 90 >= maxRotationDegrees; // Check if it will be discarded this turn

        const nextRotation = currentRotation + 90;
        slot.knowledge.rotation = nextRotation;
        newState.log.push(`Knowledge ${slot.knowledge.name} (Player ${playerIndex + 1}, Slot ${slotIndex}) rotated to ${nextRotation}º.`);

        const effectFn = knowledgeEffects[slot.knowledge.id];
        if (effectFn) {
          newState = effectFn({
            state: newState,
            playerIndex: playerIndex,
            fieldSlotIndex: slotIndex,
            knowledge: slot.knowledge,
            rotation: nextRotation,
            isFinalRotation: willBeDiscarded // Pass whether it will be discarded
          });
        }

        if (willBeDiscarded) {
          knowledgeToDiscard.push({ playerIndex, slotIndex, card: { ...slot.knowledge } });
        }
      }
    });
  }

  knowledgeToDiscard.forEach(({ playerIndex, slotIndex, card }) => {
    const player = newState.players[playerIndex];
    const creatureName = player.creatures.find(c => c.id === player.field[slotIndex].creatureId)?.name || `Creature ${player.field[slotIndex].creatureId}`;
    const maxRotationDegrees = (card.maxRotations || 4) * 90;

    newState.discardPile.push(card);
    newState.log.push(`${card.name} on ${creatureName} (Player ${playerIndex + 1}) reached ${card.rotation}º/${maxRotationDegrees}º and was discarded.`);

    if (card.id === 'aquatic3') {
      const opponentIndex = playerIndex === 0 ? 1 : 0;
      const opposingSlotIndex = slotIndex;
      if (newState.blockedSlots && newState.blockedSlots[opponentIndex]) {
        const initialLength = newState.blockedSlots[opponentIndex].length;
        newState.blockedSlots[opponentIndex] = newState.blockedSlots[opponentIndex].filter((idx: number) => idx !== opposingSlotIndex);
        if (newState.blockedSlots[opponentIndex].length < initialLength) {
          newState.log.push(`Block on opponent's slot ${opposingSlotIndex} removed`);
        }
      }
    }

    newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
      playerId: player.id,
      creatureId: player.field[slotIndex].creatureId,
      knowledgeCard: card
    });

    const targetPlayer = newState.players[playerIndex]; // Use newState here
    if (targetPlayer && targetPlayer.field[slotIndex]) {
      targetPlayer.field[slotIndex].knowledge = null;
      console.log(`[executeKnowledgePhase] Set knowledge to null for Player ${playerIndex + 1}, Slot ${slotIndex}`);
    } else {
      console.error(`[executeKnowledgePhase] Error: Could not find player/slot to nullify knowledge for discard. PlayerIndex: ${playerIndex}, SlotIndex: ${slotIndex}`);
    }
  });

  // --- Damage/Defense Resolution ---
  // Custom damage resolution with Zhar-Ptitsa passive
  const player1 = newState.players[0];
  const player2 = newState.players[1];
  // Calculate damage from player1's field knowledge
  let p1Damage = 0;
  player1.field.forEach(slot => {
    if (slot.knowledge) {
      p1Damage += slot.knowledge.element === 'air' ? 1 : slot.knowledge.cost;
    }
  });
  // Calculate defense from player2's field water knowledge
  const p2Defense = player2.field.reduce((sum, slot) => sum + (slot.knowledge && slot.knowledge.element === 'water' ? 1 : 0), 0);
  // Apply Zhar-Ptitsa bypass if owner has the creature and has air knowledge
  const hasZhar = player1.creatures.some(c => c.id === 'zhar-ptitsa');
  const hasAirKnowledge = player1.field.some(slot => slot.knowledge?.element === 'air');
  let netDamageToP2 = 0;
  if (hasZhar && hasAirKnowledge) {
    netDamageToP2 = p1Damage;
    newState.log.push(
      `[Passive Effect] Zhar-Ptitsa (Owner: ${player1.id}) bypasses defense for aerial knowledge.`
    );
  } else {
    netDamageToP2 = Math.max(0, p1Damage - p2Defense);
  }
  if (netDamageToP2 > 0) {
    player2.power -= netDamageToP2;
    newState.log.push(
      `[Damage] ${player1.id} dealt ${netDamageToP2} net damage to ${player2.id}.`
    );
  }
  // Skip pendingEffects-based resolution

  // Clear pending effects for the next phase/turn
  newState.pendingEffects = [];

  newState.phase = 'action';
  newState.actionsTakenThisTurn = 0;
  newState.log.push(`Turn ${newState.turn}: Action Phase started.`);

  return newState;
}

/**
 * Checks if the game has reached a win condition.
 * @param state The current game state.
 * @returns The ID of the winning player, or null if no winner yet.
 */
export function checkWinCondition(state: GameState): string | null {
  const player1 = state.players[0];
  const player2 = state.players[1];

  if (player2.power <= 0) {
    return player1.id;
  }
  if (player1.power <= 0) {
    return player2.id;
  }

  return null;
}
