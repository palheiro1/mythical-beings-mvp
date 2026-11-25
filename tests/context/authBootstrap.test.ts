import { describe, expect, it, vi } from 'vitest';
import {
  scheduleAuthInitialization,
  shouldInitializeAuthImmediately,
  type AuthBootstrapScheduler,
} from '../../src/context/authBootstrap.js';

describe('auth bootstrap', () => {
  it('starts immediately on protected and callback routes', () => {
    expect(shouldInitializeAuthImmediately('/lobby')).toBe(true);
    expect(shouldInitializeAuthImmediately('/game/match-1')).toBe(true);
    expect(shouldInitializeAuthImmediately('/auth')).toBe(true);
    expect(shouldInitializeAuthImmediately('/')).toBe(false);
    expect(shouldInitializeAuthImmediately('/bot-selection')).toBe(false);
  });

  it('defers public-route initialization until the browser is idle', () => {
    const initialize = vi.fn();
    let idleCallback: IdleRequestCallback | undefined;
    const scheduler: AuthBootstrapScheduler = {
      requestIdleCallback: vi.fn((callback) => {
        idleCallback = callback;
        return 7;
      }),
      cancelIdleCallback: vi.fn(),
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
    };

    scheduleAuthInitialization(initialize, '/', scheduler);

    expect(initialize).not.toHaveBeenCalled();
    idleCallback?.({ didTimeout: false, timeRemaining: () => 10 });
    expect(initialize).toHaveBeenCalledOnce();
  });

  it('cancels idle initialization when the provider unmounts', () => {
    const initialize = vi.fn();
    let idleCallback: IdleRequestCallback | undefined;
    const cancelIdleCallback = vi.fn();
    const scheduler: AuthBootstrapScheduler = {
      requestIdleCallback: (callback) => {
        idleCallback = callback;
        return 9;
      },
      cancelIdleCallback,
      setTimeout: vi.fn(),
      clearTimeout: vi.fn(),
    };

    const cancel = scheduleAuthInitialization(initialize, '/how-to-play', scheduler);
    cancel();
    idleCallback?.({ didTimeout: false, timeRemaining: () => 10 });

    expect(cancelIdleCallback).toHaveBeenCalledWith(9);
    expect(initialize).not.toHaveBeenCalled();
  });

  it('uses a bounded timeout when requestIdleCallback is unavailable', () => {
    const initialize = vi.fn();
    let timeoutCallback: (() => void) | undefined;
    const scheduler: AuthBootstrapScheduler = {
      setTimeout: vi.fn((callback) => {
        timeoutCallback = callback;
        return 11;
      }),
      clearTimeout: vi.fn(),
    };

    scheduleAuthInitialization(initialize, '/bot-game', scheduler);

    expect(scheduler.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1_000);
    timeoutCallback?.();
    expect(initialize).toHaveBeenCalledOnce();
  });
});
