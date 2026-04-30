import { GameState, PlayerState, Creature, Knowledge, PendingEffect, PendingEffectChoice } from './types';
// Import the JSON data
import creaturesData from '../assets/creatures.json';
import knowledgesData from '../assets/knowledges.json';

// Helper function to get the state for a specific player
export function getPlayerState(state: GameState, playerId: string): PlayerState | undefined {
    return state.players.find(p => p.id === playerId);
}

// Helper function to get the state for the opponent
export function getOpponentState(state: GameState, playerId: string): PlayerState | undefined {
    return state.players.find(p => p.id !== playerId);
}

// Helper function to find a specific creature in play for a player
export function findCreatureById(player: PlayerState, creatureId: string): Creature | undefined {
    return player.creatures.find(c => c.id === creatureId);
}

// Helper function to find a specific knowledge card by ID (from deck or market - assumes IDs are unique)
export function findKnowledgeById(state: GameState, knowledgeId: string): Knowledge | undefined {
    const card = state.market.find(k => k.id === knowledgeId);
    if (card) return card;
    return state.knowledgeDeck.find(k => k.id === knowledgeId);
    // Note: This doesn't check hands or field, adjust if needed
}

// NEW: Helper function to find base creature data by ID
export function findCreature(id: string): Creature | undefined {
    // Type assertion needed because the imported JSON might not perfectly match the Creature type initially
    return (creaturesData as Creature[]).find(c => c.id === id);
}

// NEW: Helper function to find base knowledge data by ID
export function findKnowledge(id: string): Knowledge | undefined {
    // Type assertion needed
    return (knowledgesData as Knowledge[]).find(k => k.id === id);
}

// Helper function to find a creature anywhere in the game state by its instance ID (if applicable) or base ID
// This might need refinement depending on how creatures are uniquely identified in play
export function findCreatureInPlay(state: GameState, creatureId: string): Creature | undefined {
    for (const player of state.players) {
        const creature = player.creatures.find(c => c.id === creatureId);
        if (creature) return creature;
    }
    return undefined;
}

// Helper function to find a knowledge card attached to a specific creature
export function getKnowledgeOnCreature(player: PlayerState, creatureId: string): Knowledge | null {
    const fieldSlot = player.field.find(slot => slot.creatureId === creatureId);
    return fieldSlot ? fieldSlot.knowledge : null;
}

// Helper to get wisdom by rotation
export function getCreatureWisdom(creature: Creature | undefined | null): number {
  if (!creature) return 0;
  const rotation = creature.rotation ?? 0;
  if (Array.isArray(creature.wisdomCycle)) {
    const idx = Math.min(3, Math.max(0, Math.floor((((rotation % 360) + 360) % 360) / 90)));
    return creature.wisdomCycle[idx] ?? creature.wisdomCycle[0] ?? creature.baseWisdom ?? 0;
  }
  // Fallback or default if wisdomCycle is not defined (shouldn't happen with current data)
  return creature.baseWisdom ?? 0;
}

export function normalizeCreature(creature: Creature): Creature {
  const baseWisdom = creature.baseWisdom ?? creature.wisdomCycle?.[0] ?? 0;
  const rotation = creature.rotation ?? 0;
  return {
    ...creature,
    baseWisdom,
    rotation,
    currentWisdom: typeof creature.currentWisdom === 'number'
      ? creature.currentWisdom
      : getCreatureWisdom({ ...creature, baseWisdom, rotation }),
  };
}

export function updateCreatureWisdomFromRotation(creature: Creature): Creature {
  return {
    ...creature,
    currentWisdom: getCreatureWisdom(creature),
  };
}

export function getEffectiveCreatureWisdom(state: GameState, playerIndex: number, creatureId: string): number {
  const player = state.players[playerIndex];
  const creature = player?.creatures.find(c => c.id === creatureId);
  if (!creature) return 0;

  let wisdom = typeof creature.currentWisdom === 'number'
    ? creature.currentWisdom
    : getCreatureWisdom(creature);
  const hasOwl = player.field.some(slot => slot.knowledge?.id === 'aerial3');
  if (hasOwl) wisdom += 1;

  return wisdom;
}

export function makeKnowledgeInstance(card: Knowledge): Knowledge {
  return { ...card, instanceId: card.instanceId || crypto.randomUUID(), rotation: card.rotation ?? 0 };
}

export function refillMarket(state: GameState, minimumSize = 5): GameState {
  const newState = structuredClone(state);
  while (newState.market.length < minimumSize) {
    if (newState.knowledgeDeck.length === 0) {
      if (newState.discardPile.length === 0) break;
      const reshuffled = [...newState.discardPile].sort(() => Math.random() - 0.5).map(card => ({
        ...card,
        rotation: 0,
        instanceId: crypto.randomUUID(),
      }));
      newState.knowledgeDeck = reshuffled;
      newState.discardPile = [];
      newState.log.push('[Market] Discard pile reshuffled into the Knowledge deck.');
    }

    const nextCard = newState.knowledgeDeck.shift();
    if (!nextCard) break;
    newState.market.push(makeKnowledgeInstance(nextCard));
  }
  return newState;
}

export function createPendingEffect(
  state: GameState,
  effect: Omit<PendingEffect, 'id'>
): GameState {
  if (state.pendingEffect) {
    return {
      ...state,
      log: [...state.log, `[Pending Effect] ${effect.sourceKnowledgeName ?? 'Card effect'} could not open because another choice is pending.`],
    };
  }

  return {
    ...state,
    pendingEffect: {
      ...effect,
      id: crypto.randomUUID(),
    },
    log: [...state.log, `[Pending Effect] ${effect.prompt}`],
  };
}

export function buildKnowledgeChoices(
  state: GameState,
  playerIndex: 0 | 1,
  filter: (knowledge: Knowledge, creatureId: string, slotIndex: number) => boolean = () => true
): PendingEffectChoice[] {
  return state.players[playerIndex].field.flatMap((slot, slotIndex) => {
    if (!slot.knowledge || !slot.knowledge.instanceId || !filter(slot.knowledge, slot.creatureId, slotIndex)) return [];
    return [{
      kind: 'knowledge' as const,
      playerIndex,
      creatureId: slot.creatureId,
      instanceId: slot.knowledge.instanceId,
      label: slot.knowledge.name,
      image: slot.knowledge.image,
    }];
  });
}

export function buildHandChoices(
  state: GameState,
  playerIndex: 0 | 1,
  filter: (knowledge: Knowledge) => boolean = () => true
): PendingEffectChoice[] {
  return state.players[playerIndex].hand.flatMap(card => {
    if (!card.instanceId || !filter(card)) return [];
    return [{
      kind: 'hand' as const,
      playerIndex,
      instanceId: card.instanceId,
      label: card.name,
      image: card.image,
    }];
  });
}

export function buildCreatureChoices(
  state: GameState,
  playerIndex: 0 | 1,
  filter: (creature: Creature) => boolean = () => true
): PendingEffectChoice[] {
  return state.players[playerIndex].creatures.flatMap(creature => {
    if (!filter(creature)) return [];
    return [{
      kind: 'creature' as const,
      playerIndex,
      creatureId: creature.id,
      label: creature.name,
      image: creature.image,
    }];
  });
}

export function buildMarketChoices(state: GameState): PendingEffectChoice[] {
  return state.market.flatMap(card => {
    if (!card.instanceId) return [];
    return [{
      kind: 'market' as const,
      instanceId: card.instanceId,
      label: card.name,
      image: card.image,
    }];
  });
}
