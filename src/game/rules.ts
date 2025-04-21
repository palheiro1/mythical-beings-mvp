import { knowledgeEffects } from './effects';
import { GameState, GameAction, CombatBuffers, Knowledge } from './types';
import { applyPassiveAbilities } from './passives';

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
        return false;
      }

      // Creature is guaranteed to be defined here
      const creatureWisdom = creature.currentWisdom;

      // Explicitly check if wisdom is a number before comparison
      if (typeof creatureWisdom !== 'number') {
          console.error(`[isValidAction] Error: Creature ${creatureId} has invalid or undefined currentWisdom: ${creatureWisdom}`);
          return false;
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

      // Now creatureWisdom is confirmed to be a number
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
 * Applies combat damage based on accumulated buffers.
 * @param state The current game state.
 * @param buffers The combat buffers with accumulated damage and defense.
 * @returns The updated game state.
 */
function applyCombatDamage(state: GameState, buffers: CombatBuffers): GameState {
    let newState = JSON.parse(JSON.stringify(state)) as GameState;
    const [p1, p2] = newState.players;

    // Calculate net damage for each player
    const netDamageP1 = Math.max(0, buffers.damage[0] - buffers.defense[0]);
    const netDamageP2 = Math.max(0, buffers.damage[1] - buffers.defense[1]);

    // Apply damage and log
    if (netDamageP1 > 0) {
        const oldPower = p1.power;
        p1.power -= netDamageP1;
        newState.log.push(`Combat: Player 1 takes ${netDamageP1} damage (raw ${buffers.damage[0]} - defense ${buffers.defense[0]}). Power: ${oldPower} -> ${p1.power}`);
    } else if (buffers.damage[0] > 0) {
        newState.log.push(`Combat: Player 1 absorbs all damage (raw ${buffers.damage[0]} - defense ${buffers.defense[0]}).`);
    }

    if (netDamageP2 > 0) {
        const oldPower = p2.power;
        p2.power -= netDamageP2;
        newState.log.push(`Combat: Player 2 takes ${netDamageP2} damage (raw ${buffers.damage[1]} - defense ${buffers.defense[1]}). Power: ${oldPower} -> ${p2.power}`);
    } else if (buffers.damage[1] > 0) {
        newState.log.push(`Combat: Player 2 absorbs all damage (raw ${buffers.damage[1]} - defense ${buffers.defense[1]}).`);
    }

    return newState;
}


/**
 * Executes the knowledge phase: rotates knowledge, applies effects, handles combat.
 * @param state The current game state.
 * @returns The updated game state after the knowledge phase.
 */
export function executeKnowledgePhase(state: GameState): GameState {
  let newState = JSON.parse(JSON.stringify(state)) as GameState;
  newState.log.push(`Turn ${newState.turn}: Knowledge Phase started.`);

  // 1. Rotate Knowledge Cards and Apply Effects
  // Corrected CombatBuffers initialization
  const combatBuffers: CombatBuffers = { damage: [0, 0], defense: [0, 0] };
  const knowledgeToDiscard: { playerIndex: number; slotIndex: number; card: Knowledge }[] = [];

  for (let playerIndex = 0; playerIndex < newState.players.length; playerIndex++) {
    const player = newState.players[playerIndex];
    // const opponent = newState.players[(playerIndex + 1) % 2]; // Opponent reference for effects

    player.field.forEach((slot, slotIndex) => {
      if (slot.knowledge) {
        const currentRotation = slot.knowledge.rotation ?? 0;
        const isFinalRotation = currentRotation >= 270; // Check if rotation is 270 or more

        if (!isFinalRotation) {
          // Rotate the card and apply effects
          const nextRotation = currentRotation + 90;
          slot.knowledge.rotation = nextRotation;
          // REMOVED: Log for knowledge rotation

          // Apply effect if rotation is a multiple of 90 and effect exists
          const effectFn = knowledgeEffects[slot.knowledge.id];
          if (effectFn) {
             // Corrected call to knowledge effect function
             newState = effectFn({
                 state: newState,
                 playerIndex: playerIndex,
                 fieldSlotIndex: slotIndex,
                 knowledge: slot.knowledge,
                 rotation: nextRotation, // Pass the new rotation
                 isFinalRotation: nextRotation >= 270, // Check if this *new* rotation is final
                 buffers: combatBuffers
             });
          }
        } else {
          // Mark knowledge for discard AFTER processing all rotations/effects
          knowledgeToDiscard.push({ playerIndex, slotIndex, card: { ...slot.knowledge } });
          // Don't nullify here yet, let passives trigger first if needed based on the card *being* there
        }
      }
    });
  }

  // 1b. Process Discards and Trigger Passives
  knowledgeToDiscard.forEach(({ playerIndex, slotIndex, card }) => {
      const player = newState.players[playerIndex];
      const creatureName = player.creatures.find(c => c.id === player.field[slotIndex].creatureId)?.name || `Creature ${player.field[slotIndex].creatureId}`;
      
      newState.discardPile.push(card);
      newState.log.push(`${card.name} on ${creatureName} (Player ${playerIndex + 1}) was fully rotated and discarded.`);

      // Apply KNOWLEDGE_LEAVE passive trigger *before* nullifying
      newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
          playerId: player.id,
          creatureId: player.field[slotIndex].creatureId,
          knowledgeCard: card // Pass the actual card being discarded
      });

      // Now, actually remove the knowledge from the field in the potentially modified newState
      // Ensure we are modifying the correct player and slot in the *current* newState
      const targetPlayer = newState.players[playerIndex];
      if (targetPlayer && targetPlayer.field[slotIndex]) {
          targetPlayer.field[slotIndex].knowledge = null;
          console.log(`[executeKnowledgePhase] Set knowledge to null for Player ${playerIndex + 1}, Slot ${slotIndex}`);
      } else {
          console.error(`[executeKnowledgePhase] Error: Could not find player/slot to nullify knowledge for discard. PlayerIndex: ${playerIndex}, SlotIndex: ${slotIndex}`);
      }
  });


  // 2. Apply Combat Damage from Buffers
  // Assuming applyCombatDamage is defined elsewhere in this file or imported correctly
  newState = applyCombatDamage(newState, combatBuffers);

  // 3. Transition to Action Phase
  newState.phase = 'action';
  newState.actionsTakenThisTurn = 0; // Reset actions for the new turn
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
    return player1.id; // Player 1 wins
  }
  if (player1.power <= 0) {
    return player2.id; // Player 2 wins
  }

  return null; // No winner yet
}
