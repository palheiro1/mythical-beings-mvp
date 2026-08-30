import { describe, expect, it } from 'vitest';
import {
  canonicalizeCommandEnvelope,
  computeCommandEnvelopeFingerprint,
} from '../../src/game/commandFingerprint.js';
import { GAME_COMMAND_PROTOCOL_VERSION, type GameCommandEnvelope } from '../../src/game/protocol.js';

const envelope: GameCommandEnvelope = {
  protocolVersion: GAME_COMMAND_PROTOCOL_VERSION,
  matchId: '018f2f9a-4e1c-7b8a-8f2c-0242ac120002',
  commandId: '018f2f9a-4e1c-7b8a-8f2c-0242ac120003',
  expectedVersion: 0,
  command: { type: 'rotate_creature', creatureId: 'lafaic' },
};

describe('authoritative command fingerprint', () => {
  it('is stable across object key order and produces a SHA-256 digest', async () => {
    const reordered = {
      command: { creatureId: 'lafaic', type: 'rotate_creature' },
      expectedVersion: 0,
      commandId: envelope.commandId,
      matchId: envelope.matchId,
      protocolVersion: envelope.protocolVersion,
    } as GameCommandEnvelope;

    expect(canonicalizeCommandEnvelope(reordered)).toBe(canonicalizeCommandEnvelope(envelope));
    await expect(computeCommandEnvelopeFingerprint(reordered)).resolves.toBe(
      await computeCommandEnvelopeFingerprint(envelope),
    );
    await expect(computeCommandEnvelopeFingerprint(envelope)).resolves.toMatch(/^[0-9a-f]{64}$/);
  });

  it('changes when the logical command changes', async () => {
    const changed: GameCommandEnvelope = { ...envelope, command: { type: 'end_turn' } };
    expect(await computeCommandEnvelopeFingerprint(changed)).not.toBe(
      await computeCommandEnvelopeFingerprint(envelope),
    );
  });
});

