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
  // Handle actions that don't have a standard player payload first
  if (action.type === 'SET_GAME_STATE' || action.type === 'INITIALIZE_GAME') {
    return true; // These are usually system actions, considered valid by default here
  }

  // All other actions should have a playerId in the payload
  const { payload } = action;
  // Use a type guard to safely check for playerId
  if (!payload || typeof payload !== 'object' || !('playerId' in payload)) {
      console.error("Invalid action: Action payload missing playerId or is not an object.");
      return false; // Should not happen with defined types, but good safeguard
  }
  const playerId = (payload as { playerId: string }).playerId; // Safe access after check

  const playerIndex = state.players.findIndex(p => p.id === playerId);
  if (playerIndex === -1) {
      console.error("Invalid action: Player not found in game state.");
      return false; // Player ID from action not found in game
  }

  if (playerIndex !== state.currentPlayerIndex) {
    console.error("Invalid action: Not the player's turn.");
    return false; // Not the player's turn
  }

  const player = state.players[playerIndex];
  if (state.phase !== 'action') {
    console.error("Invalid action: Not in action phase.");
    return false; // Can only perform actions during the action phase
  }

  // --- Action Cost Check (with Passive modifications) ---
  let costsAction = true; // Assume action costs a point by default

  // Check passives that might make SUMMON_KNOWLEDGE free
  if (action.type === 'SUMMON_KNOWLEDGE') {
    const summonPayload = payload as { playerId: string; knowledgeId: string; creatureId: string };
    const knowledgeCard = player.hand.find(k => k.id === summonPayload.knowledgeId);
    const hasDudugera = player.creatures.some(c => c.id === 'dudugera');
    const hasKappa = player.creatures.some(c => c.id === 'kappa');

    if (hasDudugera) {
      costsAction = false;
      console.log("Passive Check: Dudugera makes summon free.");
    } else if (hasKappa && knowledgeCard && knowledgeCard.element === 'water') {
      costsAction = false;
      console.log("Passive Check: Kappa makes aquatic summon free.");
    }
  }

  // Now check if the player has enough actions IF the action costs one
  if (costsAction && state.actionsTakenThisTurn >= ACTIONS_PER_TURN && action.type !== 'END_TURN') {
    console.error("Invalid action: No actions remaining this turn.");
    return false; // No actions left, unless it's END_TURN or made free by passive
  }
  // --- End Action Cost Check ---


  switch (action.type) {
    case 'ROTATE_CREATURE': {
      // Type assertion needed because payload structure varies
      const rotatePayload = payload as { playerId: string; creatureId: string };
      const creatureExists = player.creatures.some(c => c.id === rotatePayload.creatureId);
      if (!creatureExists) {
        console.error("Invalid action: Creature not found.");
        return false;
      }
      return true;
    }

    case 'DRAW_KNOWLEDGE': {
      // Type assertion
      const drawPayload = payload as { playerId: string; knowledgeId: string };
      if (player.hand.length >= MAX_HAND_SIZE) {
        console.error("Invalid action: Hand is full.");
        return false; // Hand is full
      }
      const cardInMarket = state.market.some(k => k.id === drawPayload.knowledgeId);
      if (!cardInMarket) {
        console.error("Invalid action: Card not in market.");
        return false; // Card not available in the market
      }
      return true;
    }

    case 'SUMMON_KNOWLEDGE': {
      // Type assertion
      const summonPayload = payload as { playerId: string; knowledgeId: string; creatureId: string };
      const { knowledgeId, creatureId } = summonPayload;
      const knowledgeCard = player.hand.find(k => k.id === knowledgeId);
      const creature = player.creatures.find(c => c.id === creatureId);

      if (!knowledgeCard) {
        console.error("Invalid action: Knowledge card not in hand.");
        return false; // Card not in hand
      }
      if (!creature) {
        console.error("Invalid action: Target creature not found.");
        return false; // Creature not found
      }

      const creatureField = player.field.find(f => f.creatureId === creatureId);
      if (creatureField?.knowledge) {
          console.error("Invalid action: Creature already has knowledge attached.");
          return false;
      }

      // Use currentWisdom if set, else compute
      const wisdom = creature.currentWisdom ?? getCreatureWisdom(creature);
      const cost = knowledgeCard.cost;
      if (wisdom < cost) {
        console.error(`Invalid action: Insufficient Wisdom. Creature wisdom: ${wisdom}, Knowledge cost: ${cost}`);
        return false; // Not enough wisdom
      }
      console.log(`[SUMMON_KNOWLEDGE] Creature: ${creature.name}, Wisdom: ${wisdom}, Knowledge: ${knowledgeCard.name}, Cost: ${cost}`);
      // Action cost check is now handled above
      return true;
    }

    case 'END_TURN':
      // Can always end turn if it's your turn and in action phase
      return true;

    default:
      // This should ideally be caught by TypeScript if all action types are handled
      // but provides a fallback.
      // We use an exhaustive check pattern here.
      const _exhaustiveCheck: never = action;
      console.error(`Unknown action type: ${(_exhaustiveCheck as GameAction).type}`);
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
