export const GAME_COMMAND_PROTOCOL_VERSION = 'wisdom-duel-command-v1' as const;

export type RotateCreatureCommand = {
  type: 'rotate_creature';
  creatureId: string;
};

export type DrawKnowledgeCommand = {
  type: 'draw_knowledge';
  marketInstanceId: string;
};

export type SummonKnowledgeCommand = {
  type: 'summon_knowledge';
  handInstanceId: string;
  creatureId: string;
};

export type RotateKnowledgeCommand = {
  type: 'rotate_knowledge';
  creatureId: string;
  fieldInstanceId: string;
};

export type ResolvePendingEffectCommand = {
  type: 'resolve_pending_effect';
  effectId: string;
  choiceKey?: string;
  skip?: boolean;
};

export type EndTurnCommand = {
  type: 'end_turn';
};

export type PlayerGameCommand =
  | RotateCreatureCommand
  | DrawKnowledgeCommand
  | SummonKnowledgeCommand
  | RotateKnowledgeCommand
  | ResolvePendingEffectCommand
  | EndTurnCommand;

export interface GameCommandEnvelope {
  protocolVersion: typeof GAME_COMMAND_PROTOCOL_VERSION;
  matchId: string;
  commandId: string;
  expectedVersion: number;
  command: PlayerGameCommand;
}

export type GameCommandRejectionCode =
  | 'multiplayer_disabled'
  | 'unauthorized'
  | 'not_participant'
  | 'invalid_command'
  | 'version_conflict'
  | 'rule_violation'
  | 'match_not_playable'
  | 'deadline_expired'
  | 'internal_error';

export type GameCommandResult<TProjection = unknown> =
  | {
      status: 'accepted' | 'duplicate';
      commandId: string;
      stateVersion: number;
      eventSequence: number;
      projection: TProjection;
    }
  | {
      status: 'rejected';
      commandId?: string;
      code: GameCommandRejectionCode;
      message: string;
      currentVersion?: number;
      projection?: TProjection;
    };

export type CommandValidationResult =
  | { valid: true; value: GameCommandEnvelope }
  | { valid: false; reason: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  const allowedSet = new Set(allowed);
  return Object.keys(value).every((key) => allowedSet.has(key));
}

function isNonEmptyString(value: unknown, maxLength = 128): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function validatePlayerCommand(value: unknown): value is PlayerGameCommand {
  if (!isRecord(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'rotate_creature':
      return hasOnlyKeys(value, ['type', 'creatureId'])
        && typeof value.creatureId === 'string'
        && SAFE_IDENTIFIER_PATTERN.test(value.creatureId);
    case 'draw_knowledge':
      return hasOnlyKeys(value, ['type', 'marketInstanceId'])
        && isNonEmptyString(value.marketInstanceId);
    case 'summon_knowledge':
      return hasOnlyKeys(value, ['type', 'handInstanceId', 'creatureId'])
        && isNonEmptyString(value.handInstanceId)
        && typeof value.creatureId === 'string'
        && SAFE_IDENTIFIER_PATTERN.test(value.creatureId);
    case 'rotate_knowledge':
      return hasOnlyKeys(value, ['type', 'creatureId', 'fieldInstanceId'])
        && typeof value.creatureId === 'string'
        && SAFE_IDENTIFIER_PATTERN.test(value.creatureId)
        && isNonEmptyString(value.fieldInstanceId);
    case 'resolve_pending_effect': {
      if (!hasOnlyKeys(value, ['type', 'effectId', 'choiceKey', 'skip'])) return false;
      if (!isNonEmptyString(value.effectId)) return false;
      const hasChoice = isNonEmptyString(value.choiceKey);
      const skips = value.skip === true;
      return hasChoice !== skips;
    }
    case 'end_turn':
      return hasOnlyKeys(value, ['type']);
    default:
      return false;
  }
}

export function validateGameCommandEnvelope(value: unknown): CommandValidationResult {
  if (!isRecord(value) || !hasOnlyKeys(value, [
    'protocolVersion',
    'matchId',
    'commandId',
    'expectedVersion',
    'command',
  ])) {
    return { valid: false, reason: 'Command envelope has an invalid shape.' };
  }

  if (value.protocolVersion !== GAME_COMMAND_PROTOCOL_VERSION) {
    return { valid: false, reason: 'Unsupported command protocol version.' };
  }
  if (typeof value.matchId !== 'string' || !UUID_PATTERN.test(value.matchId)) {
    return { valid: false, reason: 'matchId must be a UUID.' };
  }
  if (typeof value.commandId !== 'string' || !UUID_PATTERN.test(value.commandId)) {
    return { valid: false, reason: 'commandId must be a UUID.' };
  }
  if (!Number.isSafeInteger(value.expectedVersion) || Number(value.expectedVersion) < 0) {
    return { valid: false, reason: 'expectedVersion must be a non-negative safe integer.' };
  }
  if (!validatePlayerCommand(value.command)) {
    return { valid: false, reason: 'Player command is invalid or contains untrusted fields.' };
  }

  return { valid: true, value: value as unknown as GameCommandEnvelope };
}
