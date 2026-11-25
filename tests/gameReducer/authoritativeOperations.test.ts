import { describe, expect, it, vi } from 'vitest';
import {
  emitAuthoritativeOperationSafely,
  sanitizeAuthoritativeOperationEvent,
  type AuthoritativeOperationEventInput,
} from '../../src/game/authoritativeOperations.js';

describe('authoritative operational events', () => {
  it('keeps only a fixed non-sensitive schema', () => {
    const hostileInput = {
      operation: 'command',
      outcome: 'accepted',
      durationMs: 12.3456,
      occurredAt: '2026-08-28T12:00:00.000Z',
      requestId: 'request_test-1',
      commandType: 'rotate_creature',
      stateVersion: 3,
      token: 'secret-jwt',
      actorId: 'player-private',
      matchId: 'match-private',
      seedHex: 'aa'.repeat(32),
      payload: { hand: ['private-card'] },
    } as AuthoritativeOperationEventInput & Record<string, unknown>;

    const event = sanitizeAuthoritativeOperationEvent(hostileInput);
    expect(event).toEqual({
      schemaVersion: 'wisdom-duel-operation-v1',
      operation: 'command',
      outcome: 'accepted',
      durationMs: 12.35,
      occurredAt: '2026-08-28T12:00:00.000Z',
      requestId: 'request_test-1',
      commandType: 'rotate_creature',
      stateVersion: 3,
    });
    expect(JSON.stringify(event)).not.toMatch(/secret-jwt|player-private|match-private|private-card/);
    expect(Object.isFrozen(event)).toBe(true);
  });

  it('rejects unsafe request IDs and invalid metrics', () => {
    const valid = {
      operation: 'projection_read' as const,
      outcome: 'rejected' as const,
      durationMs: 1,
      occurredAt: '2026-08-28T12:00:00.000Z',
    };

    expect(() => sanitizeAuthoritativeOperationEvent({
      ...valid,
      requestId: 'request with spaces',
    })).toThrow('opaque safe identifier');
    expect(() => sanitizeAuthoritativeOperationEvent({
      ...valid,
      durationMs: Number.NaN,
    })).toThrow('non-negative finite');
  });

  it('never lets an observability failure change the caller outcome', async () => {
    const sink = vi.fn(async () => { throw new Error('collector unavailable'); });
    await expect(emitAuthoritativeOperationSafely(sink, {
      operation: 'initialize',
      outcome: 'internal_error',
      durationMs: 4,
      occurredAt: '2026-08-28T12:00:00.000Z',
    })).resolves.toBeUndefined();
    expect(sink).toHaveBeenCalledOnce();
  });
});

