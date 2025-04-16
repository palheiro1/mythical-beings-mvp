import { GameState, Knowledge } from './types';

// Effect function signature
export type KnowledgeEffectFn = (params: {
  state: GameState;
  playerIndex: number;
  fieldSlotIndex: number;
  knowledge: Knowledge;
  rotation: number;
  isFinalRotation: boolean;
}) => GameState;

// Effect function map
export const knowledgeEffects: Record<string, KnowledgeEffectFn> = {
  // Terrestrial 1: Damage based on rotation, +1 if opponent's creature has no knowledge
  terrestrial1: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, isFinalRotation }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let damage = 0;
    let logMsg = `[Terrestrial1] Rotation: ${rotation}º. `;
    if (rotation === 0) damage = 1;
    else if (rotation === 90) damage = 0;
    else if (rotation === 180) damage = 2;
    logMsg += `Base damage: ${damage}. `;
    // Check if opponent's creature (same slot) has no knowledge
    const opponentFieldSlot = state.players[opponentIndex].field[fieldSlotIndex];
    if (!opponentFieldSlot.knowledge) {
      damage += 1;
      logMsg += `Opponent's creature has no knowledge: +1 damage. `;
    }
    logMsg += `Total damage: ${damage}.`;
    if (damage > 0) {
      const newPlayers = [...state.players];
      newPlayers[opponentIndex] = {
        ...newPlayers[opponentIndex],
        power: Math.max(0, newPlayers[opponentIndex].power - damage),
      };
      return {
        ...state,
        players: newPlayers as [typeof state.players[0], typeof state.players[1]],
        log: [...state.log, `${knowledge.name} deals ${damage} damage to Player ${opponentIndex + 1}. ${logMsg}`],
      };
    }
    return { ...state, log: [...state.log, `${knowledge.name} causes no damage. ${logMsg}`] };
  },

  // Terrestrial 2: Look at opponent's hand and discard 1 card (auto-discard random for now)
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
  terrestrial3: ({ state, playerIndex, fieldSlotIndex, knowledge }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const player = state.players[playerIndex];
    const creatureId = player.field[fieldSlotIndex].creatureId;
    const creature = player.creatures.find(c => c.id === creatureId);
    // Wisdom by rotation using wisdomCycle
    let wisdom = 0;
    if (creature) {
      const rotation = creature.rotation ?? 0;
      if (Array.isArray(creature.wisdomCycle)) {
        const idx = Math.floor((rotation % 360) / 90);
        wisdom = creature.wisdomCycle[idx] ?? 0;
      } else {
        wisdom = creature.baseWisdom ?? 0;
      }
    }
    let logMsg = `[Terrestrial3] Creature: ${creature?.name || 'unknown'}, Wisdom: ${wisdom}.`;
    if (wisdom > 0) {
      const newPlayers = [...state.players];
      newPlayers[opponentIndex] = {
        ...newPlayers[opponentIndex],
        power: Math.max(0, newPlayers[opponentIndex].power - wisdom),
      };
      return {
        ...state,
        players: newPlayers as [typeof state.players[0], typeof state.players[1]],
        log: [...state.log, `${knowledge.name} deals ${wisdom} damage to Player ${opponentIndex + 1}. ${logMsg}`],
      };
    }
    return { ...state, log: [...state.log, `${knowledge.name} causes no damage. ${logMsg}`] };
  },

  // Terrestrial 4: Eliminate opponent's knowledge cards with cost <= 2
  terrestrial4: ({ state, playerIndex, knowledge }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const newOpponentField = state.players[opponentIndex].field.map(slot => {
      if (slot.knowledge && slot.knowledge.cost <= 2) {
        return { ...slot, knowledge: null };
      }
      return slot;
    });
    const eliminated = state.players[opponentIndex].field.filter(slot => slot.knowledge && slot.knowledge.cost <= 2).map(slot => slot.knowledge?.name).filter(Boolean);
    let logMsg = `[Terrestrial4] Eliminated: ${eliminated.join(', ') || 'none'}.`;
    const newPlayers = [...state.players];
    newPlayers[opponentIndex] = {
      ...newPlayers[opponentIndex],
      field: newOpponentField,
    };
    return {
      ...state,
      players: newPlayers as [typeof state.players[0], typeof state.players[1]],
      log: [...state.log, `${knowledge.name} eliminates opponent's knowledge cards: ${eliminated.join(', ') || 'none'}. ${logMsg}`],
    };
  },

  // Terrestrial 5: Damage per rotation, on leave effect (handled in rules.ts)
  terrestrial5: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, isFinalRotation }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let damage = 0;
    if (rotation === 0) damage = 1;
    else if (rotation === 90) damage = 1;
    else if (rotation === 180) damage = 2;
    else if (rotation === 270) damage = 3;
    let newState = state;
    if (damage > 0) {
      const newPlayers = [...state.players];
      newPlayers[opponentIndex] = {
        ...newPlayers[opponentIndex],
        power: Math.max(0, newPlayers[opponentIndex].power - damage),
      };
      newState = {
        ...state,
        players: newPlayers as [typeof state.players[0], typeof state.players[1]],
        log: [...state.log, `${knowledge.name} deals ${damage} damage to Player ${opponentIndex + 1}`],
      };
    }
    // The on-leave effect (eliminate 1 opponent knowledge) should be handled in rules.ts when the card is discarded
    return newState;
  },

  // Aquatic 1: Rotates 1 Knowledge 90º counterclockwise (MVP: just log, real: needs user selection)
  aquatic1: ({ state, playerIndex, fieldSlotIndex, knowledge }) => {
    let logMsg = `[Aquatic1] Rotates a selected knowledge 90º counterclockwise.`;
    return { ...state, log: [...state.log, `${knowledge.name}: ${logMsg}`] };
  },

  // Aquatic 2: While rotating, provides defense or deals damage depending on rotation
  aquatic2: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation }) => {
    let logMsg = `[Aquatic2] Rotation: ${rotation}º. `;
    let newState = state;
    let effect = '';
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let defense = 0;
    if (rotation === 0 || rotation === 270) {
      effect = '+1 defense';
      defense = 1;
      logMsg += 'Provides 1 defense this turn.';
    } else if (rotation === 90 || rotation === 180) {
      effect = '1 damage';
      newState.players[opponentIndex].power = Math.max(0, newState.players[opponentIndex].power - 1);
      logMsg += 'Deals 1 damage.';
    }
    // Bonus defense if opponent's creature has no knowledge
    const opponentFieldSlot = state.players[opponentIndex].field[fieldSlotIndex];
    if ((rotation === 0 || rotation === 270) && !opponentFieldSlot.knowledge) {
      defense += 1;
      logMsg += ' Opponent has no knowledge: +1 defense.';
    }
    if (defense > 0) {
      effect += ` (+${defense} defense)`;
    }
    newState = {
      ...newState,
      log: [...newState.log, `${knowledge.name}: ${effect}. ${logMsg}`],
    };
    return newState;
  },

  // Aquatic 3: While in play, the opposite creature cannot summon knowledge
  aquatic3: ({ state, playerIndex, fieldSlotIndex, knowledge }) => {
    // For MVP, just log. For real, add a flag to state or check in validation.
    let logMsg = `[Aquatic3] While in play, the opposite creature cannot summon knowledge.`;
    return { ...state, log: [...state.log, `${knowledge.name}: ${logMsg}`] };
  },

  // Aquatic 4: Rotation: depending on the rotation deals damage or provides defense
  aquatic4: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation }) => {
    let logMsg = `[Aquatic4] Rotation: ${rotation}º. `;
    let newState = state;
    let effect = '';
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let damage = 0;
    if (rotation === 0) {
      effect = '1 damage';
      newState.players[opponentIndex].power = Math.max(0, newState.players[opponentIndex].power - 1);
      logMsg += 'Deals 1 damage.';
    } else if (rotation === 90) {
      effect = '+2 defense';
      logMsg += 'Provides 2 defense this turn.';
    } else if (rotation === 180) {
      effect = '1 damage';
      newState.players[opponentIndex].power = Math.max(0, newState.players[opponentIndex].power - 1);
      logMsg += 'Deals 1 damage.';
    } else if (rotation === 270) {
      effect = '2 damage';
      newState.players[opponentIndex].power = Math.max(0, newState.players[opponentIndex].power - 2);
      logMsg += 'Deals 2 damage.';
    }
    newState = {
      ...newState,
      log: [...newState.log, `${knowledge.name}: ${effect}. ${logMsg}`],
    };
    // On summon: handled in rules.ts (draw 1 card from market)
    return newState;
  },

  // Aquatic 5: Rotation: depending on the rotation deals damage or provides defense
  aquatic5: ({ state, playerIndex, fieldSlotIndex, knowledge, rotation, isFinalRotation }) => {
    let logMsg = `[Aquatic5] Rotation: ${rotation}º. `;
    let newState = state;
    let effect = '';
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    if (rotation === 0 || rotation === 180) {
      effect = '+2 defense';
      logMsg += 'Provides 2 defense this turn.';
      // For MVP, just log. For real defense, add a defense flag to the player/creature.
    } else if (rotation === 90 || rotation === 270) {
      effect = '2 damage';
      const newPlayers = [...state.players];
      newPlayers[opponentIndex] = {
        ...newPlayers[opponentIndex],
        power: Math.max(0, newPlayers[opponentIndex].power - 2),
      };
      newState = {
        ...state,
        players: newPlayers as [typeof state.players[0], typeof state.players[1]],
      };
      logMsg += 'Deals 2 damage to opponent.';
    }
    newState = {
      ...newState,
      log: [...newState.log, `${knowledge.name}: ${effect}. ${logMsg}`],
    };
    // On leave: handled in rules.ts (grant +1 action)
    return newState;
  },

  // Aerial 1: 1,1 damage; on summon, +1 power
  aerial1: ({ state, playerIndex, knowledge, rotation }) => {
    let logMsg = `[Aerial1] Rotation: ${rotation}º. `;
    let newState = state;
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let damage = 0;
    if (rotation === 0 || rotation === 90) { damage = 1; }
    if (damage > 0) {
      newState.players[opponentIndex].power = Math.max(0, newState.players[opponentIndex].power - damage);
      logMsg += `Deals ${damage} damage.`;
    }
    // On summon: handled in rules.ts (+1 power)
    newState = {
      ...newState,
      log: [...newState.log, `${knowledge.name}: ${logMsg}`],
    };
    return newState;
  },

  // Aerial 2: Provides power points to player: 1,2,3
  aerial2: ({ state, playerIndex, knowledge, rotation }) => {
    let logMsg = `[Aerial2] Rotation: ${rotation}º. `;
    let newState = state;
    let power = 0;
    if (rotation === 0) { power = 1; }
    else if (rotation === 90) { power = 2; }
    else if (rotation === 180) { power = 3; }
    if (power > 0) {
      newState.players[playerIndex].power += power;
      logMsg += `Gains ${power} power.`;
    }
    newState = {
      ...newState,
      log: [...newState.log, `${knowledge.name}: ${logMsg}`],
    };
    return newState;
  },

  // Aerial 3: 1,1,2 damage; while in play, +1 wisdom to all 3 creatures
  aerial3: ({ state, playerIndex, knowledge, rotation }) => {
    let logMsg = `[Aerial3] Rotation: ${rotation}º. `;
    let newState = state;
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let damage = 0;
    if (rotation === 0 || rotation === 90) { damage = 1; }
    else if (rotation === 180) { damage = 2; }
    if (damage > 0) {
      newState.players[opponentIndex].power = Math.max(0, newState.players[opponentIndex].power - damage);
      logMsg += `Deals ${damage} damage.`;
    }
    logMsg += ' While in play, +1 wisdom to all 3 creatures.';
    // For MVP, just log. For real, add wisdom bonus in state.
    newState = {
      ...newState,
      log: [...newState.log, `${knowledge.name}: ${logMsg}`],
    };
    return newState;
  },

  // Aerial 4: Rotation: depending on the rotation deals damage or provides defense
  aerial4: ({ state, playerIndex, knowledge, rotation }) => {
    let logMsg = `[Aerial4] Rotation: ${rotation}º. `;
    let newState = state;
    let effect = '';
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let damage = 0;
    if (rotation === 0) { damage = 1; }
    else if (rotation === 90 || rotation === 180) { damage = 2; }
    if (damage > 0) {
      newState.players[opponentIndex].power = Math.max(0, newState.players[opponentIndex].power - damage);
      newState.players[playerIndex].power += damage;
      effect = `${damage} damage, +${damage} power to player`;
      logMsg += `Deals ${damage} damage and gives ${damage} power to player.`;
    }
    newState = {
      ...newState,
      log: [...newState.log, `${knowledge.name}: ${effect}. ${logMsg}`],
    };
    return newState;
  },

  // Aerial 5: All opponent creatures rotate 90º clockwise (MVP: just log, real: update rotation)
  aerial5: ({ state, playerIndex, knowledge }) => {
    let logMsg = `[Aerial5] All opponent creatures rotate 90º clockwise.`;
    return { ...state, log: [...state.log, `${knowledge.name}: ${logMsg}`] };
  },
};
