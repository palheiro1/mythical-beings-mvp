import type { AuthoritativeTransportErrorCode } from './authoritativeHttp.js';
import type { AuthoritativeProjectionTransportCode } from './authoritativeProjectionHttp.js';
import {
  GAME_COMMAND_PROTOCOL_VERSION,
  type GameCommandRejectionCode,
  type GameCommandResult,
  type GameCommandEnvelope,
  type PlayerGameCommand,
  validateGameCommandEnvelope,
} from './protocol.js';
import type { GameProjection } from './projections.js';
import { isGameProjectionWire } from './projectionWire.js';

export type AuthoritativeClientErrorCode =
  | GameCommandRejectionCode
  | AuthoritativeTransportErrorCode
  | AuthoritativeProjectionTransportCode
  | 'network_error'
  | 'invalid_response';

export type AuthoritativeClientStatus =
  | 'idle'
  | 'reconnecting'
  | 'ready'
  | 'sending'
  | 'retryable'
  | 'conflict'
  | 'rejected'
  | 'disconnected'
  | 'unavailable';

export interface AuthoritativeClientError {
  code: AuthoritativeClientErrorCode;
  message: string;
  retryAfterSeconds?: number;
}

export interface AuthoritativePendingCommand {
  commandId: string;
  commandType: PlayerGameCommand['type'];
  expectedVersion: number;
  attempts: number;
}

export interface AuthoritativeClientState {
  status: AuthoritativeClientStatus;
  projection: GameProjection | null;
  pendingCommand: AuthoritativePendingCommand | null;
  lastOutcome: 'accepted' | 'duplicate' | null;
  lastError: AuthoritativeClientError | null;
}

export type AuthoritativeClientCommandResponse =
  | GameCommandResult<GameProjection>
  | {
      status: 'rejected';
      code: AuthoritativeClientErrorCode;
      message: string;
      commandId?: string;
      retryAfterSeconds?: number;
      currentVersion?: number;
      projection?: GameProjection;
    };

export type AuthoritativeClientProjectionResponse =
  | { status: 'ok'; projection: GameProjection }
  | {
      status: 'rejected';
      code: AuthoritativeClientErrorCode;
      message: string;
      retryAfterSeconds?: number;
    };

export interface AuthoritativeClientTransport {
  readProjection(
    matchId: string,
    signal?: AbortSignal,
  ): Promise<AuthoritativeClientProjectionResponse>;
  sendCommand(
    envelope: GameCommandEnvelope,
    signal?: AbortSignal,
  ): Promise<AuthoritativeClientCommandResponse>;
}

export interface AuthoritativeGameClientOptions {
  matchId: string;
  transport: AuthoritativeClientTransport;
  createCommandId: () => string;
}

type StateListener = (state: AuthoritativeClientState) => void;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const RETRYABLE_COMMAND_CODES = new Set<AuthoritativeClientErrorCode>([
  'operation_timeout',
  'rate_limited',
  'internal_error',
  'network_error',
  'invalid_response',
]);

const UNAVAILABLE_CODES = new Set<AuthoritativeClientErrorCode>([
  'multiplayer_disabled',
  'unauthorized',
  'not_participant',
  'match_not_playable',
  'origin_not_allowed',
]);

const cloneProjection = (projection: GameProjection): GameProjection => structuredClone(projection);

export class AuthoritativeGameClient {
  private readonly matchId: string;
  private readonly transport: AuthoritativeClientTransport;
  private readonly createCommandId: () => string;
  private readonly listeners = new Set<StateListener>();
  private operationSequence = 0;
  private pendingEnvelope: GameCommandEnvelope | null = null;
  private pendingAttempts = 0;
  private state: AuthoritativeClientState = {
    status: 'idle',
    projection: null,
    pendingCommand: null,
    lastOutcome: null,
    lastError: null,
  };

  constructor(options: AuthoritativeGameClientOptions) {
    if (!UUID_PATTERN.test(options.matchId)) throw new Error('Authoritative client matchId must be a UUID.');
    this.matchId = options.matchId;
    this.transport = options.transport;
    this.createCommandId = options.createCommandId;
  }

  getState(): AuthoritativeClientState {
    return structuredClone(this.state);
  }

  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    this.notifyOne(listener);
    return () => { this.listeners.delete(listener); };
  }

  async reconnect(signal?: AbortSignal): Promise<AuthoritativeClientState> {
    if (this.pendingEnvelope) {
      throw new Error('Cannot reconnect while a command outcome is unresolved. Retry it first.');
    }
    const operation = ++this.operationSequence;
    this.setState({ status: 'reconnecting', lastOutcome: null, lastError: null });

    let response: AuthoritativeClientProjectionResponse;
    try {
      response = await this.transport.readProjection(this.matchId, signal);
    } catch {
      if (operation === this.operationSequence) {
        this.setState({
          status: 'disconnected',
          lastError: {
            code: 'network_error',
            message: 'The current match projection could not be reached.',
          },
        });
      }
      return this.getState();
    }

    if (response.status === 'ok') {
      const projection = this.selectProjection(response.projection);
      if (!projection) {
        if (operation === this.operationSequence) this.setInvalidResponse('Projection response is invalid.');
        return this.getState();
      }
      if (operation === this.operationSequence) {
        this.setState({ status: 'ready', projection, lastError: null });
      }
      return this.getState();
    }

    if (operation === this.operationSequence) {
      this.setState({
        status: UNAVAILABLE_CODES.has(response.code) ? 'unavailable' : 'disconnected',
        lastError: this.toClientError(response),
      });
    }
    return this.getState();
  }

  async send(
    command: PlayerGameCommand,
    signal?: AbortSignal,
  ): Promise<AuthoritativeClientState> {
    if (!this.state.projection || this.state.status === 'reconnecting') {
      throw new Error('Reconnect before sending an authoritative command.');
    }
    if (this.pendingEnvelope) {
      throw new Error('A command outcome is unresolved. Retry that command before sending another.');
    }

    const envelope: GameCommandEnvelope = {
      protocolVersion: GAME_COMMAND_PROTOCOL_VERSION,
      matchId: this.matchId,
      commandId: this.createCommandId(),
      expectedVersion: this.state.projection.stateVersion,
      command: structuredClone(command),
    };
    const validation = validateGameCommandEnvelope(envelope);
    if (!validation.valid) throw new Error(`Cannot send command: ${validation.reason}`);

    this.pendingEnvelope = validation.value;
    this.pendingAttempts = 1;
    return this.dispatchPending(signal);
  }

  async retry(signal?: AbortSignal): Promise<AuthoritativeClientState> {
    if (this.state.status !== 'retryable' || !this.pendingEnvelope) {
      throw new Error('There is no retryable authoritative command.');
    }
    this.pendingAttempts += 1;
    return this.dispatchPending(signal);
  }

  private async dispatchPending(signal?: AbortSignal): Promise<AuthoritativeClientState> {
    const envelope = this.pendingEnvelope;
    if (!envelope) throw new Error('Pending authoritative command is missing.');
    const operation = ++this.operationSequence;
    this.setState({
      status: 'sending',
      pendingCommand: this.pendingMetadata(),
      lastOutcome: null,
      lastError: null,
    });

    let response: AuthoritativeClientCommandResponse;
    try {
      response = await this.transport.sendCommand(structuredClone(envelope), signal);
    } catch {
      if (operation === this.operationSequence) {
        this.setState({
          status: 'retryable',
          pendingCommand: this.pendingMetadata(),
          lastError: {
            code: 'network_error',
            message: 'The command response was not received. Retry the same command.',
          },
        });
      }
      return this.getState();
    }

    if (operation !== this.operationSequence) return this.getState();
    return this.applyCommandResponse(envelope, response);
  }

  private applyCommandResponse(
    envelope: GameCommandEnvelope,
    response: AuthoritativeClientCommandResponse,
  ): AuthoritativeClientState {
    if (response.status !== 'rejected') {
      const projection = this.selectProjection(response.projection);
      if (
        response.commandId !== envelope.commandId
        || response.stateVersion <= envelope.expectedVersion
        || response.projection.stateVersion !== response.stateVersion
        || response.projection.eventSequence !== response.eventSequence
        || !projection
      ) {
        this.setInvalidCommandResponse();
        return this.getState();
      }
      this.clearPending();
      this.setState({
        status: 'ready',
        projection,
        pendingCommand: null,
        lastOutcome: response.status,
        lastError: null,
      });
      return this.getState();
    }

    if (response.code === 'version_conflict') {
      const projection = response.projection && this.selectProjection(response.projection);
      if (
        !projection
        || response.currentVersion !== response.projection?.stateVersion
      ) {
        this.setInvalidCommandResponse();
        return this.getState();
      }
      this.clearPending();
      this.setState({
        status: 'conflict',
        projection,
        pendingCommand: null,
        lastError: this.toClientError(response),
      });
      return this.getState();
    }

    if (RETRYABLE_COMMAND_CODES.has(response.code)) {
      this.setState({
        status: 'retryable',
        pendingCommand: this.pendingMetadata(),
        lastError: this.toClientError(response),
      });
      return this.getState();
    }

    this.clearPending();
    this.setState({
      status: UNAVAILABLE_CODES.has(response.code) ? 'unavailable' : 'rejected',
      pendingCommand: null,
      lastError: this.toClientError(response),
    });
    return this.getState();
  }

  private selectProjection(incoming: GameProjection): GameProjection | null {
    if (
      !isGameProjectionWire(incoming)
      || incoming.matchId !== this.matchId
    ) {
      return null;
    }
    const current = this.state.projection;
    if (
      current
      && (
        incoming.stateVersion < current.stateVersion
        || incoming.eventSequence < current.eventSequence
      )
    ) {
      return cloneProjection(current);
    }
    return cloneProjection(incoming);
  }

  private pendingMetadata(): AuthoritativePendingCommand | null {
    if (!this.pendingEnvelope) return null;
    return {
      commandId: this.pendingEnvelope.commandId,
      commandType: this.pendingEnvelope.command.type,
      expectedVersion: this.pendingEnvelope.expectedVersion,
      attempts: this.pendingAttempts,
    };
  }

  private clearPending(): void {
    this.pendingEnvelope = null;
    this.pendingAttempts = 0;
  }

  private setInvalidCommandResponse(): void {
    this.setState({
      status: 'retryable',
      pendingCommand: this.pendingMetadata(),
      lastError: {
        code: 'invalid_response',
        message: 'The command response was inconsistent. Retry the same command.',
      },
    });
  }

  private setInvalidResponse(message: string): void {
    this.setState({
      status: 'disconnected',
      lastError: { code: 'invalid_response', message },
    });
  }

  private toClientError(response: {
    code: AuthoritativeClientErrorCode;
    message: string;
    retryAfterSeconds?: number;
  }): AuthoritativeClientError {
    const error: AuthoritativeClientError = {
      code: response.code,
      message: response.message,
    };
    if (response.retryAfterSeconds !== undefined) {
      error.retryAfterSeconds = Math.max(1, Math.floor(response.retryAfterSeconds));
    }
    return error;
  }

  private setState(changes: Partial<AuthoritativeClientState>): void {
    this.state = {
      ...this.state,
      ...changes,
      projection: changes.projection === undefined
        ? this.state.projection
        : changes.projection && cloneProjection(changes.projection),
    };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) this.notifyOne(listener);
  }

  private notifyOne(listener: StateListener): void {
    try {
      listener(this.getState());
    } catch {
      // Client observers cannot change transport or state-machine outcomes.
    }
  }
}
