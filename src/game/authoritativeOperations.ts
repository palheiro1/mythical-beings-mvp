import type { PlayerGameCommand } from './protocol.js';

export const AUTHORITATIVE_OPERATION_EVENT_VERSION = 'wisdom-duel-operation-v1' as const;

export type AuthoritativeOperation = 'initialize' | 'command' | 'projection_read' | 'timeout';
export type AuthoritativeOperationOutcome =
  | 'accepted'
  | 'duplicate'
  | 'rejected'
  | 'conflict'
  | 'rate_limited'
  | 'timeout'
  | 'disabled'
  | 'internal_error';

export interface AuthoritativeOperationEventInput {
  operation: AuthoritativeOperation;
  outcome: AuthoritativeOperationOutcome;
  durationMs: number;
  occurredAt: string;
  requestId?: string;
  commandType?: PlayerGameCommand['type'];
  stateVersion?: number;
}

export interface AuthoritativeOperationEvent extends AuthoritativeOperationEventInput {
  schemaVersion: typeof AUTHORITATIVE_OPERATION_EVENT_VERSION;
}

export type AuthoritativeOperationSink = (
  event: Readonly<AuthoritativeOperationEvent>,
) => void | Promise<void>;

const REQUEST_ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/;

export function sanitizeAuthoritativeOperationEvent(
  input: AuthoritativeOperationEventInput,
): Readonly<AuthoritativeOperationEvent> {
  if (!Number.isFinite(input.durationMs) || input.durationMs < 0) {
    throw new Error('Operation duration must be a non-negative finite number.');
  }
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error('Operation timestamp must be ISO-compatible.');
  }
  if (input.requestId && !REQUEST_ID_PATTERN.test(input.requestId)) {
    throw new Error('Operation request ID must be an opaque safe identifier.');
  }
  if (
    input.stateVersion !== undefined
    && (!Number.isSafeInteger(input.stateVersion) || input.stateVersion < 0)
  ) {
    throw new Error('Operation state version must be a non-negative safe integer.');
  }

  const event: AuthoritativeOperationEvent = {
    schemaVersion: AUTHORITATIVE_OPERATION_EVENT_VERSION,
    operation: input.operation,
    outcome: input.outcome,
    durationMs: Math.round(input.durationMs * 100) / 100,
    occurredAt: new Date(input.occurredAt).toISOString(),
  };
  if (input.requestId) event.requestId = input.requestId;
  if (input.commandType) event.commandType = input.commandType;
  if (input.stateVersion !== undefined) event.stateVersion = input.stateVersion;
  return Object.freeze(event);
}

/** Observability is best-effort and can never change a game outcome. */
export async function emitAuthoritativeOperationSafely(
  sink: AuthoritativeOperationSink | undefined,
  input: AuthoritativeOperationEventInput,
): Promise<void> {
  if (!sink) return;
  try {
    await sink(sanitizeAuthoritativeOperationEvent(input));
  } catch {
    // Deliberately isolated: telemetry failure must not affect authoritative state.
  }
}
