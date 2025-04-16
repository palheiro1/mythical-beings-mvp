/* eslint-disable @typescript-eslint/no-unused-vars */
import { GameState, Knowledge, CombatBuffers } from './types';

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
    const opponentFieldSlot = state.players[opponentIndex].field[fieldSlotIndex];
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

  // Terrestrial 5: Damage per rotation
  terrestrial5: ({ state, playerIndex, knowledge, rotation, buffers }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const damage = [1,1,2,3][(rotation/90)%4] || 0;
    if (damage > 0) buffers.damage[opponentIndex] += damage;
    state.log.push(`${knowledge.name} deals ${damage} damage to Player ${opponentIndex + 1}.`);
    return state;
  },

  // Aquatic 1: Rotates knowledge (no combat)
  aquatic1: ({ state, knowledge }) => {
    state.log.push(`${knowledge.name}: Rotates a knowledge.`);
    return state;
  },

  // Aquatic 3: Prevent opponent summon (no combat)
  aquatic3: ({ state, knowledge }) => {
    state.log.push(`${knowledge.name}: Opponent cannot summon knowledge.`);
    return state;
  },

  // Aquatic 4: Rotational damage/defense
  aquatic4: ({ state, playerIndex, knowledge, rotation, buffers }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    let dmg=0, def=0;
    if (rotation===0) dmg=1;
    else if (rotation===90) def=2;
    else if (rotation===180) dmg=1;
    else if (rotation===270) dmg=2;
    if (dmg) buffers.damage[opponentIndex]+=dmg;
    if (def) buffers.defense[playerIndex]+=def;
    state.log.push(`${knowledge.name}: deals ${dmg} dmg, +${def} def.`);
    return state;
  },

  // Aquatic 5: Rotational damage/defense
  aquatic5: ({ state, knowledge, rotation, buffers }) => {
    const opponentIndex = 0; // placeholder if needed
    const isDamage = rotation === 90 || rotation === 270;
    if (isDamage) buffers.damage[opponentIndex] += 2;
    else buffers.defense[0] += 2;
    state.log.push(`${knowledge.name}: ${isDamage ? 'Deals 2 damage' : 'Provides 2 defense'}.`);
    return state;
  },

  // Aerial 1: Rotational damage
  aerial1: ({ state, playerIndex, knowledge, rotation, buffers }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const dmg = (rotation===0||rotation===90)?1:0;
    if (dmg) buffers.damage[opponentIndex]+=dmg;
    state.log.push(`${knowledge.name}: Deals ${dmg} damage.`);
    return state;
  },

  // Aerial 3: Rotational damage
  aerial3: ({ state, playerIndex, knowledge, rotation, buffers }) => {
    const opponentIndex = playerIndex === 0 ? 1 : 0;
    const dmg = (rotation===0||rotation===90)?1:(rotation===180?2:0);
    if (dmg) buffers.damage[opponentIndex]+=dmg;
    state.log.push(`${knowledge.name}: Deals ${dmg} damage.`);
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

  // Aerial 5: All opponent creatures rotate 90º clockwise (MVP: just log, real: update rotation)
  aerial5: ({ state, knowledge, rotation, buffers }) => {
    const opponentIndex = 0; // placeholder if needed
    const isDamage = rotation === 90 || rotation === 270;
    if (isDamage) buffers.damage[opponentIndex] += 2;
    else buffers.defense[0] += 2;
    state.log.push(`${knowledge.name}: ${isDamage ? 'Deals 2 damage' : 'Provides 2 defense'}.`);
    return state;
  },
};
