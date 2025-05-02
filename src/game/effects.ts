/* eslint-disable @typescript-eslint/no-unused-vars */
// Removed unused imports: KnowledgeType, CreatureElement
import { GameState, Knowledge } from './types';
import { applyPassiveAbilities } from './passives.js'; // Import applyPassiveAbilities

// Effect function signature
export type KnowledgeEffectFn = (params: {
  state: GameState;
  playerIndex: number;
  fieldSlotIndex: number;
  knowledge: Knowledge;
  rotation: number; // Keep rotation as it's used by many effects
  isFinalRotation: boolean;
}) => GameState;

// Effect function map
export const knowledgeEffects: Record<string, KnowledgeEffectFn> = {
  // Terrestrial 1: Damage based on rotation, +1 if opponent's creature has no knowledge
  terrestrial1: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation }) => {
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
    const [discarded, ...rest] = opponentHand;
    logMsg += `Discarded: ${discarded.name}.`;
    const newPlayers = [...state.players];
    newPlayers[opponentIndex] = {
      ...newPlayers[opponentIndex],
      hand: rest,
    };
    const newDiscardPile = [...state.discardPile, discarded];

    return {
      ...state,
      players: newPlayers as [typeof state.players[0], typeof state.players[1]],
      discardPile: newDiscardPile,
      log: [...state.log, `${knowledge.name}: Discarded ${discarded.name} from opponent's hand. ${logMsg}`],
    };
  },

  // Terrestrial 3: Damage equal to summoning creature's wisdom
  terrestrial3: ({ state, playerIndex, fieldSlotIndex, knowledge }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const creatureId = state.players[playerIndex].field[fieldSlotIndex].creatureId;
    const creature = state.players[playerIndex].creatures.find(c => c.id === creatureId);
    const wisdom = creature?.currentWisdom ?? creature?.baseWisdom ?? 0;
    if (wisdom > 0) {
      state.log.push(`${knowledge.name} deals ${wisdom} damage to Player ${opponentIndex + 1}.`);
    }
    return state;
  },

  // Terrestrial 4: Eliminate opponent's knowledge cards
  terrestrial4: ({ state, playerIndex, knowledge }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentId = state.players[opponentIndex].id;
    let newState = JSON.parse(JSON.stringify(state)) as GameState;
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
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let newState = JSON.parse(JSON.stringify(state)) as GameState;
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
    let modifiedState = state;
    const playerField = modifiedState.players[playerIndex].field;
    const rotatable = playerField
      .map((slot, idx) => ({ slot, idx }))
      .filter(({ slot, idx }) => {
        if (!slot.knowledge || idx === fieldSlotIndex) return false;
        const maxRotationDegrees = (slot.knowledge.maxRotations || 4) * 90;
        return (slot.knowledge.rotation ?? 0) < maxRotationDegrees;
      });

    if (rotatable.length === 0) {
      modifiedState.log.push(`${knowledge.name}: No other knowledge cards to rotate.`);
      return modifiedState;
    }

    const { slot, idx } = rotatable[0];
    const k = slot.knowledge!;
    const currentRotation = k.rotation ?? 0;
    const newRotation = currentRotation + 90;
    k.rotation = newRotation;
    const maxRotationDegreesTarget = (k.maxRotations || 4) * 90;

    modifiedState.log.push(`${knowledge.name}: Rotated ${k.name} to ${newRotation}º and triggered its effect immediately. [TODO: Let user choose which knowledge to rotate if multiple are available]`);

    const effectFn = knowledgeEffects[k.id];
    if (effectFn) {
      modifiedState = effectFn({
        state: modifiedState,
        playerIndex,
        fieldSlotIndex: idx,
        knowledge: k,
        rotation: newRotation,
        isFinalRotation: newRotation >= maxRotationDegreesTarget,
      });
    }

    return modifiedState;
  },

  // Aquatic 2: Gain +1 defense when defending if the opposing Creature has no Knowledge cards
  aquatic2: ({ state, playerIndex, fieldSlotIndex }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponentFieldSlot = state.players[opponentIndex].field[fieldSlotIndex];
    if (opponentFieldSlot && opponentFieldSlot.knowledge) {
      state.log.push(`Aquatic2: No defense granted (opposing creature has knowledge).`);
    } else {
      state.log.push(`Aquatic2: Provides +1 defense to Player ${playerIndex + 1} (opposing creature has no knowledge).`);
    }
    return state;
  },

  // Aquatic 3: Prevent opponent from summoning knowledge onto the opposing creature (persistent block)
  aquatic3: ({ state, playerIndex, fieldSlotIndex, isFinalRotation }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let newState = { ...state } as GameState & { blockedSlots?: Record<number, number[]> };
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

  // Aquatic 4: Apparition - Draw 1 card from the Market with no cost (MVP: auto-pick first, log TODO)
  aquatic4: ({ state, playerIndex, knowledge }) => {
    let newState = JSON.parse(JSON.stringify(state)) as GameState;
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

  // Aquatic 5: Final - Win 1 extra Action
  aquatic5: ({ state, playerIndex, isFinalRotation }) => {
    let newState = { ...state };
    if (isFinalRotation) {
      if (!('extraActionsNextTurn' in newState)) {
        (newState as any).extraActionsNextTurn = { 0: 0, 1: 0 };
      }
      const currentExtra = (newState as any).extraActionsNextTurn[playerIndex] || 0;
      (newState as any).extraActionsNextTurn[playerIndex] = currentExtra + 1;
      newState.log.push(`Aquatic5: Grants 1 extra action for next turn.`);
    }
    return newState;
  },

  // Aerial 1: Apparition - Gain +1 Power (on summon only) + Deals 1 damage
  aerial1: ({ state, playerIndex }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const damage = 1;
    state.log.push(`Aerial1 deals ${damage} damage to Player ${opponentIndex + 1}.`);
    return state;
  },

  // Aerial 2: +1 Power (1st rotation), +2 Power (2nd), +3 Power (3rd), no 4th rotation
  aerial2: ({ state, playerIndex, rotation }) => {
    let powerGain = 0;
    if (rotation === 0) powerGain = 1;
    else if (rotation === 90) powerGain = 2;
    else if (rotation === 180) powerGain = 3;
    if (powerGain > 0) {
      state.players[playerIndex].power += powerGain;
      state.log.push(`Aerial2: Rotation ${rotation}º - Player ${playerIndex + 1} gains +${powerGain} Power.`);
    }
    return state;
  },

  // Aerial 3: While in play, adds +1 to the Wisdom of all your Creatures
  aerial3: ({ state, playerIndex, isFinalRotation }) => {
    if (!isFinalRotation) {
      const player = state.players[playerIndex];
      player.creatures = player.creatures.map(creature => ({
        ...creature,
        currentWisdom: (typeof creature.currentWisdom === 'number' ? creature.currentWisdom : creature.baseWisdom) + 1,
      }));
      state.log.push(`Aerial3: While in play, all your creatures gain +1 Wisdom.`);
    }
    return state;
  },

  // Aerial 4: Rotational damage & self-power
  aerial4: ({ state, playerIndex, rotation }) => {
    const dmg = (rotation === 0 ? 1 : (rotation === 90 || rotation === 180 ? 2 : 0));
    state.players[playerIndex].power += dmg;
    state.log.push(`Aerial4: Deals ${dmg} damage & grants ${dmg} power.`);
    return state;
  },

  // Aerial 5: All opponent creatures rotate 90º clockwise (lose wisdom)
  aerial5: ({ state, playerIndex }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const opponent = state.players[opponentIndex];
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
    state.log.push(`Aerial5: Rotated ${rotatedCount} of opponent's creatures 90º clockwise (they lose wisdom).`);
    return state;
  },
};

// New helper function to apply generic effects defined on knowledge cards
export function applyKnowledgeEffect(state: GameState, effect: KnowledgeEffect, sourcePlayerId: string, knowledgeName: string): GameState {
  let newState = { ...state }; // Clone state to avoid direct mutation issues
  newState.players = newState.players.map(p => ({ ...p })) as [PlayerState, PlayerState]; // Deep clone players array

  const sourcePlayerIndex = newState.players.findIndex(p => p.id === sourcePlayerId);
  const opponentPlayerIndex = 1 - sourcePlayerIndex;

  console.log(`[Effect Application] Applying effect for ${knowledgeName}:`, effect);

  switch (effect.type) {
    case 'DAMAGE':
      const amount = effect.amount || 0;
      if (amount <= 0) break;

      const applyDamage = (targetIndex: number) => {
        if (newState.players[targetIndex]) {
          // TODO: Incorporate defense logic here if applicable
          newState.players[targetIndex].power -= amount;
          newState.log = [...newState.log, `[Effect] ${knowledgeName} deals ${amount} damage to ${newState.players[targetIndex].id}.`];
          console.log(`[Effect Application] Applied ${amount} damage to ${newState.players[targetIndex].id}. New power: ${newState.players[targetIndex].power}`);
        }
      };

      if (effect.target === 'BOTH') {
        applyDamage(sourcePlayerIndex);
        applyDamage(opponentPlayerIndex);
      } else {
        const targetPlayerIndex = effect.target === 'OPPONENT' ? opponentPlayerIndex : (effect.target === 'SELF' ? sourcePlayerIndex : -1);
        if (targetPlayerIndex !== -1) {
          applyDamage(targetPlayerIndex);
        }
      }
      break;

    // TODO: Implement other effect types (HEAL, DRAW, DISCARD, etc.) as needed
    // case 'HEAL': ...
    // case 'DRAW': ...

    default:
      console.warn(`[Effect Application] Unhandled effect type in applyKnowledgeEffect: ${effect.type}`);
  }
  return newState;
}
