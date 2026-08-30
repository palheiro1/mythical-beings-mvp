import { describe, expect, it } from 'vitest';
import {
  assertPvpEnabled,
  PVP_DISABLED_CODE,
  PVP_DISABLED_MESSAGE,
  PVP_ENABLED,
  PvpDisabledError,
  TRAINING_PREVIEW_ENABLED,
} from '../../src/config/release.js';

describe('release mode', () => {
  it('defaults public builds to the training-only preview', () => {
    expect(PVP_ENABLED).toBe(false);
    expect(TRAINING_PREVIEW_ENABLED).toBe(true);
  });

  it('blocks multiplayer service calls with a stable machine-readable error', () => {
    expect(assertPvpEnabled).toThrow(PVP_DISABLED_MESSAGE);

    try {
      assertPvpEnabled();
    } catch (error) {
      expect(error).toBeInstanceOf(PvpDisabledError);
      expect((error as PvpDisabledError).code).toBe(PVP_DISABLED_CODE);
    }
  });
});
