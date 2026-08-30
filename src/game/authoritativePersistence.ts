import type { AuthoritativeGameEvent, RegisterAuthoritativeMatchOptions } from './authoritativeExecutor.js';
import { assertGameStateInvariants } from './invariants.js';
import type { GameCommandEnvelope } from './protocol.js';
import { buildGameProjection, type GameProjection } from './projections.js';
import type { GameState } from './types.js';

export type PersistedAcceptedCommandResult = {
  status: 'accepted';
  commandId: string;
  stateVersion: number;
  eventSequence: number;
  projection: GameProjection;
};

export interface PersistedAcceptedCommand {
  actorId: string;
  envelopeFingerprint: string;
  result: PersistedAcceptedCommandResult;
}

export interface AuthoritativeExecutionSnapshot {
  state: GameState;
  stateVersion: number;
  eventSequence: number;
  seedCommitment?: string;
  turnDeadline?: string;
}

export type AuthoritativeExecutionContext = {
  match: AuthoritativeExecutionSnapshot;
  acceptedCommand?: PersistedAcceptedCommand;
};

export interface PlayerProjectionWrite {
  playerId: string;
  projection: GameProjection;
}

export interface AuthoritativeCommitCommand {
  matchId: string;
  actorId: string;
  envelope: GameCommandEnvelope;
  envelopeFingerprint: string;
  baseStateVersion: number;
  baseEventSequence: number;
  nextState: GameState;
  nextTurnDeadline?: string;
  event: AuthoritativeGameEvent;
  acceptedResult: PersistedAcceptedCommandResult;
  playerProjections: readonly PlayerProjectionWrite[];
}

export type AuthoritativeCommitResult =
  | { status: 'committed'; result: PersistedAcceptedCommandResult }
  | { status: 'duplicate'; result: PersistedAcceptedCommandResult }
  | { status: 'command_collision' }
  | { status: 'match_missing' }
  | { status: 'not_participant' }
  | { status: 'version_conflict'; currentVersion: number; projection: GameProjection };

export interface AuthoritativePersistencePort {
  loadExecutionContext(
    matchId: string,
    commandId: string,
  ): Promise<AuthoritativeExecutionContext | null>;
  loadPlayerProjection(matchId: string, playerId: string): Promise<GameProjection | null>;
  commitCommand(command: AuthoritativeCommitCommand): Promise<AuthoritativeCommitResult>;
}

export interface AuthoritativeInitializationParticipant {
  playerId: string;
  slot: 1 | 2;
  selectedCreatureIds: readonly string[];
}

export interface AuthoritativeInitializationSource {
  sessionId: string;
  gameId: string;
  modeId: string;
  status: string;
  revision: string;
  participants: readonly AuthoritativeInitializationParticipant[];
}

export interface AuthoritativeCreateMatchRequest {
  sourceRevision: string;
  state: GameState;
  seedCommitment: string;
  turnDeadline: string;
}

export type AuthoritativeInitializedMatch = {
  matchId: string;
  stateVersion: number;
  eventSequence: number;
  seedCommitment: string;
  turnDeadline: string;
};

export type AuthoritativeCreateMatchResult =
  | { status: 'created' | 'existing'; match: AuthoritativeInitializedMatch }
  | { status: 'source_changed' | 'source_missing' };

export interface AuthoritativeMatchInitializationPort extends AuthoritativePersistencePort {
  loadInitializationSource(sessionId: string): Promise<AuthoritativeInitializationSource | null>;
  createMatchIfAbsent(
    request: AuthoritativeCreateMatchRequest,
  ): Promise<AuthoritativeCreateMatchResult>;
}

interface PersistedMatchRecord extends AuthoritativeExecutionSnapshot {
  acceptedCommands: Map<string, PersistedAcceptedCommand>;
  events: AuthoritativeGameEvent[];
  playerProjections: Map<string, GameProjection>;
}

export type InMemoryCommitFailureMode = 'before_commit' | 'after_commit';

/**
 * Test/reference adapter. Multiple services may share one instance to model separate
 * Edge workers writing through a single transactional database.
 */
export class TransactionalInMemoryAuthoritativeStore implements AuthoritativeMatchInitializationPort {
  private readonly matches = new Map<string, PersistedMatchRecord>();
  private readonly initializationSources = new Map<string, AuthoritativeInitializationSource>();
  private readonly lockQueues = new Map<string, Promise<void>>();
  private nextFailureMode: InMemoryCommitFailureMode | null = null;

  registerMatch(state: GameState, options: RegisterAuthoritativeMatchOptions = {}): void {
    const privateState = structuredClone(state);
    assertGameStateInvariants(privateState);
    if (this.matches.has(privateState.gameId)) throw new Error('Match is already registered.');

    const stateVersion = options.initialVersion ?? 0;
    const eventSequence = options.initialEventSequence ?? 0;
    if (!Number.isSafeInteger(stateVersion) || stateVersion < 0) {
      throw new Error('Initial state version must be a non-negative safe integer.');
    }
    if (!Number.isSafeInteger(eventSequence) || eventSequence < 0) {
      throw new Error('Initial event sequence must be a non-negative safe integer.');
    }
    if (options.seedCommitment && !/^[0-9a-f]{64}$/i.test(options.seedCommitment)) {
      throw new Error('Seed commitment must be a SHA-256 hexadecimal digest.');
    }
    if (options.turnDeadline && !Number.isFinite(Date.parse(options.turnDeadline))) {
      throw new Error('Turn deadline must be an ISO-compatible timestamp.');
    }

    const metadata = {
      stateVersion,
      eventSequence,
      seedCommitment: options.seedCommitment?.toLowerCase(),
      turnDeadline: options.turnDeadline,
    };
    const playerProjections = new Map(privateState.players.map((player) => [
      player.id,
      buildGameProjection(privateState, { kind: 'player', playerId: player.id }, metadata),
    ]));

    this.matches.set(privateState.gameId, {
      state: privateState,
      ...metadata,
      acceptedCommands: new Map(),
      events: [],
      playerProjections,
    });
  }

  registerInitializationSource(source: AuthoritativeInitializationSource): void {
    this.initializationSources.set(source.sessionId, structuredClone(source));
  }

  async loadInitializationSource(
    sessionId: string,
  ): Promise<AuthoritativeInitializationSource | null> {
    const source = this.initializationSources.get(sessionId);
    return source ? structuredClone(source) : null;
  }

  async createMatchIfAbsent(
    request: AuthoritativeCreateMatchRequest,
  ): Promise<AuthoritativeCreateMatchResult> {
    return this.withMatchLock(request.state.gameId, (): AuthoritativeCreateMatchResult => {
      const existing = this.matches.get(request.state.gameId);
      if (existing) {
        if (!existing.seedCommitment || !existing.turnDeadline) {
          throw new Error('Existing match is missing initialization metadata.');
        }
        return {
          status: 'existing',
          match: {
            matchId: existing.state.gameId,
            stateVersion: existing.stateVersion,
            eventSequence: existing.eventSequence,
            seedCommitment: existing.seedCommitment,
            turnDeadline: existing.turnDeadline,
          },
        };
      }

      const source = this.initializationSources.get(request.state.gameId);
      if (!source) return { status: 'source_missing' };
      if (source.revision !== request.sourceRevision) return { status: 'source_changed' };

      this.assertInitializationShape(request, source);
      const metadata = {
        stateVersion: 0,
        eventSequence: 0,
        seedCommitment: request.seedCommitment.toLowerCase(),
        turnDeadline: request.turnDeadline,
      };
      const playerProjections = new Map(request.state.players.map((player) => [
        player.id,
        buildGameProjection(request.state, { kind: 'player', playerId: player.id }, metadata),
      ]));
      this.matches.set(request.state.gameId, {
        state: structuredClone(request.state),
        ...metadata,
        acceptedCommands: new Map(),
        events: [],
        playerProjections,
      });

      return {
        status: 'created',
        match: {
          matchId: request.state.gameId,
          ...metadata,
        },
      };
    });
  }

  failNextCommit(mode: InMemoryCommitFailureMode): void {
    this.nextFailureMode = mode;
  }

  async loadExecutionContext(
    matchId: string,
    commandId: string,
  ): Promise<AuthoritativeExecutionContext | null> {
    const record = this.matches.get(matchId);
    if (!record) return null;
    const acceptedCommand = record.acceptedCommands.get(commandId);
    return {
      match: {
        state: structuredClone(record.state),
        stateVersion: record.stateVersion,
        eventSequence: record.eventSequence,
        seedCommitment: record.seedCommitment,
        turnDeadline: record.turnDeadline,
      },
      acceptedCommand: acceptedCommand ? structuredClone(acceptedCommand) : undefined,
    };
  }

  async commitCommand(command: AuthoritativeCommitCommand): Promise<AuthoritativeCommitResult> {
    return this.withMatchLock(command.matchId, () => {
      const record = this.matches.get(command.matchId);
      if (!record) return { status: 'match_missing' };

      const stored = record.acceptedCommands.get(command.envelope.commandId);
      if (stored) {
        if (
          stored.actorId !== command.actorId
          || stored.envelopeFingerprint !== command.envelopeFingerprint
        ) {
          return { status: 'command_collision' };
        }
        return { status: 'duplicate', result: structuredClone(stored.result) };
      }

      if (!record.state.players.some((player) => player.id === command.actorId)) {
        return { status: 'not_participant' };
      }
      if (
        record.stateVersion !== command.baseStateVersion
        || record.stateVersion !== command.envelope.expectedVersion
        || record.eventSequence !== command.baseEventSequence
      ) {
        const projection = record.playerProjections.get(command.actorId)
          ?? buildGameProjection(record.state, { kind: 'player', playerId: command.actorId }, record);
        return {
          status: 'version_conflict',
          currentVersion: record.stateVersion,
          projection: structuredClone(projection),
        };
      }

      this.assertCommitShape(command, record);
      const failureMode = this.nextFailureMode;
      this.nextFailureMode = null;
      if (failureMode === 'before_commit') throw new Error('Injected failure before commit.');

      const acceptedCommands = new Map(record.acceptedCommands);
      acceptedCommands.set(command.envelope.commandId, {
        actorId: command.actorId,
        envelopeFingerprint: command.envelopeFingerprint,
        result: structuredClone(command.acceptedResult),
      });
      const playerProjections = new Map(record.playerProjections);
      for (const write of command.playerProjections) {
        playerProjections.set(write.playerId, structuredClone(write.projection));
      }

      this.matches.set(command.matchId, {
        state: structuredClone(command.nextState),
        stateVersion: command.acceptedResult.stateVersion,
        eventSequence: command.acceptedResult.eventSequence,
        seedCommitment: record.seedCommitment,
        turnDeadline: command.nextTurnDeadline,
        acceptedCommands,
        events: [...record.events, structuredClone(command.event)],
        playerProjections,
      });

      if (failureMode === 'after_commit') throw new Error('Injected failure after commit.');
      return { status: 'committed', result: structuredClone(command.acceptedResult) };
    });
  }

  async loadPlayerProjection(matchId: string, playerId: string): Promise<GameProjection | null> {
    const projection = this.matches.get(matchId)?.playerProjections.get(playerId);
    return projection ? structuredClone(projection) : null;
  }

  readPrivateMatchForTest(matchId: string): AuthoritativeExecutionSnapshot | null {
    const record = this.matches.get(matchId);
    if (!record) return null;
    return structuredClone({
      state: record.state,
      stateVersion: record.stateVersion,
      eventSequence: record.eventSequence,
      seedCommitment: record.seedCommitment,
      turnDeadline: record.turnDeadline,
    });
  }

  readEventsForTest(matchId: string): AuthoritativeGameEvent[] {
    return structuredClone(this.matches.get(matchId)?.events ?? []);
  }

  private assertCommitShape(
    command: AuthoritativeCommitCommand,
    record: PersistedMatchRecord,
  ): void {
    assertGameStateInvariants(command.nextState);
    if (command.nextState.gameId !== command.matchId) throw new Error('Commit match ID mismatch.');
    if (command.nextTurnDeadline && !Number.isFinite(Date.parse(command.nextTurnDeadline))) {
      throw new Error('Commit turn deadline is invalid.');
    }
    if (command.acceptedResult.commandId !== command.envelope.commandId) {
      throw new Error('Commit command ID mismatch.');
    }
    if (
      command.acceptedResult.stateVersion !== record.stateVersion + 1
      || command.acceptedResult.eventSequence !== record.eventSequence + 1
      || command.event.stateVersion !== command.acceptedResult.stateVersion
      || command.event.sequence !== command.acceptedResult.eventSequence
      || command.event.commandId !== command.envelope.commandId
      || command.event.actorId !== command.actorId
    ) {
      throw new Error('Commit version or event sequence is inconsistent.');
    }

    const expectedPlayerIds = new Set(command.nextState.players.map((player) => player.id));
    const projectionPlayerIds = new Set(command.playerProjections.map((write) => write.playerId));
    if (
      projectionPlayerIds.size !== expectedPlayerIds.size
      || [...expectedPlayerIds].some((playerId) => !projectionPlayerIds.has(playerId))
      || command.playerProjections.some((write) => (
        write.projection.matchId !== command.matchId
        || write.projection.stateVersion !== command.acceptedResult.stateVersion
        || write.projection.eventSequence !== command.acceptedResult.eventSequence
      ))
    ) {
      throw new Error('Commit player projections are incomplete or inconsistent.');
    }
  }

  private assertInitializationShape(
    request: AuthoritativeCreateMatchRequest,
    source: AuthoritativeInitializationSource,
  ): void {
    assertGameStateInvariants(request.state);
    if (request.state.gameId !== source.sessionId) throw new Error('Initialization match ID mismatch.');
    if (source.gameId !== 'card_game' || source.modeId !== 'casual' || source.status !== 'playing') {
      throw new Error('Initialization source is not a playable Wisdom Duel session.');
    }
    if (!/^[0-9a-f]{64}$/i.test(request.seedCommitment)) {
      throw new Error('Initialization commitment must be a SHA-256 digest.');
    }
    if (!Number.isFinite(Date.parse(request.turnDeadline))) {
      throw new Error('Initialization deadline must be an ISO-compatible timestamp.');
    }

    const expectedPlayers = [...source.participants]
      .sort((left, right) => left.slot - right.slot)
      .map((participant) => participant.playerId);
    const statePlayers = request.state.players.map((player) => player.id);
    if (
      expectedPlayers.length !== 2
      || statePlayers.length !== 2
      || expectedPlayers.some((playerId, index) => statePlayers[index] !== playerId)
    ) {
      throw new Error('Initialization participants do not match the current session source.');
    }

    const selectionsMatch = [...source.participants]
      .sort((left, right) => left.slot - right.slot)
      .every((participant, index) => {
        const sourceSelection = [...participant.selectedCreatureIds].sort();
        const stateSelection = request.state.players[index].selectedCreatures
          .map((creature) => creature.id)
          .sort();
        return sourceSelection.length === stateSelection.length
          && sourceSelection.every((creatureId, selectionIndex) => (
            creatureId === stateSelection[selectionIndex]
          ));
      });
    if (!selectionsMatch) {
      throw new Error('Initialization selections do not match the current session source.');
    }
  }

  private async withMatchLock<T>(matchId: string, operation: () => T): Promise<T> {
    const previous = this.lockQueues.get(matchId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const queued = previous.then(() => gate);
    this.lockQueues.set(matchId, queued);

    await previous;
    try {
      return operation();
    } finally {
      release();
      if (this.lockQueues.get(matchId) === queued) this.lockQueues.delete(matchId);
    }
  }
}
