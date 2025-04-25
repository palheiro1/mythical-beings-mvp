/* eslint-disable @typescript-eslint/no-unused-vars */
import { GameState, Knowledge, CombatBuffers } from './types';
import { applyPassiveAbilities } from './passives'; // Import applyPassiveAbilities

// Effect function signature
export type KnowledgeEffectFn = (params: {
  state: GameState;
  playerIndex: number;
  fieldSlotIndex: number;
  knowledge: Knowledge;
  rotation: number;
  isFinalRotation: boolean;
  buffers: CombatBuffers;
}) => GameState;

// Effect function map
export const knowledgeEffects: Record<string, KnowledgeEffectFn> = {
  // Terrestrial 1: Damage based on rotation, +1 if opponent's creature has no knowledge
  terrestrial1: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, buffers }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let damage = 0;
    let logMsg = `[Terrestrial1] Rotation: ${rotation}º. `;
    if (rotation === 0) damage = 1;
    else if (rotation === 90) damage = 0;
    else if (rotation === 180) damage = 2;
    logMsg += `Base damage: ${damage}. `;
    // Check if opponent's creature (same slot) has no knowledge
    const opponentFieldSlot = state.players[opponentIndex].field[fieldSlotIndex] || { knowledge: null };
    if (!opponentFieldSlot.knowledge) {
      damage += 1;
      logMsg += `Opponent's creature has no knowledge: +1 damage. `;
    }
    logMsg += `Total damage: ${damage}.`;
    if (damage > 0) {
      buffers.damage[opponentIndex] += damage;
      return { ...state, log: [...state.log, `${knowledge.name} deals ${damage} damage to Player ${opponentIndex + 1}. ${logMsg}`] };
    }
    return { ...state, log: [...state.log, `${knowledge.name} causes no damage. ${logMsg}`] };
  },

  // Terrestrial 2: Look at opponent's hand and discard 1 card
  terrestrial2: ({ state, playerIndex, knowledge }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentHand = state.players[opponentIndex].hand;
    let logMsg = `[Terrestrial2] Opponent hand size: ${opponentHand.length}. `;
    if (opponentHand.length === 0) {
      logMsg += 'No cards to discard.';
      return {
        ...state,
        log: [...state.log, `${knowledge.name}: Opponent has no cards to discard. ${logMsg}`],
      };
    }
    // For MVP: auto-discard the first card (replace with UI prompt for real game)
    const [discarded, ...rest] = opponentHand;
    logMsg += `Discarded: ${discarded.name}.`;
    const newPlayers = [...state.players];
    newPlayers[opponentIndex] = {
      ...newPlayers[opponentIndex],
      hand: rest,
    };
    return {
      ...state,
      players: newPlayers as [typeof state.players[0], typeof state.players[1]],
      log: [...state.log, `${knowledge.name}: Discarded ${discarded.name} from opponent's hand. ${logMsg}`],
    };
  },

  // Terrestrial 3: Damage equal to summoning creature's wisdom
  terrestrial3: ({ state, playerIndex, fieldSlotIndex, knowledge, buffers }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    // compute wisdom based on creature rotation
    const creatureId = state.players[playerIndex].field[fieldSlotIndex].creatureId;
    const creature = state.players[playerIndex].creatures.find(c => c.id === creatureId);
    const wisdom = creature?.currentWisdom ?? creature?.baseWisdom ?? 0;
    if (wisdom > 0) {
      buffers.damage[opponentIndex] += wisdom;
      state.log.push(`${knowledge.name} deals ${wisdom} damage to Player ${opponentIndex + 1}.`);
    }
    return state;
  },

  // Terrestrial 4: Eliminate opponent's knowledge cards
  terrestrial4: ({ state, playerIndex, knowledge }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentId = state.players[opponentIndex].id;
    let newState = JSON.parse(JSON.stringify(state)) as GameState; // Deep copy for mutation
    const eliminatedNames: string[] = [];

    const updatedField = newState.players[opponentIndex].field.map(slot => {
      if (slot.knowledge && slot.knowledge.cost <= 2) {
        const leavingKnowledge = { ...slot.knowledge }; // Copy before nulling
        eliminatedNames.push(leavingKnowledge.name);
        
        // Trigger KNOWLEDGE_LEAVE for the eliminated card
        newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
          playerId: opponentId, // The owner of the knowledge
          knowledgeCard: leavingKnowledge,
          creatureId: slot.creatureId
        });

        return { ...slot, knowledge: null }; // Remove the knowledge
      }
      return slot;
    });

    let logMsg = `[Terrestrial4] Eliminated: ${eliminatedNames.join(', ') || 'none'}.`;
    
    // Update the player state within the potentially modified newState
    const finalPlayers = [...newState.players];
    finalPlayers[opponentIndex] = {
      ...finalPlayers[opponentIndex],
      field: updatedField,
    };

    return {
      ...newState, // Return the state potentially modified by passives
      players: finalPlayers as [typeof newState.players[0], typeof newState.players[1]],
      log: [...newState.log, `${knowledge.name} eliminates opponent's knowledge cards: ${eliminatedNames.join(', ') || 'none'}. ${logMsg}`],
    };
  },

  // Terrestrial 5: Discard one opponent knowledge (MVP: auto-pick first, log TODO)
  terrestrial5: ({ state, playerIndex, knowledge, buffers }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let newState = JSON.parse(JSON.stringify(state)) as GameState;
    const opponentField = newState.players[opponentIndex].field;
    const knowledgesOnField = opponentField
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot }) => slot.knowledge);
    if (knowledgesOnField.length === 0) {
      newState.log.push(`${knowledge.name}: Opponent has no knowledge cards to discard.`);
      return newState;
    } else if (knowledgesOnField.length === 1) {
      const { slot, idx } = knowledgesOnField[0];
      const discardedKnowledge = { ...slot.knowledge };
      opponentField[idx].knowledge = null;
      newState.discardPile.push(discardedKnowledge);
      newState.log.push(`${knowledge.name}: Discarded opponent's knowledge ${discardedKnowledge.name}.`);
      // Trigger KNOWLEDGE_LEAVE for the discarded card
      newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
        playerId: newState.players[opponentIndex].id,
        creatureId: opponentField[idx].creatureId,
        knowledgeCard: discardedKnowledge
      });
      return newState;
    } else {
      // MVP: Discard the first one, log that user choice is TODO
      const { slot, idx } = knowledgesOnField[0];
      const discardedKnowledge = { ...slot.knowledge };
      opponentField[idx].knowledge = null;
      newState.discardPile.push(discardedKnowledge);
      newState.log.push(`${knowledge.name}: Discarded opponent's knowledge ${discardedKnowledge.name}. [TODO: Let user choose which knowledge to discard if multiple are valid]`);
      // Trigger KNOWLEDGE_LEAVE for the discarded card
      newState = applyPassiveAbilities(newState, 'KNOWLEDGE_LEAVE', {
        playerId: newState.players[opponentIndex].id,
        creatureId: opponentField[idx].creatureId,
        knowledgeCard: discardedKnowledge
      });
      return newState;
    }
  },

  // Aquatic 1: Rotates one of your Knowledge cards immediately (MVP: auto-pick first, log TODO)
  aquatic1: ({ state, playerIndex, fieldSlotIndex, knowledge, buffers }) => {
    let newState = JSON.parse(JSON.stringify(state)) as GameState;
    const playerField = newState.players[playerIndex].field;
    // Find all other knowledge cards that can be rotated (not fully rotated, not the aquatic1 itself)
    const rotatable = playerField
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot, idx }) => slot.knowledge && idx !== fieldSlotIndex && (slot.knowledge.rotation ?? 0) < 270);
    if (rotatable.length === 0) {
      newState.log.push(`${knowledge.name}: No other knowledge cards to rotate.`);
      return newState;
    } else if (rotatable.length === 1) {
      const { slot, idx } = rotatable[0];
      const k = slot.knowledge!;
      const newRotation = (k.rotation ?? 0) + 90;
      k.rotation = newRotation;
      newState.log.push(`${knowledge.name}: Rotated ${k.name} to ${newRotation}º and triggered its effect immediately.`);
      // Apply the effect for the new rotation
      const effectFn = knowledgeEffects[k.id];
      if (effectFn) {
        newState = effectFn({
          state: newState,
          playerIndex,
          fieldSlotIndex: idx,
          knowledge: k,
          rotation: newRotation,
          isFinalRotation: newRotation >= 270,
          buffers
        });
      }
      return newState;
    } else {
      // MVP: Rotate the first one, log that user choice is TODO
      const { slot, idx } = rotatable[0];
      const k = slot.knowledge!;
      const newRotation = (k.rotation ?? 0) + 90;
      k.rotation = newRotation;
      newState.log.push(`${knowledge.name}: Rotated ${k.name} to ${newRotation}º and triggered its effect immediately. [TODO: Let user choose which knowledge to rotate if multiple are available]`);
      // Apply the effect for the new rotation
      const effectFn = knowledgeEffects[k.id];
      if (effectFn) {
        newState = effectFn({
          state: newState,
          playerIndex,
          fieldSlotIndex: idx,
          knowledge: k,
          rotation: newRotation,
          isFinalRotation: newRotation >= 270,
          buffers
        });
      }
      return newState;
    }
  },

  // Aquatic 2: Gain +1 defense when defending if the opposing Creature has no Knowledge cards
  aquatic2: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, buffers }) => {
    // Only provide defense if the opposing creature (same slot) has no knowledge
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentFieldSlot = state.players[opponentIndex].field[fieldSlotIndex] || { knowledge: null };
    let defense = 0;
    if (!opponentFieldSlot.knowledge) {
      defense = 1;
      buffers.defense[playerIndex] += defense;
      state.log.push(`${knowledge.name}: Provides +1 defense to Player ${playerIndex + 1} (opposing creature has no knowledge).`);
    } else {
      state.log.push(`${knowledge.name}: No defense granted (opposing creature has knowledge).`);
    }
    return state;
  },

  // Aquatic 3: Prevent opponent from summoning knowledge onto the opposing creature (persistent block)
  aquatic3: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, isFinalRotation, buffers }) => {
    // We'll use a persistent block in state: state.blockedSlots[opponentIndex] = [slot indices]
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let newState = { ...state } as GameState & { blockedSlots?: Record<number, number[]> };
    if (!newState.blockedSlots) newState.blockedSlots = { 0: [], 1: [] };
    // On rotation (not final), set the block
    if (!isFinalRotation) {
      if (!newState.blockedSlots[opponentIndex].includes(fieldSlotIndex)) {
        newState.blockedSlots[opponentIndex] = [...newState.blockedSlots[opponentIndex], fieldSlotIndex];
        newState.log.push(`${knowledge.name}: Opponent cannot summon knowledge onto the opposing creature (slot ${fieldSlotIndex}) while this card is in play.`);
      }
    } else {
      // On final rotation/discard, remove the block
      newState.blockedSlots[opponentIndex] = newState.blockedSlots[opponentIndex].filter(idx => idx !== fieldSlotIndex);
      newState.log.push(`${knowledge.name}: Block on opponent's slot ${fieldSlotIndex} removed (aquatic3 left play).`);
    }
    return newState;
  },

  // Aquatic 4: Apparition - Draw 1 card from the Market with no cost (MVP: auto-pick first, log TODO)
  aquatic4: ({ state, playerIndex, knowledge, buffers }) => {
    let newState = JSON.parse(JSON.stringify(state)) as GameState;
    if (newState.market.length === 0) {
      newState.log.push(`${knowledge.name}: Market is empty, no card drawn.`);
      return newState;
    }
    // MVP: Draw the first card in the market
    const drawnCard = newState.market.shift();
    if (drawnCard) {
      newState.players[playerIndex].hand.push(drawnCard);
      newState.log.push(`${knowledge.name}: Drew ${drawnCard.name} from the market. [TODO: Let user choose which card to draw if multiple are available]`);
      // Refill market if possible
      if (newState.knowledgeDeck.length > 0) {
        const refillCard = newState.knowledgeDeck.shift();
        if (refillCard) newState.market.push(refillCard);
      }
    }
    return newState;
  },

  // Aquatic 5: Final - Win 1 extra Action (fully implemented: grants extra action for next turn, only logs on final rotation)
  aquatic5: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, isFinalRotation, buffers }) => {
    let newState = { ...state };
    if (isFinalRotation) {
      if (!('extraActionsNextTurn' in newState)) {
        (newState as any).extraActionsNextTurn = { 0: 0, 1: 0 };
      }
      (newState as any).extraActionsNextTurn[playerIndex] = ((newState as any).extraActionsNextTurn[playerIndex] || 0) + 1;
      newState.log.push(`${knowledge.name}: Grants 1 extra action for next turn.`);
    }
    return newState;
  },

  // Aerial 1: Apparition - Gain +1 Power (on summon only)
  aerial1: ({ state, playerIndex, knowledge, rotation, buffers }) => {
    if (rotation === 0) {
      // Apparition: on summon, grant +1 Power
      state.players[playerIndex].power += 1;
      state.log.push(`${knowledge.name}: Apparition effect - Player ${playerIndex + 1} gains +1 Power.`);
    } else {
      state.log.push(`${knowledge.name}: No effect (Apparition only triggers on summon).`);
    }
    return state;
  },

  // Aerial 2: +1 Power (1st rotation), +2 Power (2nd), +3 Power (3rd), no 4th rotation
  aerial2: ({ state, playerIndex, knowledge, rotation, buffers }) => {
    let powerGain = 0;
    if (rotation === 0) powerGain = 1;
    else if (rotation === 90) powerGain = 2;
    else if (rotation === 180) powerGain = 3;
    if (powerGain > 0) {
      state.players[playerIndex].power += powerGain;
      state.log.push(`${knowledge.name}: Rotation ${rotation}º - Player ${playerIndex + 1} gains +${powerGain} Power.`);
    }
    return state;
  },

  // Aerial 3: While in play, adds +1 to the Wisdom of all your Creatures
  aerial3: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, isFinalRotation, buffers }) => {
    // Only apply the wisdom bonus if not fully rotated
    if (!isFinalRotation) {
      const player = state.players[playerIndex];
      // Apply +1 wisdom to all creatures for this phase (does not persist, so wisdom resets each phase)
      player.creatures = player.creatures.map(creature => ({
        ...creature,
        currentWisdom: (typeof creature.currentWisdom === 'number' ? creature.currentWisdom : creature.baseWisdom) + 1,
      }));
      state.log.push(`${knowledge.name}: While in play, all your creatures gain +1 Wisdom.`);
    }
    return state;
  },

  // Aerial 4: Rotational damage & self-power
  aerial4: ({ state, playerIndex, knowledge, rotation, buffers }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const dmg = (rotation===0?1:(rotation===90||rotation===180?2:0));
    if (dmg) buffers.damage[opponentIndex]+=dmg;
    state.players[playerIndex].power+=dmg;
    state.log.push(`${knowledge.name}: Deals ${dmg} damage & grants ${dmg} power.`);
    return state;
  },

  // Aerial 5: All opponent creatures rotate 90º clockwise (lose wisdom)
  aerial5: ({ state, playerIndex, knowledge, rotation, buffers }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = state.players[opponentIndex];
    let rotatedCount = 0;
    opponent.creatures = opponent.creatures.map(creature => {
      const currentRotation = creature.rotation ?? 0;
      if (currentRotation < 270) {
        rotatedCount++;
        const newRotation = currentRotation + 90;
        // Wisdom will be recalculated elsewhere based on rotation
        return { ...creature, rotation: newRotation };
      }
      return creature;
    });
    state.log.push(`${knowledge.name}: Rotated ${rotatedCount} of opponent's creatures 90º clockwise (they lose wisdom).`);
    return state;
  },
};
