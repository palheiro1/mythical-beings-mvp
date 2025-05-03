/* eslint-disable @typescript-eslint/no-unused-vars */
// Removed unused imports: KnowledgeType, CreatureElement
import { GameState, Knowledge, PlayerState } from './types';
import { applyPassiveAbilities } from './passives.js'; // Import applyPassiveAbilities
import { cloneDeep } from 'lodash'; // Import cloneDeep

// Helper function to calculate damage, considering defense and passives
// Returns final damage amount and logs to be added.
function calculateDamage(
  state: GameState, // Read-only state
  targetPlayerIndex: number,
  damageAmount: number,
  sourcePlayerIndex: number,
  sourceKnowledge: Knowledge,
  sourceFieldSlotIndex: number
): { finalDamage: number; logs: string[] } {
  const logs: string[] = [];
  if (damageAmount <= 0) {
    return { finalDamage: 0, logs };
  }

  const sourcePlayer = state.players[sourcePlayerIndex];
  const targetPlayer = state.players[targetPlayerIndex];
  if (!targetPlayer) {
    console.error(`[calculateDamage] Target player at index ${targetPlayerIndex} not found.`);
    return { finalDamage: 0, logs };
  }
  const sourceCreatureId = sourcePlayer?.field[sourceFieldSlotIndex]?.creatureId;
  const sourceCreature = sourcePlayer?.creatures.find(c => c.id === sourceCreatureId);
  const targetFieldSlot = targetPlayer.field[sourceFieldSlotIndex];

  let defense = 0;
  let defenseSource = '';
  let bypassDefense = false;

  // Check if target has defense (e.g., from aquatic2 - Asteroid)
  if (targetFieldSlot?.knowledge?.id === 'aquatic2') {
    const opponentOfDefenderIndex = targetPlayerIndex === 0 ? 1 : 0;
    const opponentOfDefenderSlot = state.players[opponentOfDefenderIndex]?.field[sourceFieldSlotIndex];

    if (!opponentOfDefenderSlot?.knowledge) {
      defense = 1; // Assuming aquatic2 grants 1 defense
      defenseSource = 'Aquatic2 (Asteroid)';
      logs.push(`[Defense] ${targetPlayer.id} has +1 defense from ${defenseSource} because opposing slot ${sourceFieldSlotIndex} is empty.`);
    } else {
      defenseSource = 'Aquatic2 (Asteroid)';
      logs.push(`[Defense] ${targetPlayer.id} has ${defenseSource}, but opposing slot ${sourceFieldSlotIndex} has knowledge. No defense bonus.`);
    }
  }

  // Check if attacker has Zhar-Ptitsa and knowledge is aerial
  if (sourceCreature?.id === 'zhar-ptitsa' && sourceKnowledge.element === 'air') {
    if (defense > 0) {
      bypassDefense = true;
      logs.push(`[Passive Effect] Zhar-Ptitsa (Owner: ${sourcePlayer.id}) bypasses defense for aerial knowledge ${sourceKnowledge.name}.`);
    }
  }

  const finalDamage = bypassDefense ? damageAmount : Math.max(0, damageAmount - defense);

  if (finalDamage > 0) {
    let logMsg = `[Effect] ${sourceKnowledge.name} deals ${finalDamage} damage to ${targetPlayer.id}. (Base: ${damageAmount}`;
    if (defense > 0) {
      logMsg += `, Defense: ${defense}`;
      if (bypassDefense) logMsg += ' - Bypassed';
    }
    logMsg += ')';
    logs.push(logMsg);
    console.log(`[Damage Calculation] Calculated ${finalDamage} damage for ${targetPlayer.id}.`);
  } else {
    logs.push(`[Effect] ${sourceKnowledge.name} deals 0 damage to ${targetPlayer.id} (Base: ${damageAmount}, Defense: ${defense}).`);
  }

  return { finalDamage, logs };
}

// Effect function signature
export type KnowledgeEffectFn = (params: {
  state: GameState;
  playerIndex: number;
  fieldSlotIndex: number;
  knowledge: Knowledge;
  // *** IMPORTANT: This rotation value should be the rotation *before* the knowledge phase increment ***
  rotation: number;
  isFinalRotation: boolean;
}) => GameState;

// Effect function map
export const knowledgeEffects: Record<string, KnowledgeEffectFn> = {
  // Terrestrial 1: Damage based on rotation, +1 if opponent's creature has no knowledge
  terrestrial1: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;

    let baseDamage = 0;
    // Use the rotation value passed into the function
    if (rotation === 0) baseDamage = 1;
    else if (rotation === 180) baseDamage = 2;

    let bonusDamage = 0;
    const opponentFieldSlot = newState.players[opponentIndex].field[fieldSlotIndex];
    if (!opponentFieldSlot?.knowledge && baseDamage > 0) {
      bonusDamage = 1;
    }

    const totalDamage = baseDamage + bonusDamage;

    if (totalDamage > 0) {
      // Pass the cloned state (newState) to calculateDamage (it's read-only)
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, totalDamage, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs);
      // Apply damage to the cloned state
      if (finalDamage > 0 && newState.players[opponentIndex]) {
        newState.players[opponentIndex].power -= finalDamage;
      }
    } else {
      newState.log.push(`${knowledge.name} causes no damage this rotation (${rotation}º).`);
    }
    return newState; // Return the modified clone
  },

  // Terrestrial 2: Look at opponent's hand and discard 1 card
  terrestrial2: ({ state, playerIndex, knowledge }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentHand = newState.players[opponentIndex].hand;
    let logMsg = `[Terrestrial2] Opponent hand size: ${opponentHand.length}. `;
    if (opponentHand.length === 0) {
      logMsg += 'No cards to discard.';
      return {
        ...newState,
        log: [...newState.log, `${knowledge.name}: Opponent has no cards to discard. ${logMsg}`],
      };
    }
    const [discarded, ...rest] = opponentHand;
    logMsg += `Discarded: ${discarded.name}.`;
    const newPlayers = [...newState.players];
    newPlayers[opponentIndex] = {
      ...newPlayers[opponentIndex],
      hand: rest,
    };
    const newDiscardPile = [...newState.discardPile, discarded];

    return {
      ...newState,
      players: newPlayers as [typeof newState.players[0], typeof newState.players[1]],
      discardPile: newDiscardPile,
      log: [...newState.log, `${knowledge.name}: Discarded ${discarded.name} from opponent's hand. ${logMsg}`],
    };
  },

  // Terrestrial 3: Damage equal to summoning creature's wisdom
  terrestrial3: ({ state, playerIndex, fieldSlotIndex, knowledge }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const creatureId = newState.players[playerIndex].field[fieldSlotIndex]?.creatureId;
    const creature = newState.players[playerIndex].creatures.find(c => c.id === creatureId);
    const wisdom = creature?.currentWisdom ?? creature?.baseWisdom ?? 0;

    if (wisdom > 0) {
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, wisdom, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs);
      if (finalDamage > 0 && newState.players[opponentIndex]) {
        newState.players[opponentIndex].power -= finalDamage;
      }
    } else {
      newState.log.push(`${knowledge.name} causes no damage as creature wisdom is 0.`);
    }
    return newState;
  },

  // Terrestrial 4: Eliminate opponent's knowledge cards
  terrestrial4: ({ state, playerIndex, knowledge }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentId = newState.players[opponentIndex].id;
    const eliminatedNames: string[] = [];

    const updatedField = newState.players[opponentIndex].field.map(slot => {
      if (slot.knowledge && slot.knowledge.cost <= 2) {
        const leavingKnowledge: Knowledge = {
          ...slot.knowledge,
          type: slot.knowledge.type ?? 'spell',
          element: slot.knowledge.element ?? 'neutral',
          cost: slot.knowledge.cost ?? 0,
          effect: slot.knowledge.effect ?? '',
          maxRotations: slot.knowledge.maxRotations ?? 4,
          id: slot.knowledge.id ?? 'unknown',
          name: slot.knowledge.name ?? 'Unknown Knowledge',
          instanceId: slot.knowledge.instanceId ?? 'unknown-instance',
          rotation: slot.knowledge.rotation ?? 0,
        };
        eliminatedNames.push(leavingKnowledge.name);

        newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
          playerId: opponentId,
          knowledgeCard: leavingKnowledge,
          creatureId: slot.creatureId,
        });

        return { ...slot, knowledge: null };
      }
      return slot;
    });

    let logMsg = `[Terrestrial4] Eliminated: ${eliminatedNames.join(', ') || 'none'}.`;

    const finalPlayers = [...newState.players];
    finalPlayers[opponentIndex] = {
      ...finalPlayers[opponentIndex],
      field: updatedField,
    };

    return {
      ...newState,
      players: finalPlayers as [typeof newState.players[0], typeof newState.players[1]],
      log: [...newState.log, `${knowledge.name} eliminates opponent's knowledge cards: ${eliminatedNames.join(', ') || 'none'}. ${logMsg}`],
    };
  },

  // Terrestrial 5: Discard one opponent knowledge (MVP: auto-pick first, log TODO)
  terrestrial5: ({ state, playerIndex, knowledge }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentField = newState.players[opponentIndex].field;
    const knowledgesOnField = opponentField
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot }) => slot.knowledge);
    if (knowledgesOnField.length === 0) {
      newState.log.push(`${knowledge.name}: Opponent has no knowledge cards to discard.`);
      return newState;
    } else {
      const { slot, idx } = knowledgesOnField[0];
      const discardedKnowledge: Knowledge = {
        ...slot.knowledge!,
        type: slot.knowledge!.type ?? 'spell',
        element: slot.knowledge!.element ?? 'neutral',
        cost: slot.knowledge!.cost ?? 0,
        effect: slot.knowledge!.effect ?? '',
        maxRotations: slot.knowledge!.maxRotations ?? 4,
        id: slot.knowledge!.id ?? 'unknown',
        name: slot.knowledge!.name ?? 'Unknown Knowledge',
        instanceId: slot.knowledge!.instanceId ?? 'unknown-instance',
        rotation: slot.knowledge!.rotation ?? 0,
      };
      opponentField[idx].knowledge = null;
      newState.discardPile.push(discardedKnowledge);
      const logSuffix = knowledgesOnField.length > 1 ? ". [TODO: Let user choose which knowledge to discard if multiple are valid]" : ".";
      newState.log.push(`${knowledge.name}: Discarded opponent's knowledge ${discardedKnowledge.name}${logSuffix}`);
      newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
        playerId: newState.players[opponentIndex].id,
        creatureId: opponentField[idx].creatureId,
        knowledgeCard: discardedKnowledge,
      });
      return newState;
    }
  },

  // Aquatic 1: Rotates one of your Knowledge cards immediately (MVP: auto-pick first, log TODO)
  aquatic1: ({ state, playerIndex, fieldSlotIndex, knowledge }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const playerField = newState.players[playerIndex].field;
    const rotatable = playerField
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot, idx }) => {
        if (!slot.knowledge || idx === fieldSlotIndex) return false;
        const maxRotationDegrees = (slot.knowledge.maxRotations || 4) * 90;
        // Use rotation from the cloned state
        return (slot.knowledge.rotation ?? 0) < maxRotationDegrees;
      });

    if (rotatable.length === 0) {
      newState.log.push(`${knowledge.name}: No other knowledge cards to rotate.`);
      return newState; // Return the clone
    }

    const { slot, idx } = rotatable[0];
    const k = slot.knowledge!; // Operate on knowledge within the cloned state
    const currentRotation = k.rotation ?? 0;
    const newRotation = currentRotation + 90;
    k.rotation = newRotation; // Rotate the knowledge in the clone
    const maxRotationDegreesTarget = (k.maxRotations || 4) * 90;

    newState.log.push(`${knowledge.name}: Rotated ${k.name} to ${newRotation}º and triggered its effect immediately. [TODO: Let user choose which knowledge to rotate if multiple are available]`);

    const effectFn = knowledgeEffects[k.id];
    if (effectFn) {
      // Call the nested effect function, passing the *current* cloned state (newState)
      // The nested function will clone again if necessary
      newState = effectFn({
        state: newState, // Pass the current clone
        playerIndex,
        fieldSlotIndex: idx,
        knowledge: k, // Pass the rotated knowledge from the clone
        rotation: newRotation, // Pass the new rotation
        isFinalRotation: newRotation >= maxRotationDegreesTarget,
      });
    }

    return newState; // Return the final state after potential nested effect
  },

  // Aquatic 2: Gain +1 defense when defending if the opposing Creature has no Knowledge cards
  aquatic2: ({ state }) => {
    // Passive effect, no action needed here. Return original state (or clone if paranoia demands).
    return state;
  },

  // Aquatic 3: Prevent opponent from summoning knowledge onto the opposing creature (persistent block)
  aquatic3: ({ state, playerIndex, fieldSlotIndex, isFinalRotation }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    if (!newState.blockedSlots) newState.blockedSlots = { 0: [], 1: [] };
    if (!isFinalRotation) {
      if (!newState.blockedSlots[playerIndex].includes(fieldSlotIndex)) {
        newState.blockedSlots[playerIndex] = [...newState.blockedSlots[playerIndex], fieldSlotIndex];
        newState.log.push(`Aquatic3: Opponent cannot summon knowledge onto the opposing creature (slot ${fieldSlotIndex}) while this card is in play.`);
      }
    } else {
      newState.blockedSlots[playerIndex] = newState.blockedSlots[playerIndex].filter(idx => idx !== fieldSlotIndex);
      newState.log.push(`Aquatic3: Block on opponent's slot ${fieldSlotIndex} removed (aquatic3 left play).`);
    }
    return newState;
  },

  // Aquatic 4: Apparition - Draw 1 card from the Market with no cost (MVP: auto-pick first, log TODO)
  aquatic4: ({ state, playerIndex, knowledge }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    if (newState.market.length === 0) {
      newState.log.push(`${knowledge.name}: Market is empty, no card drawn.`);
      return newState;
    }
    const drawnCard = newState.market.shift();
    if (drawnCard) {
      newState.players[playerIndex].hand.push(drawnCard);
      newState.log.push(`${knowledge.name}: Drew ${drawnCard.name} from the market. [TODO: Let user choose which card to draw if multiple are available]`);
      if (newState.knowledgeDeck.length > 0) {
        const refillCard = newState.knowledgeDeck.shift();
        if (refillCard) newState.market.push(refillCard);
      }
    }
    return newState;
  },

  // Aquatic 5: Final - Win 1 extra Action next turn
  aquatic5: ({ state, playerIndex, isFinalRotation }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    if (isFinalRotation) {
      const newExtraActions = { ...newState.extraActionsNextTurn }; 
      newExtraActions[playerIndex] = (newExtraActions[playerIndex] || 0) + 1;
      
      return {
        ...newState,
        extraActionsNextTurn: newExtraActions,
        log: [...newState.log, `Aquatic5: Grants 1 extra action for Player ${playerIndex + 1} next turn.`]
      };
    }
    return newState; 
  },

  // Aerial 1: Apparition - Gain +1 Power (on summon only) + Deals 1 damage
  aerial1: ({ state, playerIndex, fieldSlotIndex, knowledge }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const damage = 1;
    const { finalDamage, logs } = calculateDamage(newState, opponentIndex, damage, playerIndex, knowledge, fieldSlotIndex);
    newState.log.push(...logs);
    if (finalDamage > 0 && newState.players[opponentIndex]) {
      newState.players[opponentIndex].power -= finalDamage;
    }
    // Note: The +1 Power on summon is not handled here, likely needs a passive or direct reducer logic.
    return newState;
  },

  // Aerial 2: +1 Power (1st rotation), +2 Power (2nd), +3 Power (3rd), no 4th rotation
  aerial2: ({ state, playerIndex, fieldSlotIndex, rotation }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    let powerGain = 0;
    // Use the rotation value passed into the function
    if (rotation === 0) powerGain = 1;
    else if (rotation === 90) powerGain = 2;
    else if (rotation === 180) powerGain = 3;
    if (powerGain > 0 && newState.players[playerIndex]) {
      newState.players[playerIndex].power += powerGain;
      newState.log.push(`Aerial2: Rotation ${rotation}º - Player ${playerIndex + 1} gains +${powerGain} Power.`);
    }
    return newState;
  },

  // Aerial 3: While in play, adds +1 to the Wisdom of all your Creatures
  aerial3: ({ state, playerIndex, isFinalRotation }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    if (!isFinalRotation) {
      const player = newState.players[playerIndex];
      player.creatures = player.creatures.map(creature => ({
        ...creature,
        currentWisdom: (typeof creature.currentWisdom === 'number' ? creature.currentWisdom : creature.baseWisdom) + 1,
      }));
      newState.log.push(`Aerial3: While in play, all your creatures gain +1 Wisdom.`);
    }
    return newState;
  },

  // Aerial 4: Rotational damage & self-power
  aerial4: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;

    // Use the rotation value passed into the function
    const dmg = (rotation === 0 ? 1 : (rotation === 90 || rotation === 180 ? 2 : 0));

    // Apply damage to opponent first
    if (dmg > 0) {
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, dmg, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs);
      if (finalDamage > 0 && newState.players[opponentIndex]) {
        newState.players[opponentIndex].power -= finalDamage;
      }
    }
    // Then apply power gain to self
    if (dmg > 0) {
      if(newState.players[playerIndex]) {
         newState.players[playerIndex].power += dmg;
         newState.log.push(`[Effect] ${knowledge.name} grants ${dmg} power to ${newState.players[playerIndex].id}.`);
      } else {
         console.error(`[Aerial4 Effect] Player index ${playerIndex} not found.`);
      }
    }
    if (dmg === 0) {
       newState.log.push(`[Effect] ${knowledge.name} causes no damage or power gain this rotation (${rotation}º).`);
    }
    return newState;
  },

  // Aerial 5: All opponent creatures rotate 90º clockwise (lose wisdom)
  aerial5: ({ state, playerIndex }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = newState.players[opponentIndex];
    let rotatedCount = 0;
    opponent.creatures = opponent.creatures.map(creature => {
      const currentRotation = creature.rotation ?? 0;
      if (currentRotation < 270) {
        rotatedCount++;
        const newRotation = currentRotation + 90;
        return { ...creature, rotation: newRotation };
      }
      return creature;
    });
    newState.log.push(`Aerial5: Rotated ${rotatedCount} of opponent's creatures 90º clockwise (they lose wisdom).`);
    return newState;
  },
};

// New helper function to apply generic effects defined on knowledge cards
export function applyKnowledgeEffect(state: GameState, effect: KnowledgeEffect, sourcePlayerId: string, knowledgeName: string): GameState {
  console.warn(`[Effect Application] applyKnowledgeEffect is likely deprecated. Effects should be handled by specific functions in knowledgeEffects.`);
  return state;
}
