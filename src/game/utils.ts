import { GameState, PlayerState, Creature, Knowledge } from './types';
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
    const idx = Math.floor((rotation % 360) / 90);
    return creature.wisdomCycle[idx] ?? 0;
  }
  // Fallback or default if wisdomCycle is not defined (shouldn't happen with current data)
  return creature.baseWisdom ?? 0;
}
