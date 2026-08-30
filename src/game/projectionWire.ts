import type {
  GameProjection,
  ProjectedHand,
  ProjectedPendingEffect,
  ProjectedPlayerState,
} from './projections.js';
import type { Creature, Knowledge } from './types.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;
const ROTATIONS = new Set([0, 90, 180, 270]);
const ELEMENTS = new Set(['earth', 'water', 'air', 'fire', 'neutral']);
const PHASES = new Set(['knowledge', 'action', 'end', 'gameOver', 'setup']);
const PENDING_TYPES = new Set([
  'chooseKnowledgeToRotate',
  'chooseOpponentHandDiscard',
  'chooseOpponentKnowledgeDiscard',
  'chooseCreatureToRotate',
  'chooseMarketDiscard',
  'chooseMarketDraw',
  'discardToHandLimit',
]);
const CHOICE_KINDS = new Set(['knowledge', 'creature', 'hand', 'market']);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value && typeof value === 'object' && !Array.isArray(value))
);

const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
};

const isString = (value: unknown, max = 512): value is string => (
  typeof value === 'string' && value.length > 0 && value.length <= max
);

const isSafeInteger = (value: unknown, minimum = 0): value is number => (
  Number.isSafeInteger(value) && Number(value) >= minimum
);

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const isOptionalNumberArray = (value: unknown): boolean => (
  value === undefined
  || (
    Array.isArray(value)
    && value.length <= 8
    && value.every(isFiniteNumber)
  )
);

const isOptionalRotation = (value: unknown): boolean => (
  value === undefined || (typeof value === 'number' && ROTATIONS.has(value))
);

const isCreature = (value: unknown): value is Creature => {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'id',
    'name',
    'image',
    'element',
    'passiveAbility',
    'baseWisdom',
    'wisdomCycle',
    'currentWisdom',
    'summonedKnowledgeId',
    'rotation',
  ])) return false;
  return isString(value.id, 64)
    && isString(value.name, 128)
    && isString(value.image, 2_048)
    && typeof value.element === 'string'
    && ELEMENTS.has(value.element)
    && typeof value.passiveAbility === 'string'
    && value.passiveAbility.length <= 2_048
    && (value.baseWisdom === undefined || isFiniteNumber(value.baseWisdom))
    && isOptionalNumberArray(value.wisdomCycle)
    && (value.currentWisdom === undefined || isFiniteNumber(value.currentWisdom))
    && (
      value.summonedKnowledgeId === undefined
      || value.summonedKnowledgeId === null
      || isString(value.summonedKnowledgeId, 128)
    )
    && isOptionalRotation(value.rotation);
};

const isKnowledge = (value: unknown): value is Knowledge => {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'id',
    'name',
    'image',
    'type',
    'element',
    'cost',
    'effect',
    'maxRotations',
    'valueCycle',
    'rotation',
    'instanceId',
  ])) return false;
  return isString(value.id, 64)
    && isString(value.name, 128)
    && isString(value.image, 2_048)
    && (value.type === 'spell' || value.type === 'ally')
    && typeof value.element === 'string'
    && ELEMENTS.has(value.element)
    && isFiniteNumber(value.cost)
    && value.cost >= 0
    && typeof value.effect === 'string'
    && value.effect.length <= 2_048
    && (value.maxRotations === undefined || isSafeInteger(value.maxRotations))
    && isOptionalNumberArray(value.valueCycle)
    && isOptionalRotation(value.rotation)
    && (value.instanceId === undefined || isString(value.instanceId, 128));
};

const isProjectedHand = (value: unknown): value is ProjectedHand => {
  if (!isRecord(value) || !isSafeInteger(value.count, 0) || value.count > 100) return false;
  if (value.visibility === 'hidden') {
    return hasOnlyKeys(value, ['visibility', 'count']);
  }
  return value.visibility === 'visible'
    && hasOnlyKeys(value, ['visibility', 'count', 'cards'])
    && Array.isArray(value.cards)
    && value.cards.length === value.count
    && value.cards.every(isKnowledge);
};

const isProjectedPlayer = (value: unknown): value is ProjectedPlayerState => {
  if (!isRecord(value) || !hasOnlyKeys(value, ['id', 'power', 'creatures', 'field', 'hand'])) {
    return false;
  }
  return typeof value.id === 'string'
    && UUID_PATTERN.test(value.id)
    && isFiniteNumber(value.power)
    && value.power >= 0
    && Array.isArray(value.creatures)
    && value.creatures.length === 3
    && value.creatures.every(isCreature)
    && Array.isArray(value.field)
    && value.field.length === 3
    && value.field.every((slot) => (
      isRecord(slot)
      && hasOnlyKeys(slot, ['creatureId', 'knowledge'])
      && isString(slot.creatureId, 64)
      && (slot.knowledge === null || isKnowledge(slot.knowledge))
    ))
    && isProjectedHand(value.hand);
};

const isProjectedPendingEffect = (value: unknown): value is ProjectedPendingEffect => {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'id',
    'type',
    'prompt',
    'optional',
    'choices',
  ])) return false;
  return isString(value.id, 128)
    && typeof value.type === 'string'
    && PENDING_TYPES.has(value.type)
    && isString(value.prompt, 1_024)
    && typeof value.optional === 'boolean'
    && Array.isArray(value.choices)
    && value.choices.length <= 100
    && value.choices.every((choice) => (
      isRecord(choice)
      && hasOnlyKeys(choice, ['key', 'kind', 'label', 'image', 'creatureId'])
      && /^choice-[1-9][0-9]*$/.test(String(choice.key))
      && typeof choice.kind === 'string'
      && CHOICE_KINDS.has(choice.kind)
      && isString(choice.label, 512)
      && (choice.image === undefined || isString(choice.image, 2_048))
      && (choice.creatureId === undefined || isString(choice.creatureId, 64))
    ));
};

/** Strict v1 wire guard. Unknown fields are rejected to avoid accidentally surfacing secrets. */
export function isGameProjectionWire(value: unknown): value is GameProjection {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'protocol',
    'matchId',
    'stateVersion',
    'eventSequence',
    'rulesVersion',
    'turn',
    'phase',
    'currentPlayerId',
    'actionsTakenThisTurn',
    'actionsPerTurn',
    'winner',
    'players',
    'market',
    'discardPile',
    'deckCount',
    'pendingEffect',
    'log',
    'seedCommitment',
    'turnDeadline',
  ])) return false;
  if (
    value.protocol !== 'wisdom-duel-projection-v1'
    || typeof value.matchId !== 'string'
    || !UUID_PATTERN.test(value.matchId)
    || !isSafeInteger(value.stateVersion)
    || !isSafeInteger(value.eventSequence)
    || value.rulesVersion !== 'rulebook-v1'
    || !isSafeInteger(value.turn, 1)
    || typeof value.phase !== 'string'
    || !PHASES.has(value.phase)
    || typeof value.currentPlayerId !== 'string'
    || !isSafeInteger(value.actionsTakenThisTurn)
    || !isSafeInteger(value.actionsPerTurn, 1)
    || !Array.isArray(value.players)
    || value.players.length !== 2
    || !value.players.every(isProjectedPlayer)
    || !Array.isArray(value.market)
    || value.market.length > 20
    || !value.market.every(isKnowledge)
    || !Array.isArray(value.discardPile)
    || value.discardPile.length > 1_000
    || !value.discardPile.every(isKnowledge)
    || !isSafeInteger(value.deckCount)
    || (value.pendingEffect !== null && !isProjectedPendingEffect(value.pendingEffect))
    || !Array.isArray(value.log)
    || value.log.length > 2_000
    || !value.log.every((entry) => typeof entry === 'string' && entry.length <= 2_048)
    || (value.seedCommitment !== undefined && (
      typeof value.seedCommitment !== 'string' || !SHA256_PATTERN.test(value.seedCommitment)
    ))
    || (value.turnDeadline !== undefined && (
      typeof value.turnDeadline !== 'string' || !Number.isFinite(Date.parse(value.turnDeadline))
    ))
  ) return false;

  const playerIds = value.players.map((player) => player.id);
  return new Set(playerIds).size === 2
    && playerIds.includes(value.currentPlayerId)
    && (value.winner === null || (
      typeof value.winner === 'string' && playerIds.includes(value.winner)
    ));
}
