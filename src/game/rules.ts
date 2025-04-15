import { GameState, GameAction, PlayerState } from './types';

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

  if (state.actionsTakenThisTurn >= ACTIONS_PER_TURN && action.type !== 'END_TURN') {
    console.error("Invalid action: No actions remaining this turn.");
    return false; // No actions left, unless it's END_TURN
  }

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

      if ((creature.currentWisdom ?? creature.baseWisdom) < knowledgeCard.cost) {
        console.error("Invalid action: Insufficient Wisdom.");
        return false; // Not enough wisdom
      }

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
 * - Rotates knowledge cards.
 * - Discards completed knowledge cards.
 * @param state The current game state.
 * @returns The updated game state after the Knowledge Phase.
 */
export function executeKnowledgePhase(state: GameState): GameState {
  let newState = { ...state, log: [...state.log, `Turn ${state.turn}: Knowledge Phase started.`] };

  // Placeholder for effect execution - needs detailed implementation based on card effects
  newState.players.forEach((player, playerIndex) => {
    player.field.forEach(fieldSlot => {
      if (fieldSlot.knowledge) {
        // TODO: Implement actual effect logic based on fieldSlot.knowledge.effect
        // Example: Check effect string and apply damage, healing, etc.
        // This will likely involve modifying opponent's state or player's state.
        newState.log.push(`Executing effect for ${fieldSlot.knowledge.name} on ${fieldSlot.creatureId} for Player ${playerIndex + 1}`);
      }
    });
  });

  // Rotate and discard knowledge cards
  const updatedPlayers = newState.players.map((player, playerIndex) => {
    const updatedField = player.field.map(fieldSlot => {
      if (fieldSlot.knowledge) {
        const newRotation = (fieldSlot.knowledge.rotation ?? 0) + 90;
        if (newRotation >= 360) {
          newState.log.push(`${fieldSlot.knowledge.name} on ${fieldSlot.creatureId} (Player ${playerIndex + 1}) completed rotation and is discarded.`);
          return { ...fieldSlot, knowledge: null }; // Discard card
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
