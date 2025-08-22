// Tests for useRealtimeGameUpdates hook
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRealtimeGameUpdates } from '../../src/hooks/useRealtimeGameUpdates.js';
import { mockSupabase } from '../setup';

describe('useRealtimeGameUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with disconnected state', () => {
    const { result } = renderHook(() => useRealtimeGameUpdates({
      gameId: 'test-game',
      onGameUpdate: vi.fn(),
      onConnectionChange: vi.fn(),
      onError: vi.fn()
    }));

    expect(result.current.connectionState).toBe('disconnected');
    expect(result.current.retryCount).toBe(0);
  });

  it('should attempt to connect when started', async () => {
    const onConnectionChange = vi.fn();
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue({ error: null }),
      unsubscribe: vi.fn()
    };
    
    mockSupabase.channel.mockReturnValue(mockChannel);

    const { result } = renderHook(() => useRealtimeGameUpdates({
      gameId: 'test-game',
      onGameUpdate: vi.fn(),
      onConnectionChange,
      onError: vi.fn()
    }));

    await act(async () => {
      result.current.connect();
      await Promise.resolve();
    });

  // We don't assert the transient state synchronously since it may flip to connected quickly.
  expect(onConnectionChange).toHaveBeenCalledWith('connecting');
    expect(mockSupabase.channel).toHaveBeenCalledWith('game-test-game');
  });

  it('should handle successful connection', async () => {
    const onConnectionChange = vi.fn();
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue({ error: null }),
      unsubscribe: vi.fn()
    };
    
    mockSupabase.channel.mockReturnValue(mockChannel);

    const { result } = renderHook(() => useRealtimeGameUpdates({
      gameId: 'test-game',
      onGameUpdate: vi.fn(),
      onConnectionChange,
      onError: vi.fn()
    }));

    await act(async () => {
      result.current.connect();
      // Allow effect microtasks to flush
      await Promise.resolve();
    });

  expect(result.current.connectionState).toBe('connected');
  expect(onConnectionChange).toHaveBeenCalledWith('connected');
  });

  it('should handle connection errors and retry with exponential backoff', async () => {
    const onError = vi.fn();
    const onConnectionChange = vi.fn();
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      unsubscribe: vi.fn()
    };
    
    mockSupabase.channel.mockReturnValue(mockChannel);

    const { result } = renderHook(() => useRealtimeGameUpdates({
      gameId: 'test-game',
      onGameUpdate: vi.fn(),
      onConnectionChange,
      onError,
      maxRetries: 2
    }));

    await act(async () => {
      result.current.connect();
      await Promise.resolve();
    });

  expect(result.current.connectionState).toBe('reconnecting');
  expect(result.current.retryCount).toBe(1);
  expect(onError).toHaveBeenCalled();

    // Fast forward to trigger retry
    await act(async () => {
      vi.advanceTimersByTime(1000); // First retry after 1 second
      await Promise.resolve();
    });

  expect(result.current.retryCount).toBe(2);
  });

  it('should fallback to polling after max retries', async () => {
    const onConnectionChange = vi.fn();
    const onGameUpdate = vi.fn();
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      unsubscribe: vi.fn()
    };
    
    mockSupabase.channel.mockReturnValue(mockChannel);
    
    // Mock successful polling response
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'test-game', status: 'active' },
            error: null
          })
        })
      })
    });

    const { result } = renderHook(() => useRealtimeGameUpdates({
      gameId: 'test-game',
      onGameUpdate,
      onConnectionChange,
      onError: vi.fn(),
      maxRetries: 1,
      pollingInterval: 1000
    }));

    await act(async () => {
      result.current.connect();
      await Promise.resolve();
    });

    // Fast forward through all retries
    await act(async () => {
      vi.advanceTimersByTime(5000);
      await Promise.resolve();
    });

  expect(result.current.connectionState).toBe('polling');
  expect(onConnectionChange).toHaveBeenCalledWith('polling');

    // Fast forward to trigger polling
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(onGameUpdate).toHaveBeenCalledWith({ id: 'test-game', status: 'active' });
  });

  it('should handle game update messages', () => {
    const onGameUpdate = vi.fn();
    const mockChannel = {
      on: vi.fn().mockImplementation((event, callback) => {
        if (event === 'postgres_changes') {
          // Simulate receiving a game update
          setTimeout(() => {
            callback({
              eventType: 'UPDATE',
              new: { id: 'test-game', status: 'updated' }
            });
          }, 100);
        }
        return mockChannel;
      }),
      subscribe: vi.fn().mockResolvedValue({ error: null }),
      unsubscribe: vi.fn()
    };
    
    mockSupabase.channel.mockReturnValue(mockChannel);

    renderHook(() => useRealtimeGameUpdates({
      gameId: 'test-game',
      onGameUpdate,
      onConnectionChange: vi.fn(),
      onError: vi.fn()
    }));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onGameUpdate).toHaveBeenCalledWith({ id: 'test-game', status: 'updated' });
  });

  it('should disconnect and cleanup properly', () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue({ error: null }),
      unsubscribe: vi.fn()
    };
    
    mockSupabase.channel.mockReturnValue(mockChannel);

    const { result } = renderHook(() => useRealtimeGameUpdates({
      gameId: 'test-game',
      onGameUpdate: vi.fn(),
      onConnectionChange: vi.fn(),
      onError: vi.fn()
    }));

    act(() => {
      result.current.connect();
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.connectionState).toBe('disconnected');
    expect(mockChannel.unsubscribe).toHaveBeenCalled();
  });

  it('should cleanup on unmount', () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue({ error: null }),
      unsubscribe: vi.fn()
    };
    
    mockSupabase.channel.mockReturnValue(mockChannel);

    const { result, unmount } = renderHook(() => useRealtimeGameUpdates({
      gameId: 'test-game',
      onGameUpdate: vi.fn(),
      onConnectionChange: vi.fn(),
      onError: vi.fn()
    }));

    act(() => {
      result.current.connect();
    });

    unmount();

    expect(mockChannel.unsubscribe).toHaveBeenCalled();
  });

  it('should handle rapid connect/disconnect cycles gracefully', () => {
    const mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockResolvedValue({ error: null }),
      unsubscribe: vi.fn()
    };
    
    mockSupabase.channel.mockReturnValue(mockChannel);

    const { result } = renderHook(() => useRealtimeGameUpdates({
      gameId: 'test-game',
      onGameUpdate: vi.fn(),
      onConnectionChange: vi.fn(),
      onError: vi.fn()
    }));

    // Rapid connect/disconnect
    act(() => {
      result.current.connect();
      result.current.disconnect();
      result.current.connect();
      result.current.disconnect();
    });

    expect(result.current.connectionState).toBe('disconnected');
    expect(mockChannel.unsubscribe).toHaveBeenCalled();
  });
});
