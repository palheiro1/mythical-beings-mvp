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
};
