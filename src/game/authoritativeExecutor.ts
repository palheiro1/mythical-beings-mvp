import { assertGameStateInvariants } from './invariants.js';
import { canonicalizeCommandEnvelope } from './commandFingerprint.js';
import {
  type GameCommandEnvelope,
  type GameCommandResult,
  type PlayerGameCommand,
  validateGameCommandEnvelope,
} from './protocol.js';
import {
  buildGameProjection,
  type GameProjection,
  type ProjectionViewer,
  resolvePendingChoiceByKey,
} from './projections.js';
import { computeGameSeedCommitment } from './random.js';
import { isValidAction } from './rules.js';
import { gameReducer } from './state.js';
import type { GameAction, GameState } from './types.js';

export interface AuthoritativeGameEvent {
  sequence: number;
  stateVersion: number;
  commandId: string;
  actorId: string;
  commandType: PlayerGameCommand['type'];
  envelope: GameCommandEnvelope;
  occurredAt: string;
}

export interface RegisterAuthoritativeMatchOptions {
  initialVersion?: number;
  initialEventSequence?: number;
  seedCommitment?: string;
  turnDeadline?: string;
}

export interface InMemoryAuthoritativeExecutorOptions {
  /** Must be explicitly true. The local executor is default-off like the production gate. */
  enabled?: boolean;
  /** Spectator projections are optional and remain disabled unless explicitly enabled. */
  spectatorsEnabled?: boolean;
  now?: () => Date;
}

interface StoredAcceptedCommand {
  actorId: string;
  envelopeFingerprint: string;
  result: AcceptedCommandResult;
}

type AcceptedCommandResult = {
  status: 'accepted';
  commandId: string;
  stateVersion: number;
  eventSequence: number;
  projection: GameProjection;
};

interface MatchRecord {
  state: GameState;
  stateVersion: number;
  eventSequence: number;
  seedCommitment?: string;
  turnDeadline?: string;
  acceptedCommands: Map<string, StoredAcceptedCommand>;
  events: AuthoritativeGameEvent[];
}

type ActionMappingResult =
  | { valid: true; action: GameAction }
  | { valid: false };

function mapCommandToAction(state: GameState, actorId: string, command: PlayerGameCommand): ActionMappingResult {
  switch (command.type) {
    case 'rotate_creature':
      return {
        valid: true,
        action: { type: 'ROTATE_CREATURE', payload: { playerId: actorId, creatureId: command.creatureId } },
      };

    case 'draw_knowledge': {
      const card = state.market.find((candidate) => candidate.instanceId === command.marketInstanceId);
      if (!card?.instanceId) return { valid: false };
      return {
        valid: true,
        action: {
          type: 'DRAW_KNOWLEDGE',
          payload: { playerId: actorId, knowledgeId: card.id, instanceId: card.instanceId },
        },
      };
    }

    case 'summon_knowledge': {
      const player = state.players.find((candidate) => candidate.id === actorId);
      const card = player?.hand.find((candidate) => candidate.instanceId === command.handInstanceId);
      if (!card?.instanceId) return { valid: false };
      return {
        valid: true,
        action: {
          type: 'SUMMON_KNOWLEDGE',
          payload: {
            playerId: actorId,
            knowledgeId: card.id,
            instanceId: card.instanceId,
            creatureId: command.creatureId,
          },
        },
      };
    }

    case 'rotate_knowledge': {
      const player = state.players.find((candidate) => candidate.id === actorId);
      const slot = player?.field.find((candidate) => (
        candidate.creatureId === command.creatureId
        && candidate.knowledge?.instanceId === command.fieldInstanceId
      ));
      if (!slot?.knowledge?.instanceId) return { valid: false };
      return {
        valid: true,
        action: {
          type: 'ROTATE_KNOWLEDGE',
          payload: {
            playerId: actorId,
            creatureId: command.creatureId,
            instanceId: slot.knowledge.instanceId,
          },
        },
      };
    }

    case 'resolve_pending_effect': {
      const pending = state.pendingEffect;
      if (!pending || pending.id !== command.effectId || pending.playerId !== actorId) return { valid: false };
      if (command.skip) {
        if (!pending.optional) return { valid: false };
        return {
          valid: true,
          action: {
            type: 'RESOLVE_PENDING_EFFECT',
            payload: { playerId: actorId, resolution: { effectId: pending.id, skip: true } },
          },
        };
      }
      if (!command.choiceKey) return { valid: false };
      const choice = resolvePendingChoiceByKey(pending, command.choiceKey);
      if (!choice) return { valid: false };
      return {
        valid: true,
        action: {
          type: 'RESOLVE_PENDING_EFFECT',
          payload: { playerId: actorId, resolution: { effectId: pending.id, choice } },
        },
      };
    }

    case 'end_turn':
      return { valid: true, action: { type: 'END_TURN', payload: { playerId: actorId } } };
  }
}

function rejected(
  code: Extract<GameCommandResult, { status: 'rejected' }>['code'],
  message: string,
  extras: Partial<Extract<GameCommandResult<GameProjection>, { status: 'rejected' }>> = {},
): Extract<GameCommandResult<GameProjection>, { status: 'rejected' }> {
  return { status: 'rejected', code, message, ...extras };
}

export class InMemoryAuthoritativeGameExecutor {
  private readonly matches = new Map<string, MatchRecord>();
  private readonly enabled: boolean;
  private readonly spectatorsEnabled: boolean;
  private readonly now: () => Date;

  constructor(options: InMemoryAuthoritativeExecutorOptions = {}) {
    this.enabled = options.enabled === true;
    this.spectatorsEnabled = options.spectatorsEnabled === true;
    this.now = options.now ?? (() => new Date());
  }

  registerMatch(state: GameState, options: RegisterAuthoritativeMatchOptions = {}): void {
    const privateState = structuredClone(state);
    assertGameStateInvariants(privateState);
    if (this.matches.has(privateState.gameId)) throw new Error('Match is already registered.');
    if (!Number.isSafeInteger(options.initialVersion ?? 0) || (options.initialVersion ?? 0) < 0) {
      throw new Error('Initial state version must be a non-negative safe integer.');
    }
    if (!Number.isSafeInteger(options.initialEventSequence ?? 0) || (options.initialEventSequence ?? 0) < 0) {
      throw new Error('Initial event sequence must be a non-negative safe integer.');
    }
    if (options.seedCommitment && !/^[0-9a-f]{64}$/i.test(options.seedCommitment)) {
      throw new Error('Seed commitment must be a SHA-256 hexadecimal digest.');
    }
    if (options.turnDeadline && !Number.isFinite(Date.parse(options.turnDeadline))) {
      throw new Error('Turn deadline must be an ISO-compatible timestamp.');
    }

    this.matches.set(privateState.gameId, {
      state: privateState,
      stateVersion: options.initialVersion ?? 0,
      eventSequence: options.initialEventSequence ?? 0,
      seedCommitment: options.seedCommitment?.toLowerCase(),
      turnDeadline: options.turnDeadline,
      acceptedCommands: new Map(),
      events: [],
    });
  }

  getProjection(matchId: string, viewer: ProjectionViewer): GameProjection | null {
    const record = this.matches.get(matchId);
    if (!record) return null;
    if (viewer.kind === 'spectator' && !this.spectatorsEnabled) return null;
    if (viewer.kind === 'player' && !record.state.players.some((player) => player.id === viewer.playerId)) return null;
    return buildGameProjection(record.state, viewer, record);
  }

  execute(actorId: string | null | undefined, input: unknown): GameCommandResult<GameProjection> {
    if (!this.enabled) {
      return rejected('multiplayer_disabled', 'Multiplayer is not available in this release.');
    }
    if (!actorId) return rejected('unauthorized', 'Authentication is required.');

    const validation = validateGameCommandEnvelope(input);
    if (!validation.valid) return rejected('invalid_command', validation.reason);
    const envelope = validation.value;
    const record = this.matches.get(envelope.matchId);
    if (!record) {
      return rejected('match_not_playable', 'The match is not available.', { commandId: envelope.commandId });
    }
    if (!record.state.players.some((player) => player.id === actorId)) {
      return rejected('not_participant', 'The authenticated user is not a match participant.', {
        commandId: envelope.commandId,
      });
    }

    const fingerprint = canonicalizeCommandEnvelope(envelope);
    const stored = record.acceptedCommands.get(envelope.commandId);
    if (stored) {
      if (stored.actorId !== actorId || stored.envelopeFingerprint !== fingerprint) {
        return rejected('invalid_command', 'commandId was already used for a different command.', {
          commandId: envelope.commandId,
        });
      }
      return {
        ...structuredClone(stored.result),
        status: 'duplicate',
      };
    }

    if (record.state.phase === 'gameOver') {
      return rejected('match_not_playable', 'The match has already finished.', {
        commandId: envelope.commandId,
        currentVersion: record.stateVersion,
        projection: buildGameProjection(record.state, { kind: 'player', playerId: actorId }, record),
      });
    }
    if (record.turnDeadline && this.now().getTime() > Date.parse(record.turnDeadline)) {
      return rejected('deadline_expired', 'The server turn deadline has expired.', {
        commandId: envelope.commandId,
        currentVersion: record.stateVersion,
        projection: buildGameProjection(record.state, { kind: 'player', playerId: actorId }, record),
      });
    }
    if (envelope.expectedVersion !== record.stateVersion) {
      return rejected('version_conflict', 'The match has changed. Refresh before choosing another action.', {
        commandId: envelope.commandId,
        currentVersion: record.stateVersion,
        projection: buildGameProjection(record.state, { kind: 'player', playerId: actorId }, record),
      });
    }

    try {
      assertGameStateInvariants(record.state);
      const mapping = mapCommandToAction(record.state, actorId, envelope.command);
      if (!mapping.valid || !isValidAction(record.state, mapping.action).isValid) {
        return rejected('rule_violation', 'The command is not legal in the current match state.', {
          commandId: envelope.commandId,
          currentVersion: record.stateVersion,
        });
      }

      const nextState = gameReducer(structuredClone(record.state), mapping.action);
      if (!nextState) throw new Error('Reducer returned an empty state.');
      assertGameStateInvariants(nextState);

      const nextVersion = record.stateVersion + 1;
      const nextSequence = record.eventSequence + 1;
      const event: AuthoritativeGameEvent = {
        sequence: nextSequence,
        stateVersion: nextVersion,
        commandId: envelope.commandId,
        actorId,
        commandType: envelope.command.type,
        envelope: structuredClone(envelope),
        occurredAt: this.now().toISOString(),
      };

      // Atomic in-memory commit: no record field changes before all validation succeeds.
      record.state = nextState;
      record.stateVersion = nextVersion;
      record.eventSequence = nextSequence;
      record.events.push(event);
      const result: AcceptedCommandResult = {
        status: 'accepted',
        commandId: envelope.commandId,
        stateVersion: nextVersion,
        eventSequence: nextSequence,
        projection: buildGameProjection(nextState, { kind: 'player', playerId: actorId }, record),
      };
      record.acceptedCommands.set(envelope.commandId, {
        actorId,
        envelopeFingerprint: fingerprint,
        result: structuredClone(result),
      });
      return result;
    } catch {
      return rejected('internal_error', 'The command could not be committed safely.', {
        commandId: envelope.commandId,
        currentVersion: record.stateVersion,
      });
    }
  }

  /** Internal-only export for persistence/replay tests. Never return this from an HTTP handler. */
  exportPrivateSnapshot(matchId: string): { state: GameState; stateVersion: number; eventSequence: number } | null {
    const record = this.matches.get(matchId);
    if (!record) return null;
    return {
      state: structuredClone(record.state),
      stateVersion: record.stateVersion,
      eventSequence: record.eventSequence,
    };
  }

  exportEventsForReplay(matchId: string): AuthoritativeGameEvent[] {
    return structuredClone(this.matches.get(matchId)?.events ?? []);
  }

  async revealFinishedMatchSeed(matchId: string): Promise<{ seedHex: string; seedCommitment: string } | null> {
    const record = this.matches.get(matchId);
    const seedHex = record?.state.privateRandom?.seedHex;
    if (!record || record.state.phase !== 'gameOver' || !seedHex) return null;
    const computedCommitment = await computeGameSeedCommitment(seedHex);
    if (record.seedCommitment && record.seedCommitment !== computedCommitment) {
      throw new Error('Stored seed commitment does not match the private match seed.');
    }
    const seedCommitment = record.seedCommitment ?? computedCommitment;
    return { seedHex, seedCommitment };
  }
}
