import { describe, expect, it } from 'vitest';
import {
  createTelemetryPayload,
  normalizeTelemetryRoute,
  sanitizeTelemetryValue,
} from '../../src/utils/telemetry.js';

describe('privacy-safe telemetry', () => {
  it('redacts sensitive keys and identifiers recursively', () => {
    const sanitized = sanitizeTelemetryValue({
      email: 'player@example.com',
      walletAddress: '0x1111111111111111111111111111111111111111',
      nested: {
        message: 'user 018f2f9a-4e1c-7b8a-8f2c-0242ac120002 failed',
        state: { winner: 'player-1' },
      },
    });

    expect(sanitized).toEqual({
      email: '[redacted]',
      walletAddress: '[redacted]',
      nested: {
        message: 'user [redacted-id] failed',
        state: '[redacted]',
      },
    });
  });

  it('normalizes session ids, wallet addresses and invite codes in routes', () => {
    expect(normalizeTelemetryRoute('/game/018f2f9a-4e1c-7b8a-8f2c-0242ac120002')).toBe('/game/:id');
    expect(normalizeTelemetryRoute('/wallet/0x1111111111111111111111111111111111111111')).toBe('/wallet/:address');
    expect(normalizeTelemetryRoute('/join/ABC123')).toBe('/join/:code');
  });

  it('adds build traceability without query strings or personal state', () => {
    const payload = createTelemetryPayload('application_error', {
      source: 'test',
      hand: ['secret-card'],
    }, '/game/018f2f9a-4e1c-7b8a-8f2c-0242ac120002');

    expect(payload).toMatchObject({
      schema: 'wisdom-duel-telemetry-v1',
      kind: 'application_error',
      route: '/game/:id',
      data: { source: 'test', hand: '[redacted]' },
    });
    expect(payload.appVersion).toBeTruthy();
    expect(payload.buildSha).toBeTruthy();
  });
});
