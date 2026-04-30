// Removed unused imports: KnowledgeType, CreatureElement
import { GameState, Knowledge, PlayerState, KnowledgeEffectTrigger } from './types.js';
import { applyPassiveAbilities } from './passives.js'; // Import applyPassiveAbilities
import { buildHandChoices, buildKnowledgeChoices, buildMarketChoices, createPendingEffect, getEffectiveCreatureWisdom, updateCreatureWisdomFromRotation } from './utils.js';


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

  let defense = 0;
  let bypassDefense = false;

  targetPlayer.field.forEach((slot, slotIndex) => {
    const defendingKnowledge = slot.knowledge;
    if (!defendingKnowledge) return;
    const step = Math.floor(((defendingKnowledge.rotation ?? 0) % 360) / 90);
    const value = defendingKnowledge.valueCycle?.[step] ?? 0;
    if (value < 0) {
      defense += Math.abs(value);
      logs.push(`[Defense] ${targetPlayer.id} has +${Math.abs(value)} defense from ${defendingKnowledge.name}.`);
    }

    if (defendingKnowledge.id === 'aquatic2') {
      const opposingSlot = state.players[sourcePlayerIndex]?.field[slotIndex];
      if (!opposingSlot?.knowledge) {
        defense += 1;
        logs.push(`[Defense] ${targetPlayer.id} has +1 defense from ${defendingKnowledge.name} because the opposing slot is empty.`);
      }
    }
  });

  if (defense > 0 && targetPlayer.creatures.some(creature => creature.id === 'trempulcahue')) {
    defense += 1;
    logs.push(`[Defense] Trempulcahue grants +1 additional defense to ${targetPlayer.id}.`);
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
    let newState = structuredClone(state); // Use cloneDeep
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
  terrestrial2: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    trigger: KnowledgeEffectTrigger;
  }) => { // Added fieldSlotIndex and rotation
    let newState = structuredClone(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let combinedLog: string[] = [];

    if (trigger === 'onSummon') {
      const choices = buildHandChoices(newState, opponentIndex as 0 | 1);
      if (choices.length === 0) {
        newState.log.push(`[Apparition] ${knowledge.name}: opponent has no cards to discard.`);
        return newState;
      }
      return createPendingEffect(newState, {
        type: 'chooseOpponentHandDiscard',
        playerId: newState.players[playerIndex].id,
        sourcePlayerId: newState.players[playerIndex].id,
        sourceKnowledgeId: knowledge.id,
        sourceKnowledgeName: knowledge.name,
        prompt: `${knowledge.name}: choose one opponent hand card to discard.`,
        choices,
      });
    }

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
    let newState = structuredClone(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const creatureId = newState.players[playerIndex].field[fieldSlotIndex]?.creatureId;
    const wisdom = creatureId ? getEffectiveCreatureWisdom(newState, playerIndex, creatureId) : 0;

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
    let newState = structuredClone(state); // Use cloneDeep
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
    let newState = structuredClone(state); // Use cloneDeep
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
      const choices = buildKnowledgeChoices(newState, opponentIndex as 0 | 1);
      if (choices.length === 0) {
        combinedLog.push(`[Final] ${knowledge.name}: no opponent Knowledge cards to discard.`);
      } else {
        newState = createPendingEffect(newState, {
          type: 'chooseOpponentKnowledgeDiscard',
          playerId: newState.players[playerIndex].id,
          sourcePlayerId: newState.players[playerIndex].id,
          sourceKnowledgeId: knowledge.id,
          sourceKnowledgeName: knowledge.name,
          prompt: `${knowledge.name}: choose one opponent Knowledge to discard.`,
          choices,
        });
      }
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

  // Aquatic 1: Rotates one of your Knowledge cards immediately
  aquatic1: ({ state, playerIndex, fieldSlotIndex, knowledge, trigger: _trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    trigger: KnowledgeEffectTrigger;
  }) => {
    let newState = structuredClone(state); // Use cloneDeep
    const rotatable = buildKnowledgeChoices(newState, playerIndex as 0 | 1, (candidate, _creatureId, idx) => {
      if (idx === fieldSlotIndex) return false;
      const maxRotationDegrees = (candidate.maxRotations ?? 4) * 90;
      return (candidate.rotation ?? 0) < maxRotationDegrees;
    });

    if (rotatable.length === 0) {
      newState.log.push(`[Effect] ${knowledge.name}: No other knowledge cards to rotate.`); // Added [Effect] prefix
      return newState; // Return the clone
    }

    return createPendingEffect(newState, {
      type: 'chooseKnowledgeToRotate',
      playerId: newState.players[playerIndex].id,
      sourcePlayerId: newState.players[playerIndex].id,
      sourceKnowledgeId: knowledge.id,
      sourceKnowledgeName: knowledge.name,
      prompt: `${knowledge.name}: choose one of your Knowledge cards to rotate.`,
      choices: rotatable,
    });
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
    let newState = structuredClone(state); // Use cloneDeep
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
    let newState = structuredClone(state); // Use cloneDeep
    newState.log.push(
      isFinalRotation
        ? `Hurricane leaves play after this rotation; opposing slot ${fieldSlotIndex} will no longer be blocked.`
        : `Hurricane blocks summons on the opposing slot ${fieldSlotIndex} while it remains in play.`
    );
    return newState;
  },

  // Aquatic 4: Apparition - Draw 1 card from Market + Rotational Damage/Defense
  aquatic4: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    trigger: KnowledgeEffectTrigger;
  }) => { // Added fieldSlotIndex, rotation
    let newState = structuredClone(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let combinedLog: string[] = [];

    if (trigger === 'onSummon') {
      const choices = buildMarketChoices(newState);
      if (choices.length === 0) {
        newState.log.push(`[Apparition] ${knowledge.name}: Market is empty.`);
        return newState;
      }
      return createPendingEffect(newState, {
        type: 'chooseMarketDraw',
        playerId: newState.players[playerIndex].id,
        sourcePlayerId: newState.players[playerIndex].id,
        sourceKnowledgeId: knowledge.id,
        sourceKnowledgeName: knowledge.name,
        prompt: `${knowledge.name}: choose one Market card to draw.`,
        choices,
      });
    }

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
    let newState = structuredClone(state); // Use cloneDeep
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
    } else if (baseValue < 0) { // Negative value = Defense potential
      combinedLog.push(`${knowledge.name} provides ${-baseValue} potential defense this rotation (${rotation}º).`);
      // Actual defense is applied by calculateDamage when this card is targeted
    } else {
      combinedLog.push(`${knowledge.name} causes no damage or defense this rotation (${rotation}º).`);
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
  aerial1: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, trigger }: {
    state: GameState;
    playerIndex: number;
    fieldSlotIndex: number;
    knowledge: Knowledge;
    rotation: number;
    trigger: KnowledgeEffectTrigger;
  }) => { // Added rotation
    let newState = structuredClone(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let combinedLog: string[] = [];

    if (trigger === 'onSummon') {
      newState.players[playerIndex].power += 1;
      newState.log.push(`[Apparition] ${knowledge.name} grants +1 Power to ${newState.players[playerIndex].id}.`);
      return newState;
    }

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
    let newState = structuredClone(state); // Use cloneDeep
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
    let newState = structuredClone(state); // Use cloneDeep
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

    combinedLog.push(
      isFinalRotation
        ? `[Final] ${knowledge.name}: Wisdom aura ends as the card leaves play.`
        : `[Effect] ${knowledge.name}: Wisdom aura is active while this card remains in play.`
    );

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
    let newState = structuredClone(state); // Use cloneDeep
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
    let newState = structuredClone(state); // Use cloneDeep
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = newState.players[opponentIndex];
    let rotatedCount = 0;
    opponent.creatures = opponent.creatures.map((creature: import('./types.js').Creature) => {
      const currentRotation = creature.rotation ?? 0;
      if (currentRotation > 0) {
        rotatedCount++;
        const newRotation = Math.max(0, currentRotation - 90);
        return updateCreatureWisdomFromRotation({ ...creature, rotation: newRotation });
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
