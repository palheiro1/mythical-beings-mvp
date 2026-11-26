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
    vi.stubEnv('VITE_ENABLE_WEEKLY_CHALLENGE', undefined);
    vi.stubEnv('VITE_ENABLE_CASUAL_DUELS', undefined);
    const release = await import('../../src/config/release.js');
    expect(release.PVP_ENABLED).toBe(false);
    expect(release.WEEKLY_CHALLENGE_ENABLED).toBe(false);
    expect(release.CASUAL_DUELS_ENABLED).toBe(false);
    expect(release.TRAINING_PREVIEW_ENABLED).toBe(true);
  });

  it('only enables competition with an explicit true flag', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_PVP', ' TRUE ');
    const release = await import('../../src/config/release.js');
    expect(release.PVP_ENABLED).toBe(true);
    expect(release.CASUAL_DUELS_ENABLED).toBe(true);
    expect(release.TRAINING_PREVIEW_ENABLED).toBe(false);
    expect(release.assertPvpEnabled).not.toThrow();
  });

  it('shows the weekly challenge independently of the funded league and wagers', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_ENABLE_PVP', 'false');
    vi.stubEnv('VITE_ENABLE_WEEKLY_CHALLENGE', 'true');
    const release = await import('../../src/config/release.js');
    expect(release.WEEKLY_CHALLENGE_ENABLED).toBe(true);
    expect(release.PVP_ENABLED).toBe(false);
    expect(release.TRAINING_PREVIEW_ENABLED).toBe(true);
  });

  it('opens private invitations independently of funded competition', async () => {
    vi.stubEnv('VITE_ENABLE_PVP', 'false');
    vi.stubEnv('VITE_ENABLE_CASUAL_DUELS', 'true');
    const release = await import('../../src/config/release.js');
    expect(release.CASUAL_DUELS_ENABLED).toBe(true);
    expect(release.PVP_ENABLED).toBe(false);
    expect(release.TRAINING_PREVIEW_ENABLED).toBe(true);
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
