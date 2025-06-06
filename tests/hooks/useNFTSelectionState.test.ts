// Tests for useNFTSelectionState hook
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useNFTSelectionState } from '../../src/hooks/useNFTSelectionState.js';

describe('useNFTSelectionState', () => {
  it('should initialize with default state', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    expect(result.current.state).toEqual({
      selected: [],
      timer: 60,
      waiting: false,
      lost: false,
      isLoadingHand: false,
      dealtCreatures: [],
      error: null,
      isConfirming: false,
      realtimeFailed: false
    });
  });

  it('should update selected cards', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.setSelected(['card1', 'card2']);
    });
    
    expect(result.current.state.selected).toEqual(['card1', 'card2']);
  });

  it('should toggle card selection', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.toggleCard('card1');
    });
    
    expect(result.current.state.selected).toEqual(['card1']);
    
    act(() => {
      result.current.actions.toggleCard('card1');
    });
    
    expect(result.current.state.selected).toEqual([]);
  });

  it('should decrement timer', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.decrementTimer();
    });
    
    expect(result.current.state.timer).toBe(59);
  });

  it('should reset timer', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.decrementTimer();
      result.current.actions.decrementTimer();
    });
    
    expect(result.current.state.timer).toBe(58);
    
    act(() => {
      result.current.actions.resetTimer(30);
    });
    
    expect(result.current.state.timer).toBe(30);
  });

  it('should set waiting state', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.setWaiting(true);
    });
    
    expect(result.current.state.waiting).toBe(true);
  });

  it('should set lost state', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.setLost(true);
    });
    
    expect(result.current.state.lost).toBe(true);
  });

  it('should set loading hand state', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.setLoadingHand(true);
    });
    
    expect(result.current.state.isLoadingHand).toBe(true);
  });

  it('should set dealt creatures', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    const mockCreatures = [
      { 
        id: '1', 
        name: 'Test Creature', 
        image: 'test.jpg',
        element: 'water' as const,
        passiveAbility: 'Test passive ability',
        baseWisdom: 5
      }
    ];
    
    act(() => {
      result.current.actions.setDealtCreatures(mockCreatures);
    });
    
    expect(result.current.state.dealtCreatures).toEqual(mockCreatures);
  });

  it('should set error state', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    const errorMessage = 'Test error';
    
    act(() => {
      result.current.actions.setError(errorMessage);
    });
    
    expect(result.current.state.error).toBe(errorMessage);
  });

  it('should clear error state', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.setError('Test error');
    });
    
    expect(result.current.state.error).toBe('Test error');
    
    act(() => {
      result.current.actions.clearError();
    });
    
    expect(result.current.state.error).toBe(null);
  });

  it('should set confirming state', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.setConfirming(true);
    });
    
    expect(result.current.state.isConfirming).toBe(true);
  });

  it('should set realtime failed state', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.setRealtimeFailed(true);
    });
    
    expect(result.current.state.realtimeFailed).toBe(true);
  });

  it('should reset state', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    // Modify some state
    act(() => {
      result.current.actions.setSelected(['card1']);
      result.current.actions.setWaiting(true);
      result.current.actions.setError('Test error');
    });
    
    expect(result.current.state.selected).toEqual(['card1']);
    expect(result.current.state.waiting).toBe(true);
    expect(result.current.state.error).toBe('Test error');
    
    // Reset state
    act(() => {
      result.current.actions.resetState();
    });
    
    expect(result.current.state).toEqual({
      selected: [],
      timer: 60,
      waiting: false,
      lost: false,
      isLoadingHand: false,
      dealtCreatures: [],
      error: null,
      isConfirming: false,
      realtimeFailed: false
    });
  });

  it('should handle multiple card toggles correctly', () => {
    const { result } = renderHook(() => useNFTSelectionState());
    
    act(() => {
      result.current.actions.toggleCard('card1');
      result.current.actions.toggleCard('card2');
      result.current.actions.toggleCard('card3');
    });
    
    expect(result.current.state.selected).toEqual(['card1', 'card2', 'card3']);
    
    act(() => {
      result.current.actions.toggleCard('card2');
    });
    
    expect(result.current.state.selected).toEqual(['card1', 'card3']);
  });
});
