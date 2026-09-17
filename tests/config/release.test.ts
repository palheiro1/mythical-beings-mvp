import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  assertPvpEnabled,
  PVP_DISABLED_CODE,
  PVP_DISABLED_MESSAGE,
  PVP_ENABLED,
  PvpDisabledError,
  TRAINING_PREVIEW_ENABLED,
} from '../../src/config/release.js';

describe('release mode', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

  it('keeps practice public when no release flag is configured', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_PVP', undefined);
    const release = await import('../../src/config/release.js');
    expect(release.PVP_ENABLED).toBe(false);
    expect(release.TRAINING_PREVIEW_ENABLED).toBe(true);
  });

  it('only enables competition with an explicit true flag', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_PVP', ' TRUE ');
    const release = await import('../../src/config/release.js');
    expect(release.PVP_ENABLED).toBe(true);
    expect(release.TRAINING_PREVIEW_ENABLED).toBe(false);
    expect(release.assertPvpEnabled).not.toThrow();
  });

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
