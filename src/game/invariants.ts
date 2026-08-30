import type { GameState, Knowledge, PlayerState } from './types.js';
import { isValidGameRandomState } from './random.js';

export type GameStateInvariantCode =
  | 'game_id_invalid'
  | 'players_invalid'
  | 'player_id_invalid'
  | 'player_ids_duplicate'
  | 'turn_invalid'
  | 'phase_invalid'
  | 'action_counter_invalid'
  | 'winner_invalid'
  | 'creatures_invalid'
  | 'field_invalid'
  | 'rotation_invalid'
  | 'hand_limit_invalid'
  | 'market_invalid'
  | 'knowledge_instance_invalid'
  | 'knowledge_instance_duplicate'
  | 'pending_effect_invalid'
  | 'blocked_slot_invalid'
  | 'rules_version_invalid'
  | 'random_state_invalid';

export interface GameStateInvariantViolation {
  code: GameStateInvariantCode;
  path: string;
  message: string;
}

export class GameStateInvariantError extends Error {
  readonly violations: GameStateInvariantViolation[];

  constructor(violations: GameStateInvariantViolation[]) {
    super(`Game state violates ${violations.length} invariant${violations.length === 1 ? '' : 's'}.`);
    this.name = 'GameStateInvariantError';
    this.violations = violations;
  }
}

const VALID_PHASES = new Set(['knowledge', 'action', 'end', 'gameOver', 'setup']);
const VALID_ROTATIONS = new Set([0, 90, 180, 270]);

function hasExactlyThreeUniqueCreatureIds(player: PlayerState): boolean {
  const creatureIds = player.creatures.map((creature) => creature.id);
  const selectedIds = player.selectedCreatures.map((creature) => creature.id);
  return creatureIds.length === 3
    && selectedIds.length === 3
    && new Set(creatureIds).size === 3
    && new Set(selectedIds).size === 3
    && selectedIds.every((id) => creatureIds.includes(id));
}

export function collectGameStateInvariantViolations(state: GameState): GameStateInvariantViolation[] {
  const violations: GameStateInvariantViolation[] = [];
  const add = (code: GameStateInvariantCode, path: string, message: string) => {
    violations.push({ code, path, message });
  };

  if (typeof state.gameId !== 'string' || state.gameId.length === 0) {
    add('game_id_invalid', 'gameId', 'A persisted multiplayer state must have a game id.');
  }

  if (!Array.isArray(state.players) || state.players.length !== 2) {
    add('players_invalid', 'players', 'Exactly two players are required.');
    return violations;
  }

  const playerIds = state.players.map((player) => player.id);
  state.players.forEach((player, playerIndex) => {
    const playerPath = `players[${playerIndex}]`;
    if (typeof player.id !== 'string' || player.id.length === 0) {
      add('player_id_invalid', `${playerPath}.id`, 'Player ids must be non-empty.');
    }
    if (!Number.isFinite(player.power)) {
      add('players_invalid', `${playerPath}.power`, 'Player power must be finite.');
    }
    if (!hasExactlyThreeUniqueCreatureIds(player)) {
      add('creatures_invalid', `${playerPath}.creatures`, 'Each player must have exactly three unique selected creatures.');
    }

    const creatureIds = player.creatures.map((creature) => creature.id).sort();
    const fieldIds = player.field.map((slot) => slot.creatureId).sort();
    if (player.field.length !== 3 || new Set(fieldIds).size !== 3 || fieldIds.join('|') !== creatureIds.join('|')) {
      add('field_invalid', `${playerPath}.field`, 'Field slots must match the three selected creatures exactly.');
    }

    player.creatures.forEach((creature, creatureIndex) => {
      if (!VALID_ROTATIONS.has(creature.rotation ?? 0)) {
        add('rotation_invalid', `${playerPath}.creatures[${creatureIndex}].rotation`, 'Creature rotation must be 0, 90, 180, or 270.');
      }
    });
    player.field.forEach((slot, slotIndex) => {
      if (slot.knowledge && !VALID_ROTATIONS.has(slot.knowledge.rotation ?? 0)) {
        add('rotation_invalid', `${playerPath}.field[${slotIndex}].knowledge.rotation`, 'Knowledge rotation must be 0, 90, 180, or 270.');
      }
    });

    const mayDiscardToLimit = state.pendingEffect?.type === 'discardToHandLimit'
      && state.pendingEffect.playerId === player.id;
    if (player.hand.length > 5 && !mayDiscardToLimit) {
      add('hand_limit_invalid', `${playerPath}.hand`, 'Hands above five cards require an active discard-to-limit effect.');
    }
  });

  if (playerIds.some((id, index) => playerIds.indexOf(id) !== index)) {
    add('player_ids_duplicate', 'players', 'Player ids must be unique.');
  }
  if (!Number.isSafeInteger(state.turn) || state.turn < 1 || ![0, 1].includes(state.currentPlayerIndex)) {
    add('turn_invalid', 'turn', 'Turn and current player index are invalid.');
  }
  if (!VALID_PHASES.has(state.phase)) {
    add('phase_invalid', 'phase', 'Unknown game phase.');
  }
  if (!Number.isSafeInteger(state.actionsPerTurn) || state.actionsPerTurn < 1
    || !Number.isSafeInteger(state.actionsTakenThisTurn) || state.actionsTakenThisTurn < 0
    || state.actionsTakenThisTurn > state.actionsPerTurn) {
    add('action_counter_invalid', 'actionsTakenThisTurn', 'Action counters must stay within the turn allowance.');
  }
  if (state.winner !== null && !playerIds.includes(state.winner)) {
    add('winner_invalid', 'winner', 'Winner must be null or one of the two players.');
  }
  if (state.phase !== 'gameOver' && state.winner !== null) {
    add('winner_invalid', 'winner', 'A winner may only be set in the gameOver phase.');
  }
  if (!Array.isArray(state.market) || state.market.length > 5) {
    add('market_invalid', 'market', 'The face-up market cannot contain more than five cards.');
  }

  const instances = new Map<string, string>();
  const inspectKnowledge = (card: Knowledge, path: string) => {
    if (typeof card.instanceId !== 'string' || card.instanceId.length === 0) {
      add('knowledge_instance_invalid', `${path}.instanceId`, 'Every runtime Knowledge card must have an instance id.');
      return;
    }
    const existingPath = instances.get(card.instanceId);
    if (existingPath) {
      add('knowledge_instance_duplicate', `${path}.instanceId`, `Knowledge instance also exists at ${existingPath}.`);
    } else {
      instances.set(card.instanceId, path);
    }
  };

  state.market.forEach((card, index) => inspectKnowledge(card, `market[${index}]`));
  state.knowledgeDeck.forEach((card, index) => inspectKnowledge(card, `knowledgeDeck[${index}]`));
  state.discardPile.forEach((card, index) => inspectKnowledge(card, `discardPile[${index}]`));
  state.players.forEach((player, playerIndex) => {
    player.hand.forEach((card, index) => inspectKnowledge(card, `players[${playerIndex}].hand[${index}]`));
    player.field.forEach((slot, slotIndex) => {
      if (slot.knowledge) inspectKnowledge(slot.knowledge, `players[${playerIndex}].field[${slotIndex}].knowledge`);
    });
  });

  if (state.pendingEffect) {
    const pending = state.pendingEffect;
    if (!pending.id || !playerIds.includes(pending.playerId)
      || !playerIds.includes(pending.sourcePlayerId) || pending.choices.length === 0) {
      add('pending_effect_invalid', 'pendingEffect', 'Pending effects require valid actors and at least one server-derived choice.');
    }

    const expectedKind: Record<typeof pending.type, string> = {
      chooseKnowledgeToRotate: 'knowledge',
      chooseOpponentHandDiscard: 'hand',
      chooseOpponentKnowledgeDiscard: 'knowledge',
      chooseCreatureToRotate: 'creature',
      chooseMarketDiscard: 'market',
      chooseMarketDraw: 'market',
      discardToHandLimit: 'hand',
    };
    const choiceIdentities = new Set<string>();
    pending.choices.forEach((choice, choiceIndex) => {
      const choicePath = `pendingEffect.choices[${choiceIndex}]`;
      let identity = `${choice.kind}:`;
      let referenceExists = false;
      if (choice.kind === 'hand') {
        identity += `${choice.playerIndex}:${choice.instanceId}`;
        referenceExists = (choice.playerIndex === 0 || choice.playerIndex === 1)
          && state.players[choice.playerIndex].hand.some((card) => card.instanceId === choice.instanceId);
      } else if (choice.kind === 'knowledge') {
        identity += `${choice.playerIndex}:${choice.creatureId}:${choice.instanceId}`;
        referenceExists = (choice.playerIndex === 0 || choice.playerIndex === 1)
          && state.players[choice.playerIndex].field.some((slot) => (
            slot.creatureId === choice.creatureId && slot.knowledge?.instanceId === choice.instanceId
          ));
      } else if (choice.kind === 'creature') {
        identity += `${choice.playerIndex}:${choice.creatureId}`;
        referenceExists = (choice.playerIndex === 0 || choice.playerIndex === 1)
          && state.players[choice.playerIndex].creatures.some((creature) => creature.id === choice.creatureId);
      } else {
        identity += choice.instanceId;
        referenceExists = state.market.some((card) => card.instanceId === choice.instanceId);
      }

      if (choice.kind !== expectedKind[pending.type] || !choice.label || !referenceExists || choiceIdentities.has(identity)) {
        add('pending_effect_invalid', choicePath, 'Pending choices must be unique, type-correct references to the current state.');
      }
      choiceIdentities.add(identity);
    });

    const actingPlayerIndex = state.players.findIndex((player) => player.id === pending.playerId);
    const opponentIndex = actingPlayerIndex === 0 ? 1 : 0;
    if (pending.type === 'discardToHandLimit') {
      const actor = state.players[actingPlayerIndex];
      if (!actor || actor.hand.length <= 5 || pending.choices.some((choice) => choice.kind !== 'hand' || choice.playerIndex !== actingPlayerIndex)) {
        add('pending_effect_invalid', 'pendingEffect', 'Discard-to-limit choices must reference the oversized hand of the selected player.');
      }
    }
    if (
      (pending.type === 'chooseOpponentHandDiscard' || pending.type === 'chooseOpponentKnowledgeDiscard')
      && pending.choices.some((choice) => !('playerIndex' in choice) || choice.playerIndex !== opponentIndex)
    ) {
      add('pending_effect_invalid', 'pendingEffect.choices', 'Opponent choices must reference the selected player’s opponent.');
    }
  }

  for (const playerIndex of [0, 1] as const) {
    const slots = state.blockedSlots[playerIndex] ?? [];
    if (new Set(slots).size !== slots.length || slots.some((slot) => !Number.isInteger(slot) || slot < 0 || slot > 2)) {
      add('blocked_slot_invalid', `blockedSlots.${playerIndex}`, 'Blocked slot indexes must be unique values from 0 to 2.');
    }
  }

  if (state.rulesVersion !== 'rulebook-v1') {
    add('rules_version_invalid', 'rulesVersion', 'The state must declare the supported rules version.');
  }
  if (!isValidGameRandomState(state.privateRandom)) {
    add('random_state_invalid', 'privateRandom', 'Authoritative state requires a valid private random stream.');
  }

  return violations;
}

export function assertGameStateInvariants(state: GameState): void {
  const violations = collectGameStateInvariantViolations(state);
  if (violations.length > 0) {
    throw new GameStateInvariantError(violations);
  }
}
