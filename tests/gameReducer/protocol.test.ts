import { describe, expect, it } from 'vitest';
import {
  GAME_COMMAND_PROTOCOL_VERSION,
  validateGameCommandEnvelope,
} from '../../src/game/protocol.js';

const validEnvelope = {
  protocolVersion: GAME_COMMAND_PROTOCOL_VERSION,
  matchId: '018f2f9a-4e1c-7b8a-8f2c-0242ac120002',
  commandId: '018f2f9a-4e1c-7b8a-8f2c-0242ac120003',
  expectedVersion: 7,
  command: { type: 'rotate_creature', creatureId: 'lafaic' },
};

describe('authoritative command protocol', () => {
  it('accepts a versioned, idempotent player command', () => {
    expect(validateGameCommandEnvelope(validEnvelope)).toEqual({ valid: true, value: validEnvelope });
  });

  it('rejects client identity and full-state injection fields', () => {
    expect(validateGameCommandEnvelope({
      ...validEnvelope,
      command: {
        type: 'rotate_creature',
        creatureId: 'lafaic',
        playerId: 'forged-player',
        state: { winner: 'forged-player' },
      },
    })).toMatchObject({ valid: false });
  });

  it.each([
    { ...validEnvelope, expectedVersion: -1 },
    { ...validEnvelope, expectedVersion: 1.5 },
    { ...validEnvelope, commandId: 'retry-me' },
    { ...validEnvelope, command: { type: 'SET_GAME_STATE', state: {} } },
    { ...validEnvelope, command: { type: 'resolve_pending_effect', effectId: 'effect-1' } },
    { ...validEnvelope, command: { type: 'resolve_pending_effect', effectId: 'effect-1', choiceKey: 'choice-1', skip: true } },
  ])('rejects an invalid or ambiguous command %#', (value) => {
    expect(validateGameCommandEnvelope(value)).toMatchObject({ valid: false });
  });
});
