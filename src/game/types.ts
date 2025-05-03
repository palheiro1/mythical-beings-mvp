export interface CombatBuffers {
  damage: number[];
  defense: number[];
}

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
  baseWisdom: number; // Starting wisdom (legacy, use wisdomCycle[0] if present)
  // Wisdom per rotation (0, 90, 180, 270 degrees)
  wisdomCycle?: number[];
  // Runtime properties (added during gameplay, not in JSON)
  currentWisdom?: number;
  summonedKnowledgeId?: string | null; // ID of knowledge card attached
  rotation?: number; // Rotation angle in degrees (0, 90, 180, 270)
}

// Knowledge specific types
export type KnowledgeType = 'spell' | 'ally';

export interface Knowledge extends BaseCard {
  type: KnowledgeType;
  element: CreatureElement; // Add element property
  cost: number; // Wisdom cost to summon
  effect: string; // Description of the effect when played/activated
  maxRotations?: number; // Maximum number of 90-degree rotations before discard
  // Runtime properties (added during gameplay, not in JSON)
  rotation?: number; // 0, 90, 180, 270 degrees
  instanceId?: string; // Unique per-instance ID for React keys
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
  discardPile: Knowledge[]; // Cards discarded from hand or market
  turn: number; // Current turn number
  currentPlayerIndex: 0 | 1; // Index of the current player in the players array
  phase: 'knowledge' | 'action' | 'end'; // Current game phase
  actionsTakenThisTurn: number; // Counter for actions in Action Phase
  actionsPerTurn: number; // Max actions allowed per turn
  winner: string | null; // ID of the winning player, or null
  log: string[]; // History of game events/actions
  blockedSlots?: Record<number, number[]>; // Tracks which field slots are blocked for each player index
  extraActionsNextTurn?: { 0: number; 1: number }; // Actions granted by aquatic5
  pendingEffects?: { type: 'damage' | 'defense'; amount: number }[]; // Change pendingEffects type
}

// Type for games listed in the lobby
export interface AvailableGame {
  id: string;
  player1_id: string;
  bet_amount: number;
  created_at: string;
  status: 'waiting' | 'active' | 'finished' | 'cancelled'; // Match possible statuses
}

// Action types for game updates
export type GameAction =
  | { type: 'ROTATE_CREATURE'; payload: { playerId: string; creatureId: string } }
  | { type: 'DRAW_KNOWLEDGE'; payload: { playerId: string; knowledgeId: string; instanceId: string } }
  | { type: 'SUMMON_KNOWLEDGE'; payload: { playerId: string; knowledgeId: string; creatureId: string; instanceId: string } }
  | { type: 'END_TURN'; payload: { playerId: string } }
  | { type: 'INITIALIZE_GAME'; payload: { gameId: string; player1Id: string; player2Id: string; player1SelectedIds: string[]; player2SelectedIds: string[] } }
  | { type: 'SET_GAME_STATE'; payload: GameState | null }; // Allow null payload for setting/clearing state

// Passive Ability Trigger Types
export type PassiveTriggerType =
  | 'TURN_START'
  | 'AFTER_PLAYER_SUMMON'
  | 'AFTER_OPPONENT_SUMMON'
  | 'AFTER_PLAYER_DRAW'
  | 'AFTER_OPPONENT_DRAW'
  | 'KNOWLEDGE_LEAVE' // When a knowledge card is discarded/destroyed
  | 'BEFORE_ACTION_VALIDATION' // For cost modifications etc.
  | 'DAMAGE_CALCULATION' // For defense modifications etc.
  | 'BLOCK_VALIDATION'; // For effects like unblockable

// Data passed with passive triggers
export interface PassiveEventData {
  playerId: string; // The player ID associated with the primary event (e.g., who summoned, who drew, whose turn started)
  creatureId?: string; // ID of the creature involved (e.g., the one summoning, the one being targeted)
  knowledgeId?: string; // ID of the knowledge card involved (e.g., the one summoned, drawn, leaving)
  knowledgeCard?: Knowledge; // The actual knowledge card object (useful for checking element, cost etc.)
  targetCreatureId?: string; // ID of the target creature (if applicable)
  // Add more fields as needed for specific triggers
}
