import { InMemoryAuthoritativeGameExecutor } from './authoritativeExecutor.js';
import { computeCommandEnvelopeFingerprint } from './commandFingerprint.js';
import type {
  AuthoritativeCommitResult,
  AuthoritativePersistencePort,
  PersistedAcceptedCommandResult,
} from './authoritativePersistence.js';
import {
  type GameCommandResult,
  validateGameCommandEnvelope,
} from './protocol.js';
import { buildGameProjection, type GameProjection } from './projections.js';

export interface DurableAuthoritativeCommandServiceOptions {
  /** Must be explicitly true. Deployment configuration remains default-off. */
  enabled?: boolean;
  persistence: AuthoritativePersistencePort;
  now?: () => Date;
  turnDurationSeconds?: number;
}

export type DurableProjectionReadResult =
  | { status: 'ok'; projection: GameProjection }
  | {
      status: 'rejected';
      code: 'unauthorized' | 'match_not_playable' | 'internal_error';
      message: string;
    };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const rejected = (
  code: Extract<GameCommandResult, { status: 'rejected' }>['code'],
  message: string,
  extras: Partial<Extract<GameCommandResult<GameProjection>, { status: 'rejected' }>> = {},
): Extract<GameCommandResult<GameProjection>, { status: 'rejected' }> => ({
  status: 'rejected',
  code,
  message,
  ...extras,
});

export class DurableAuthoritativeCommandService {
  private readonly enabled: boolean;
  private readonly persistence: AuthoritativePersistencePort;
  private readonly now: () => Date;
  private readonly turnDurationSeconds: number;

  constructor(options: DurableAuthoritativeCommandServiceOptions) {
    this.enabled = options.enabled === true;
    this.persistence = options.persistence;
    this.now = options.now ?? (() => new Date());
    this.turnDurationSeconds = options.turnDurationSeconds ?? 120;
    if (
      !Number.isSafeInteger(this.turnDurationSeconds)
      || this.turnDurationSeconds < 15
      || this.turnDurationSeconds > 600
    ) {
      throw new Error('Turn duration must be an integer between 15 and 600 seconds.');
    }
  }

  async readPlayerProjection(
    actorId: string | null | undefined,
    matchId: string,
  ): Promise<DurableProjectionReadResult> {
    if (!this.enabled) {
      return {
        status: 'rejected',
        code: 'match_not_playable',
        message: 'Multiplayer is not available in this release.',
      };
    }
    if (!actorId) {
      return { status: 'rejected', code: 'unauthorized', message: 'Authentication is required.' };
    }
    if (!UUID_PATTERN.test(matchId)) {
      return {
        status: 'rejected',
        code: 'match_not_playable',
        message: 'The match is not available.',
      };
    }

    try {
      const projection = await this.persistence.loadPlayerProjection(matchId, actorId);
      return projection
        ? { status: 'ok', projection }
        : {
            status: 'rejected',
            code: 'match_not_playable',
            message: 'The match is not available.',
          };
    } catch {
      return {
        status: 'rejected',
        code: 'internal_error',
        message: 'The match projection could not be loaded safely.',
      };
    }
  }

  async execute(
    actorId: string | null | undefined,
    input: unknown,
  ): Promise<GameCommandResult<GameProjection>> {
    if (!this.enabled) {
      return rejected('multiplayer_disabled', 'Multiplayer is not available in this release.');
    }
    if (!actorId) return rejected('unauthorized', 'Authentication is required.');

    const validation = validateGameCommandEnvelope(input);
    if (!validation.valid) return rejected('invalid_command', validation.reason);
    const envelope = validation.value;
    let loadedVersion: number | undefined;

    try {
      const fingerprint = await computeCommandEnvelopeFingerprint(envelope);
      const context = await this.persistence.loadExecutionContext(envelope.matchId, envelope.commandId);
      if (!context) {
        return rejected('match_not_playable', 'The match is not available.', {
          commandId: envelope.commandId,
        });
      }
      loadedVersion = context.match.stateVersion;

      if (context.acceptedCommand) {
        if (
          context.acceptedCommand.actorId !== actorId
          || context.acceptedCommand.envelopeFingerprint !== fingerprint
        ) {
          return rejected('invalid_command', 'commandId was already used for a different command.', {
            commandId: envelope.commandId,
          });
        }
        return { ...context.acceptedCommand.result, status: 'duplicate' };
      }

      if (!context.match.state.players.some((player) => player.id === actorId)) {
        return rejected('not_participant', 'The authenticated user is not a match participant.', {
          commandId: envelope.commandId,
        });
      }

      const executionTime = this.now();
      const localExecutor = new InMemoryAuthoritativeGameExecutor({
        enabled: true,
        now: () => executionTime,
      });
      localExecutor.registerMatch(context.match.state, {
        initialVersion: context.match.stateVersion,
        initialEventSequence: context.match.eventSequence,
        seedCommitment: context.match.seedCommitment,
        turnDeadline: context.match.turnDeadline,
      });
      const localResult = localExecutor.execute(actorId, envelope);
      if (localResult.status === 'rejected') return localResult;

      const nextSnapshot = localExecutor.exportPrivateSnapshot(envelope.matchId);
      const event = localExecutor.exportEventsForReplay(envelope.matchId)[0];
      if (!nextSnapshot || !event || localResult.status !== 'accepted') {
        throw new Error('Local execution did not produce an atomic commit draft.');
      }

      const nextTurnDeadline = envelope.command.type === 'end_turn'
        ? new Date(executionTime.getTime() + this.turnDurationSeconds * 1_000).toISOString()
        : context.match.turnDeadline;
      const metadata = {
        stateVersion: nextSnapshot.stateVersion,
        eventSequence: nextSnapshot.eventSequence,
        seedCommitment: context.match.seedCommitment,
        turnDeadline: nextTurnDeadline,
      };
      const acceptedResult: PersistedAcceptedCommandResult = {
        status: 'accepted',
        commandId: localResult.commandId,
        stateVersion: localResult.stateVersion,
        eventSequence: localResult.eventSequence,
        projection: buildGameProjection(
          nextSnapshot.state,
          { kind: 'player', playerId: actorId },
          metadata,
        ),
      };
      const commitResult = await this.persistence.commitCommand({
        matchId: envelope.matchId,
        actorId,
        envelope,
        envelopeFingerprint: fingerprint,
        baseStateVersion: context.match.stateVersion,
        baseEventSequence: context.match.eventSequence,
        nextState: nextSnapshot.state,
        nextTurnDeadline,
        event,
        acceptedResult,
        playerProjections: nextSnapshot.state.players.map((player) => ({
          playerId: player.id,
          projection: buildGameProjection(
            nextSnapshot.state,
            { kind: 'player', playerId: player.id },
            metadata,
          ),
        })),
      });

      return this.mapCommitResult(commitResult, envelope.commandId);
    } catch {
      return rejected('internal_error', 'The command could not be committed safely.', {
        commandId: envelope.commandId,
        currentVersion: loadedVersion,
      });
    }
  }

  private mapCommitResult(
    result: AuthoritativeCommitResult,
    commandId: string,
  ): GameCommandResult<GameProjection> {
    switch (result.status) {
      case 'committed':
        return result.result;
      case 'duplicate':
        return { ...result.result, status: 'duplicate' };
      case 'command_collision':
        return rejected('invalid_command', 'commandId was already used for a different command.', {
          commandId,
        });
      case 'match_missing':
        return rejected('match_not_playable', 'The match is not available.', { commandId });
      case 'not_participant':
        return rejected('not_participant', 'The authenticated user is not a match participant.', {
          commandId,
        });
      case 'version_conflict':
        return rejected('version_conflict', 'The match has changed. Refresh before choosing another action.', {
          commandId,
          currentVersion: result.currentVersion,
          projection: result.projection,
        });
    }
  }
}
