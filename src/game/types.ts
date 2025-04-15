// Base Card types
export interface BaseCard {
  id: string; // Unique identifier (e.g., filename without extension)
  name: string; // Card name (e.g., "Adaro", "Aerial Blast")
  image: string; // Path to image (e.g., "/images/beings/adaro.jpg")
}

// Creature specific types
export type CreatureElement = 'earth' | 'water' | 'air' | 'fire' | 'neutral'; // Added fire/neutral

export interface Creature extends BaseCard {
  element: CreatureElement;
  passiveAbility: string; // Description of passive effect
  baseWisdom: number; // Starting wisdom
  // Runtime properties (added during gameplay, not in JSON)
  currentWisdom?: number;
  summonedKnowledgeId?: string | null; // ID of knowledge card attached
}

// Knowledge specific types
export type KnowledgeType = 'spell' | 'ally';

export interface Knowledge extends BaseCard {
  type: KnowledgeType;
  cost: number; // Wisdom cost to summon
  effect: string; // Description of the effect when played/activated
  // Runtime properties (added during gameplay, not in JSON)
  rotation?: number; // 0, 90, 180, 270 degrees
}

// Player state
export interface PlayerState {
  id: string; // Unique player identifier (e.g., wallet address or session ID)
  power: number;
  creatures: Creature[]; // The 3 creatures selected
  hand: Knowledge[]; // Max 5 knowledge cards
  field: { creatureId: string; knowledge: Knowledge | null }[]; // Creatures in play with attached knowledge
  selectedCreatures: Creature[]; // Creatures chosen during NFTSelection phase
}

// Overall Game State
export interface GameState {
  gameId: string; // Unique ID for the game session
  players: [PlayerState, PlayerState];
  market: Knowledge[]; // 5 face-up knowledge cards
  knowledgeDeck: Knowledge[]; // Remaining knowledge cards
  turn: number; // Current turn number
  currentPlayerIndex: 0 | 1; // Index of the current player in the players array
  phase: 'knowledge' | 'action' | 'end'; // Current game phase
  actionsTakenThisTurn: number; // Counter for actions in Action Phase
  winner: string | null; // ID of the winning player, or null
  log: string[]; // History of game events/actions
}

// Action types for game updates
export type GameAction =
  | { type: 'ROTATE_CREATURE'; payload: { playerId: string; creatureId: string } }
  | { type: 'DRAW_KNOWLEDGE'; payload: { playerId: string; knowledgeId: string } }
  | { type: 'SUMMON_KNOWLEDGE'; payload: { playerId: string; knowledgeId: string; creatureId: string } }
  | { type: 'END_TURN'; payload: { playerId: string } }
  | { type: 'INITIALIZE_GAME'; payload: { gameId: string; player1Id: string; player2Id: string; selectedCreaturesP1: Creature[]; selectedCreaturesP2: Creature[] } }
  | { type: 'SET_GAME_STATE'; payload: GameState | null }; // Allow null payload for setting/clearing state