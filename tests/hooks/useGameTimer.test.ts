// Tests for useGameTimer hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameTimer } from '../../src/hooks/useGameTimer.js';

describe('useGameTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with provided initial time', () => {
    const { result } = renderHook(() => useGameTimer({
      initialTime: 60,
      onTimeUpdate: vi.fn(),
      onTimeExpired: vi.fn()
    }));

    expect(result.current.timeLeft).toBe(60);
    expect(result.current.isActive).toBe(false);
  });

  it('should start and decrement timer correctly', () => {
    const onTimeUpdate = vi.fn();
    const { result } = renderHook(() => useGameTimer({
      initialTime: 10,
      onTimeUpdate,
      onTimeExpired: vi.fn()
    }));

    act(() => {
      result.current.start();
    });

    expect(result.current.isActive).toBe(true);

    // Advance time by 1 second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.timeLeft).toBe(9);
    expect(onTimeUpdate).toHaveBeenCalledWith(9);
  });

  it('should call onTimeExpired when timer reaches 0', () => {
    const onTimeExpired = vi.fn();
    const { result } = renderHook(() => useGameTimer({
      initialTime: 2,
      onTimeUpdate: vi.fn(),
      onTimeExpired
    }));

    act(() => {
      result.current.start();
    });

    // Advance time by 2 seconds to reach 0
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.timeLeft).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(onTimeExpired).toHaveBeenCalled();
  });

  it('should pause and resume timer correctly', () => {
    const { result } = renderHook(() => useGameTimer({
      initialTime: 10,
      onTimeUpdate: vi.fn(),
      onTimeExpired: vi.fn()
    }));

    // Start timer
    act(() => {
      result.current.start();
    });

    // Advance 2 seconds
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.timeLeft).toBe(8);

    // Pause timer
    act(() => {
      result.current.pause();
    });

    expect(result.current.isActive).toBe(false);

    // Advance time while paused
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Time should not have changed while paused
    expect(result.current.timeLeft).toBe(8);

    // Resume timer
    act(() => {
      result.current.start();
    });

    expect(result.current.isActive).toBe(true);

    // Advance 1 more second
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.timeLeft).toBe(7);
  });

  it('should reset timer to initial time', () => {
    const { result } = renderHook(() => useGameTimer({
      initialTime: 15,
      onTimeUpdate: vi.fn(),
      onTimeExpired: vi.fn()
    }));

    // Start and run timer
    act(() => {
      result.current.start();
    });

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.timeLeft).toBe(10);

    // Reset timer
    act(() => {
      result.current.reset();
    });

    expect(result.current.timeLeft).toBe(15);
    expect(result.current.isActive).toBe(false);
  });

  it('should handle stop correctly', () => {
    const { result } = renderHook(() => useGameTimer({
      initialTime: 10,
      onTimeUpdate: vi.fn(),
      onTimeExpired: vi.fn()
    }));

    act(() => {
      result.current.start();
    });

    expect(result.current.isActive).toBe(true);

    act(() => {
      result.current.stop();
    });

    expect(result.current.isActive).toBe(false);

    // Timer should not continue after stop
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.timeLeft).toBe(10); // Should remain unchanged
  });

  it('should handle setTime correctly', () => {
    const onTimeUpdate = vi.fn();
    const { result } = renderHook(() => useGameTimer({
      initialTime: 10,
      onTimeUpdate,
      onTimeExpired: vi.fn()
    }));

    act(() => {
      result.current.setTime(25);
    });

    expect(result.current.timeLeft).toBe(25);
    expect(onTimeUpdate).toHaveBeenCalledWith(25);
  });

  it('should cleanup interval on unmount', () => {
    const { result, unmount } = renderHook(() => useGameTimer({
      initialTime: 10,
      onTimeUpdate: vi.fn(),
      onTimeExpired: vi.fn()
    }));

    act(() => {
      result.current.start();
    });

    expect(result.current.isActive).toBe(true);

    // Unmount component
    unmount();

    // Timer should be cleaned up and no longer active
    // Note: We can't directly test if interval is cleared, but we can verify
    // that advancing time doesn't cause any issues
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // No errors should occur from the cleanup
  });

  it('should not go below 0', () => {
    const onTimeExpired = vi.fn();
    const { result } = renderHook(() => useGameTimer({
      initialTime: 1,
      onTimeUpdate: vi.fn(),
      onTimeExpired
    }));

    act(() => {
      result.current.start();
    });

    // Advance more time than available
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.timeLeft).toBe(0);
    expect(result.current.isActive).toBe(false);
    expect(onTimeExpired).toHaveBeenCalledTimes(1);
  });
});
