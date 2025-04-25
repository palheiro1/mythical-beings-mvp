import { knowledgeEffects } from './effects';
import { GameState, GameAction, CombatBuffers, Knowledge } from './types';
import { applyPassiveAbilities } from './passives';

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
      const { knowledgeId } = action.payload as { playerId: string; knowledgeId: string };
      const player = state.players[playerIndex];
      if (!state.market.some(k => k.id === knowledgeId)) {
        return { isValid: false, reason: `Knowledge ${knowledgeId} not in market` };
      }
      if (player.hand.length >= MAX_HAND_SIZE) {
        return { isValid: false, reason: `Hand full` };
      }
      return { isValid: true };
    }
    case 'SUMMON_KNOWLEDGE': {
      const { knowledgeId, creatureId } = action.payload as { playerId: string; knowledgeId: string; creatureId: string };
      const player = state.players[playerIndex];
      const knowledgeCard = player.hand.find(k => k.id === knowledgeId);
      if (!knowledgeCard) {
        return { isValid: false, reason: `Knowledge ${knowledgeId} not in hand` };
      }
      const creatureSlot = player.field.find(f => f.creatureId === creatureId);
      if (!creatureSlot) {
        return { isValid: false, reason: `Creature ${creatureId} not on field` };
      }
      if (creatureSlot.knowledge) {
        return { isValid: false, reason: `Creature ${creatureId} already has knowledge` };
      }

      const creature = player.creatures.find(c => c.id === creatureId);
      if (!creature) {
        return { isValid: false, reason: `Base creature ${creatureId} not found` };
      }

      const creatureWisdom = creature.currentWisdom;
      if (typeof creatureWisdom !== 'number') {
        return { isValid: false, reason: `Creature ${creatureId} has invalid wisdom` };
      }

      let effectiveCost = knowledgeCard.cost;
      // Apply cost reductions
      if (knowledgeCard.element === 'water' && player.creatures.some(c => c.id === 'kappa' && player.field.some(f => f.creatureId === 'kappa'))) {
        effectiveCost = Math.max(1, effectiveCost - 1);
      }
      if (knowledgeCard.element === 'earth' && player.creatures.some(c => c.id === 'dudugera' && player.field.some(f => f.creatureId === 'dudugera'))) {
        effectiveCost = Math.max(1, effectiveCost - 1);
      }

      // Aquatic3 persistent block: prevent summoning if slot is blocked
      const blockedSlots = (state as any).blockedSlots;
      if (blockedSlots && blockedSlots[playerIndex] && blockedSlots[playerIndex].includes(player.field.findIndex(f => f.creatureId === creatureId))) {
        return { isValid: false, reason: `This slot is currently blocked by an opponent's aquatic3 effect.` };
      }

      if (creatureWisdom < effectiveCost) {
        return { isValid: false, reason: `Insufficient wisdom (${creatureWisdom} < ${effectiveCost})` };
      }
      return { isValid: true };
    }
    // Add case for END_TURN
    case 'END_TURN': {
      // Basic checks (player turn, phase) are already done before the switch.
      // Ending the turn is always valid if those pass.
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
 * Applies combat damage based on accumulated buffers.
 * @param state The current game state.
 * @param buffers The combat buffers with accumulated damage and defense.
 * @returns The updated game state.
 */
function applyCombatDamage(state: GameState, buffers: CombatBuffers): GameState {
  let newState = JSON.parse(JSON.stringify(state)) as GameState;
  const [p1, p2] = newState.players;

  // Trepulcahue passive: +1 defense for each knowledge if player controls Trepulcahue
  for (let i = 0; i < newState.players.length; i++) {
    const player = newState.players[i];
    const hasTrepulcahue = player.creatures.some(c => c.id === 'trepulcahue');
    if (hasTrepulcahue) {
      const knowledgeCount = player.field.filter(slot => slot.knowledge).length;
      if (knowledgeCount > 0) {
        buffers.defense[i] += knowledgeCount;
        newState.log.push(`Trepulcahue passive: Player ${i + 1} gains +${knowledgeCount} defense (one per knowledge).`);
      }
    }
  }

  // Zhar Ptitsa passive: Aeric Knowledges' damage cannot be blocked
  for (let i = 0; i < newState.players.length; i++) {
    const player = newState.players[i];
    const opponentIndex = i === 0 ? 1 : 0;
    const hasZharPtitsa = player.creatures.some(c => c.id === 'zhar-ptitsa');
    if (hasZharPtitsa) {
      // Calculate total aeric and non-aeric damage for this player
      let aericDamage = 0;
      let nonAericDamage = 0;
      // Find all knowledge cards on field and their contributions
      player.field.forEach((slot, slotIdx) => {
        if (slot.knowledge) {
          const k = slot.knowledge;
          // Find the effect function for this knowledge
          const effectFn = knowledgeEffects[k.id];
          if (effectFn) {
            // Simulate effect to get damage for this slot (ignore defense, just sum damage)
            // We'll use a dummy buffer to capture the damage
            const dummyBuffers: CombatBuffers = { damage: [0, 0], defense: [0, 0] };
            effectFn({
              state: newState,
              playerIndex: i,
              fieldSlotIndex: slotIdx,
              knowledge: k,
              rotation: k.rotation ?? 0,
              isFinalRotation: false,
              buffers: dummyBuffers
            });
            // Damage is always applied to opponentIndex
            const dmg = dummyBuffers.damage[opponentIndex];
            if (k.element === 'air') aericDamage += dmg;
            else nonAericDamage += dmg;
          }
        }
      });
      // Now, apply defense only to non-aeric damage
      const totalDefense = buffers.defense[opponentIndex];
      const blockedNonAeric = Math.min(nonAericDamage, totalDefense);
      const unblockedAeric = aericDamage;
      const netDamage = unblockedAeric + Math.max(0, nonAericDamage - totalDefense);
      // Overwrite the buffer for this round
      buffers.damage[opponentIndex] = netDamage;
      buffers.defense[opponentIndex] = 0; // All defense is considered used up
      newState.log.push(`Zhar Ptitsa passive: Player ${i + 1}'s aeric Knowledges deal ${unblockedAeric} unblockable damage. Non-aeric damage: ${nonAericDamage}, blocked: ${blockedNonAeric}, total damage to Player ${opponentIndex + 1}: ${netDamage}.`);
    }
  }

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
  const combatBuffers: CombatBuffers = { damage: [0, 0], defense: [0, 0] };
  const knowledgeToDiscard: { playerIndex: number; slotIndex: number; card: Knowledge }[] = [];

  for (let playerIndex = 0; playerIndex < newState.players.length; playerIndex++) {
    const player = newState.players[playerIndex];

    player.field.forEach((slot, slotIndex) => {
      if (slot.knowledge) {
        const currentRotation = slot.knowledge.rotation ?? 0;
        const isFinalRotation = currentRotation >= 270;

        if (!isFinalRotation) {
          const nextRotation = currentRotation + 90;
          slot.knowledge.rotation = nextRotation;

          const effectFn = knowledgeEffects[slot.knowledge.id];
          if (effectFn) {
            newState = effectFn({
              state: newState,
              playerIndex: playerIndex,
              fieldSlotIndex: slotIndex,
              knowledge: slot.knowledge,
              rotation: nextRotation,
              isFinalRotation: nextRotation >= 270,
              buffers: combatBuffers
            });
          }
        } else {
          knowledgeToDiscard.push({ playerIndex, slotIndex, card: { ...slot.knowledge } });
        }
      }
    });
  }

  knowledgeToDiscard.forEach(({ playerIndex, slotIndex, card }) => {
    const player = newState.players[playerIndex];
    const creatureName = player.creatures.find(c => c.id === player.field[slotIndex].creatureId)?.name || `Creature ${player.field[slotIndex].creatureId}`;

    newState.discardPile.push(card);
    newState.log.push(`${card.name} on ${creatureName} (Player ${playerIndex + 1}) was fully rotated and discarded.`);

    newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
      playerId: player.id,
      creatureId: player.field[slotIndex].creatureId,
      knowledgeCard: card
    });

    const targetPlayer = newState.players[playerIndex];
    if (targetPlayer && targetPlayer.field[slotIndex]) {
      targetPlayer.field[slotIndex].knowledge = null;
      console.log(`[executeKnowledgePhase] Set knowledge to null for Player ${playerIndex + 1}, Slot ${slotIndex}`);
    } else {
      console.error(`[executeKnowledgePhase] Error: Could not find player/slot to nullify knowledge for discard. PlayerIndex: ${playerIndex}, SlotIndex: ${slotIndex}`);
    }
  });

  newState = applyCombatDamage(newState, combatBuffers);

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
