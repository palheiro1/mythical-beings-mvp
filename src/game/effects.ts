/* eslint-disable @typescript-eslint/no-unused-vars */
// Removed unused imports: KnowledgeType, CreatureElement
import { GameState, Knowledge, PlayerState, KnowledgeEffectTrigger } from './types.js';
import { applyPassiveAbilities } from './passives.js'; // Import applyPassiveAbilities
import { cloneDeep } from 'lodash'; // Import cloneDeep

// Helper function to calculate damage, considering defense and passives
// Returns final damage amount and logs to be added.
export function calculateDamage(
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
  const sourceCreature = sourcePlayer?.creatures.find((c: import('./types.js').Creature) => c.id === sourceCreatureId);
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
  trigger: KnowledgeEffectTrigger;
}) => GameState;

// Effect function map
export const knowledgeEffects: Record<string, KnowledgeEffectFn> = {
  // Terrestrial 1: Damage based on rotation, +1 if opponent's creature has no knowledge
  terrestrial1: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    trigger: KnowledgeEffectTrigger;
  }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;

    // Calculate damage from valueCycle
    const cycleIndex = rotation / 90;
    const baseValue = knowledge.valueCycle?.[cycleIndex] ?? 0;
    let baseDamage = baseValue > 0 ? baseValue : 0; // Use positive values from cycle as base damage

    // Bonus damage if opponent slot is empty
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
        // Add specific log for Ursus damage dealt
        newState.log.push(`[Effect] ${knowledge.name} deals ${finalDamage} damage to ${newState.players[opponentIndex].id} (Base: ${baseDamage}, Bonus: ${bonusDamage}).`);
      }
    } else {
      newState.log.push(`[Effect] ${knowledge.name} causes no damage this rotation (${rotation}º).`);
    }
    return newState; // Return the modified clone
  },

  // Terrestrial 2: Look at opponent's hand and discard 1 card + Rotational Damage
  terrestrial2: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    trigger: KnowledgeEffectTrigger;
  }) => { // Added fieldSlotIndex and rotation
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let combinedLog: string[] = [];

    // --- Damage Calculation (from valueCycle) ---
    // This part seems okay, assuming valueCycle is defined for terrestrial2 if needed
    const cycleIndex = rotation / 90;
    const baseValue = knowledge.valueCycle?.[cycleIndex] ?? 0;
    const baseDamage = baseValue > 0 ? baseValue : 0;

    if (baseDamage > 0) {
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, baseDamage, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs); // Add damage calculation logs immediately
      if (finalDamage > 0 && newState.players[opponentIndex]) {
        newState.players[opponentIndex].power -= finalDamage;
        combinedLog.push(`${knowledge.name} deals ${finalDamage} damage (Rotation: ${rotation}º).`);
      }
    } else {
      // Only log no damage if there was no damage value in the cycle
      if (!knowledge.valueCycle || knowledge.valueCycle.length === 0) {
         combinedLog.push(`${knowledge.name} has no rotational damage effect.`);
      } else {
         combinedLog.push(`${knowledge.name} causes no damage this rotation (${rotation}º).`);
      }
    }

    // --- Discard Logic (Always Active) ---
    // Removed the `if (rotation === 0)` condition
    const opponentHand = newState.players[opponentIndex].hand;
    let discardLog = `[Effect] ${knowledge.name}`; // Simplified log prefix
    if (opponentHand.length === 0) {
      // Match the test expectation
      discardLog = `${knowledge.name}: Opponent has no cards to discard.`;
    } else {
      const [discarded, ...rest] = opponentHand;
      // Match the test expectation
      discardLog = `${knowledge.name} forces opponent to discard ${discarded.name}.`;
      const newPlayers = [...newState.players];
      newPlayers[opponentIndex] = {
        ...newPlayers[opponentIndex],
        hand: rest,
      };
      const newDiscardPile = [...newState.discardPile, discarded];
      newState.players = newPlayers as [PlayerState, PlayerState];
      newState.discardPile = newDiscardPile;
    }
    combinedLog.push(discardLog);


    return {
      ...newState,
      log: [...newState.log, ...combinedLog], // Combine damage and discard logs
    };
  },

  // Terrestrial 3: Damage equal to summoning creature's wisdom
  terrestrial3: ({ state, playerIndex, fieldSlotIndex, knowledge, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    trigger: KnowledgeEffectTrigger;
  }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const creatureId = newState.players[playerIndex].field[fieldSlotIndex]?.creatureId;
    const creature = newState.players[playerIndex].creatures.find((c: import('./types.js').Creature) => c.id === creatureId);
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
  terrestrial4: ({ state, playerIndex, knowledge, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    knowledge: Knowledge;
    trigger: KnowledgeEffectTrigger;
  }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentId = newState.players[opponentIndex].id;
    const eliminatedNames: string[] = [];

    const updatedField = newState.players[opponentIndex].field.map((slot: { creatureId: string; knowledge: Knowledge | null }) => {
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

        // Add to discard pile
        newState.discardPile.push(leavingKnowledge);

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

  // Terrestrial 5: Final - Discard one opponent knowledge + Rotational Damage
  terrestrial5: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, isFinalRotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    isFinalRotation: boolean;
    trigger: KnowledgeEffectTrigger;
  }) => { // Added fieldSlotIndex, rotation, isFinalRotation
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let combinedLog: string[] = [];

    // --- Damage Calculation (from valueCycle) ---
    const cycleIndex = rotation / 90;
    const baseValue = knowledge.valueCycle?.[cycleIndex] ?? 0;
    const baseDamage = baseValue > 0 ? baseValue : 0;

    if (baseDamage > 0) {
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, baseDamage, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs); // Add damage calculation logs immediately
      if (finalDamage > 0 && newState.players[opponentIndex]) {
        newState.players[opponentIndex].power -= finalDamage;
        combinedLog.push(`${knowledge.name} deals ${finalDamage} damage (Rotation: ${rotation}º).`);
      }
    } else {
      combinedLog.push(`${knowledge.name} causes no damage this rotation (${rotation}º).`);
    }

    // --- Discard Logic (Final Rotation Only) ---
    if (isFinalRotation) {
      const opponentField = newState.players[opponentIndex].field;
      const knowledgesOnField = opponentField
        .map((slot: { creatureId: string; knowledge: Knowledge | null }, idx: number) => ({ slot, idx }))
        .filter(({ slot }: { slot: { creatureId: string; knowledge: Knowledge | null } }) => slot.knowledge);

      let discardLog = `[Final] ${knowledge.name} attempts to discard opponent knowledge.`;
      if (knowledgesOnField.length === 0) {
        discardLog += ' No knowledge cards to discard.';
      } else {
        const { slot, idx } = knowledgesOnField[0]; // MVP: Auto-pick first
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
        discardLog += ` Discarded ${discardedKnowledge.name}${logSuffix}`;
        newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
          playerId: newState.players[opponentIndex].id,
          creatureId: opponentField[idx].creatureId,
          knowledgeCard: discardedKnowledge,
        });
      }
      combinedLog.push(discardLog);
    }

    // --- Extra Action Logic (Final Rotation Only) ---
    if (isFinalRotation) {
      const newExtraActions: { 0: number; 1: number } = {
        0: newState.extraActionsNextTurn?.[0] ?? 0,
        1: newState.extraActionsNextTurn?.[1] ?? 0,
      };
      newExtraActions[playerIndex as 0 | 1] = (newExtraActions[playerIndex as 0 | 1] || 0) + 1;
      newState.extraActionsNextTurn = newExtraActions; // Apply to newState
      combinedLog.push(`[Final] ${knowledge.name} grants 1 extra action for Player ${playerIndex + 1} next turn.`);
    }

    return {
      ...newState,
      log: [...newState.log, ...combinedLog], // Combine logs
    };
  },

  // Aquatic 1: Rotates one of your Knowledge cards immediately (MVP: auto-pick first)
  aquatic1: ({ state, playerIndex, fieldSlotIndex, knowledge, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    trigger: KnowledgeEffectTrigger;
  }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const playerField = newState.players[playerIndex].field;
    const rotatable = playerField
      .map((slot: { creatureId: string; knowledge: Knowledge | null }, idx: number) => ({ slot, idx }))
      .filter(({ slot, idx }: { slot: { creatureId: string; knowledge: Knowledge | null }; idx: number }) => {
        if (!slot.knowledge || idx === fieldSlotIndex) return false;
        // Use maxRotations from the specific knowledge card, default to 4 if undefined
        const maxRotations = slot.knowledge.maxRotations ?? 4;
        const maxRotationDegrees = maxRotations * 90;
        // Check if current rotation is less than the max possible degrees
        return (slot.knowledge.rotation ?? 0) < maxRotationDegrees;
      });

    if (rotatable.length === 0) {
      newState.log.push(`[Effect] ${knowledge.name}: No other knowledge cards to rotate.`); // Added [Effect] prefix
      return newState; // Return the clone
    }

    // MVP: Auto-pick the first rotatable card found
    const { slot, idx } = rotatable[0];
    const k = slot.knowledge!; // Operate on knowledge within the cloned state
    const currentRotation = k.rotation ?? 0;
    const newRotation = currentRotation + 90;
    k.rotation = newRotation; // Rotate the knowledge in the clone

    // Add log message for successful rotation
    newState.log.push(`[Effect] ${knowledge.name} rotates ${k.name} (Slot ${idx}). New rotation: ${newRotation}º.`);

    // TODO: Decide if rotating a card should trigger its own rotational effect immediately.
    // Currently, it does not.

    return newState; // Return the modified clone
  },

  // Aquatic 2: Gain +1 defense when defending if the opposing Creature has no Knowledge cards (Passive in calculateDamage) + Rotational Damage
  aquatic2: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    trigger: KnowledgeEffectTrigger;
  }) => { // Added params
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;

    // --- Damage Calculation (from valueCycle) ---
    const cycleIndex = rotation / 90;
    const baseValue = knowledge.valueCycle?.[cycleIndex] ?? 0;
    const baseDamage = baseValue > 0 ? baseValue : 0; // Only apply damage if value is positive

    if (baseDamage > 0) {
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, baseDamage, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs); // Add damage calculation logs immediately
      if (finalDamage > 0 && newState.players[opponentIndex]) {
        newState.players[opponentIndex].power -= finalDamage;
        newState.log.push(`[Effect] ${knowledge.name} deals ${finalDamage} damage (Rotation: ${rotation}º).`); // Add specific log
      }
    } else {
      // Log if no damage this turn, but don't overwrite defense logs from calculateDamage
      newState.log.push(`[Effect] ${knowledge.name} causes no damage this rotation (${rotation}º). Defense handled passively.`);
    }

    // Passive defense is handled in calculateDamage, no action needed here for that.
    return newState;
  },

  // Aquatic 3: Prevent opponent from summoning knowledge onto the opposing creature (persistent block)
  aquatic3: ({ state, playerIndex, fieldSlotIndex, isFinalRotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    isFinalRotation: boolean;
    trigger: KnowledgeEffectTrigger;
  }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    if (!newState.blockedSlots) newState.blockedSlots = { 0: [], 1: [] };
    if (!isFinalRotation) {
      if (!newState.blockedSlots[opponentIndex].includes(fieldSlotIndex)) {
        newState.blockedSlots[opponentIndex] = [...newState.blockedSlots[opponentIndex], fieldSlotIndex];
        newState.log.push(`Aquatic3: Opponent cannot summon knowledge onto the opposing creature (slot ${fieldSlotIndex}) while this card is in play.`);
      }
    } else {
      newState.blockedSlots[opponentIndex] = newState.blockedSlots[opponentIndex].filter(idx => idx !== fieldSlotIndex);
      newState.log.push(`Aquatic3: Block on opponent's slot ${fieldSlotIndex} removed (aquatic3 left play).`);
    }
    return newState;
  },

  // Aquatic 4: Apparition - Draw 1 card from Market + Rotational Damage/Defense
  aquatic4: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    trigger: KnowledgeEffectTrigger;
  }) => { // Added fieldSlotIndex, rotation
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let combinedLog: string[] = [];

    // --- Damage/Defense Calculation (from valueCycle) ---
    const cycleIndex = rotation / 90;
    const baseValue = knowledge.valueCycle?.[cycleIndex] ?? 0;

    if (baseValue > 0) { // Positive value = Damage
      const baseDamage = baseValue;
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, baseDamage, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs); // Add damage calculation logs immediately
      if (finalDamage > 0 && newState.players[opponentIndex]) {
        newState.players[opponentIndex].power -= finalDamage;
        combinedLog.push(`${knowledge.name} deals ${finalDamage} damage (Rotation: ${rotation}º).`);
      }
    } else if (baseValue < 0) { // Negative value = Defense (handled by calculateDamage, just log here)
        combinedLog.push(`${knowledge.name} provides ${-baseValue} potential defense this rotation (${rotation}º).`);
        // Actual defense application happens in calculateDamage if this card is the target
    } else {
        combinedLog.push(`${knowledge.name} causes no damage or defense this rotation (${rotation}º).`);
    }

    // --- Draw Logic (Apparition - only if not already drawn) ---
    if (rotation === 0 && newState.market.length > 0 && !newState.players[playerIndex].hand.some(card => card.id === newState.market[0].id)) {
      let drawLog = `[Apparition] ${knowledge.name} attempts to draw from market.`;
      const drawnCard = newState.market.shift();
      if (drawnCard) {
        newState.players[playerIndex].hand.push(drawnCard);
        drawLog += ` Drew ${drawnCard.name}.`;
        // Refill market from deck
        if (newState.knowledgeDeck && newState.knowledgeDeck.length > 0) {
          const refillCard = newState.knowledgeDeck.shift();
          if (refillCard) newState.market.push(refillCard);
        }
      }
      combinedLog.push(drawLog);
    } else if (rotation === 0 && newState.market.length === 0) {
      combinedLog.push(`[Apparition] ${knowledge.name} attempts to draw from market. Market is empty, no card drawn.`);
    }

    return {
      ...newState,
      log: [...newState.log, ...combinedLog], // Combine logs
    };
  },

  // Aquatic 5: Final - Win 1 extra Action next turn + Rotational Damage/Defense
  aquatic5: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, isFinalRotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    isFinalRotation: boolean;
    trigger: KnowledgeEffectTrigger;
  }) => { // Added fieldSlotIndex, knowledge, rotation
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let combinedLog: string[] = [];

    // --- Damage/Defense Calculation (from valueCycle) ---
    const cycleIndex = rotation / 90;
    const baseValue = knowledge.valueCycle?.[cycleIndex] ?? 0;

    if (baseValue > 0) { // Positive value = Damage
      const baseDamage = baseValue;
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, baseDamage, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs); // Add damage calculation logs immediately
    }

    // --- Extra Action Logic (Final Rotation Only) ---
    if (isFinalRotation) {
      const newExtraActions: { 0: number; 1: number } = {
        0: newState.extraActionsNextTurn?.[0] ?? 0,
        1: newState.extraActionsNextTurn?.[1] ?? 0,
      };
      newExtraActions[playerIndex as 0 | 1] = (newExtraActions[playerIndex as 0 | 1] || 0) + 1;
      newState.extraActionsNextTurn = newExtraActions; // Apply to newState
      combinedLog.push(`[Final] ${knowledge.name} grants 1 extra action for Player ${playerIndex + 1} next turn.`);
    }

    return {
      ...newState,
      log: [...newState.log, ...combinedLog], // Combine logs
    };
  },

  // Aerial 1: Apparition - Gain +1 Power (on summon only) + Rotational Damage
  aerial1: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    trigger: KnowledgeEffectTrigger;
  }) => { // Added rotation
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let combinedLog: string[] = [];

    // --- Damage Calculation (from valueCycle) ---
    const cycleIndex = rotation / 90;
    const baseValue = knowledge.valueCycle?.[cycleIndex] ?? 0;
    const baseDamage = baseValue > 0 ? baseValue : 0;

    if (baseDamage > 0) {
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, baseDamage, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs); // Add damage calculation logs immediately
      if (finalDamage > 0 && newState.players[opponentIndex]) {
        newState.players[opponentIndex].power -= finalDamage;
        combinedLog.push(`${knowledge.name} deals ${finalDamage} damage (Rotation: ${rotation}º).`);
      }
    } else {
      combinedLog.push(`${knowledge.name} causes no damage this rotation (${rotation}º).`);
    }

    // Note: The +1 Power on summon (Apparition) is not handled here, likely needs a passive or direct reducer logic.
    combinedLog.push(`[Note] ${knowledge.name} Apparition power gain handled elsewhere.`);

    return {
      ...newState,
      log: [...newState.log, ...combinedLog], // Combine logs
    };
  },

  // Aerial 2: +1 Power (1st rotation), +2 Power (2nd), +3 Power (3rd), no 4th rotation
  aerial2: ({ state, playerIndex, fieldSlotIndex: _fieldSlotIndex, rotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    rotation: number;
    trigger: KnowledgeEffectTrigger;
  }) => {
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

  // Aerial 3: While in play, adds +1 to the Wisdom of all your Creatures + Rotational Damage
  aerial3: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, isFinalRotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    isFinalRotation: boolean;
    trigger: KnowledgeEffectTrigger;
  }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let combinedLog: string[] = [];

    // --- Damage Calculation (from valueCycle) ---
    const cycleIndex = rotation / 90;
    const baseValue = knowledge.valueCycle?.[cycleIndex] ?? 0;
    const baseDamage = baseValue > 0 ? baseValue : 0;

    if (baseDamage > 0) {
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, baseDamage, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs); // Add damage calculation logs immediately
      if (finalDamage > 0 && newState.players[opponentIndex]) {
        newState.players[opponentIndex].power -= finalDamage;
        combinedLog.push(`${knowledge.name} deals ${finalDamage} damage (Rotation: ${rotation}º).`);
      }
    } else {
      combinedLog.push(`${knowledge.name} causes no damage this rotation (${rotation}º).`);
    }

    // --- Wisdom Buff Logic ---
    // Note: This buff applies/removes based on presence, not rotation directly.
    // The application/removal might be better handled by passives on KNOWLEDGE_ENTER/KNOWLEDGE_LEAVE.
    // Keeping it here for now, but it triggers every knowledge phase while active.
    if (!isFinalRotation) {
      const player = newState.players[playerIndex];
      // Check if buff already applied to avoid stacking (simple check, might need refinement)
      const needsBuff = player.creatures.some((c: import('./types.js').Creature) => c.currentWisdom === c.baseWisdom);
      if (needsBuff) {
          player.creatures = player.creatures.map((creature: import('./types.js').Creature) => ({
            ...creature,
            // Ensure currentWisdom exists before incrementing
            currentWisdom: (typeof creature.currentWisdom === 'number' ? creature.currentWisdom : creature.baseWisdom) + 1,
          }));
          combinedLog.push(`[Effect] ${knowledge.name}: While in play, all your creatures gain +1 Wisdom.`);
      } else {
          combinedLog.push(`[Effect] ${knowledge.name}: Wisdom buff already active.`);
      }
    } else {
      // On final rotation, remove the buff (assuming it was applied)
      const player = newState.players[playerIndex];
      player.creatures = player.creatures.map((creature: import('./types.js').Creature) => ({
        ...creature,
        // Revert to base wisdom if buff was active
        currentWisdom: (typeof creature.currentWisdom === 'number' && creature.currentWisdom > creature.baseWisdom) ? creature.currentWisdom - 1 : creature.baseWisdom,
      }));
      combinedLog.push(`[Final] ${knowledge.name}: Wisdom buff removed.`);
    }

    return {
      ...newState,
      log: [...newState.log, ...combinedLog], // Combine logs
    };
  },

  // Aerial 4: Rotational damage & self-power equal to damage dealt
  aerial4: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    trigger: KnowledgeEffectTrigger;
  }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let combinedLog: string[] = []; // Use combinedLog for clarity

    // --- Damage Calculation (from valueCycle) ---
    const cycleIndex = rotation / 90;
    const baseValue = knowledge.valueCycle?.[cycleIndex] ?? 0;
    const baseDamage = baseValue > 0 ? baseValue : 0; // Use positive values from cycle as base damage

    // Apply damage to opponent first
    let finalDamageDealt = 0;
    if (baseDamage > 0) {
      const { finalDamage, logs } = calculateDamage(newState, opponentIndex, baseDamage, playerIndex, knowledge, fieldSlotIndex);
      newState.log.push(...logs); // Add damage calculation logs immediately
      if (finalDamage > 0 && newState.players[opponentIndex]) {
        newState.players[opponentIndex].power -= finalDamage;
        finalDamageDealt = finalDamage; // Store the actual damage dealt
        // Log for damage dealt is handled by calculateDamage
      }
    }

    // Then apply power gain to self, equal to the final damage dealt
    if (finalDamageDealt > 0) {
      if(newState.players[playerIndex]) {
         newState.players[playerIndex].power += finalDamageDealt;
         combinedLog.push(`[Effect] ${knowledge.name} grants ${finalDamageDealt} power to ${newState.players[playerIndex].id} (equal to damage dealt).`);
      } else {
         console.error(`[Aerial4 Effect] Player index ${playerIndex} not found.`);
         combinedLog.push(`[Error] ${knowledge.name} could not grant power - player ${playerIndex} not found.`);
      }
    }

    if (baseDamage === 0) {
       combinedLog.push(`[Effect] ${knowledge.name} causes no damage or power gain this rotation (${rotation}º).`);
    }

    return {
      ...newState,
      log: [...newState.log, ...combinedLog], // Combine logs
    };
  },

  // Aerial 5: All opponent creatures rotate 90º counterclockwise (reduce wisdom)
  aerial5: ({ state, playerIndex, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    trigger: KnowledgeEffectTrigger;
  }) => {
    let newState = cloneDeep(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = newState.players[opponentIndex];
    let rotatedCount = 0;
    opponent.creatures = opponent.creatures.map((creature: import('./types.js').Creature) => {
      const currentRotation = creature.rotation ?? 0;
      if (currentRotation > 0) {
        rotatedCount++;
        const newRotation = Math.max(0, currentRotation - 90);
        return { ...creature, rotation: newRotation };
      }
      return creature;
    });
    newState.log.push(`Aerial5: Rotated ${rotatedCount} of opponent's creatures 90º counterclockwise (they lose wisdom).`);
    return newState;
  },
};

// New helper function to apply generic effects defined on knowledge cards
export function applyKnowledgeEffect(
  _state: GameState,
  _effect: KnowledgeEffectFn,
  _sourcePlayerId: string,
  _knowledgeName: string
): GameState {
  console.warn(`[Effect Application] applyKnowledgeEffect is likely deprecated. Effects should be handled by specific functions in knowledgeEffects.`);
  return _state;
}
