// Tests for useCardSelection hook
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCardSelection } from '../../src/hooks/useCardSelection.js';

describe('useCardSelection', () => {
  it('should initialize with empty selection', () => {
    const { result } = renderHook(() => useCardSelection({
      maxCards: 3,
      onSelectionChange: vi.fn(),
      onMaxReached: vi.fn()
    }));

    expect(result.current.getSelectionStatus()).toEqual({
      selectedCards: [],
      count: 0,
      isMaxReached: false,
      canSelectMore: true
    });
  });

  it('should add cards to selection', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() => useCardSelection({
      maxCards: 3,
      onSelectionChange,
      onMaxReached: vi.fn()
    }));

    act(() => {
      result.current.toggleCardSelection('card1');
    });

    const status = result.current.getSelectionStatus();
    expect(status.selectedCards).toContain('card1');
    expect(status.count).toBe(1);
    expect(status.canSelectMore).toBe(true);
    expect(onSelectionChange).toHaveBeenCalledWith(['card1']);
  });

  it('should remove cards from selection when toggled twice', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() => useCardSelection({
      maxCards: 3,
      onSelectionChange,
      onMaxReached: vi.fn()
    }));

    // Add card
    act(() => {
      result.current.toggleCardSelection('card1');
    });

    expect(result.current.getSelectionStatus().selectedCards).toContain('card1');

    // Remove card
    act(() => {
      result.current.toggleCardSelection('card1');
    });

    const status = result.current.getSelectionStatus();
    expect(status.selectedCards).not.toContain('card1');
    expect(status.count).toBe(0);
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it('should enforce maximum card limit', () => {
    const onMaxReached = vi.fn();
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() => useCardSelection({
      maxCards: 2,
      onSelectionChange,
      onMaxReached
    }));

    // Add first card
    act(() => {
      result.current.toggleCardSelection('card1');
    });

    // Add second card
    act(() => {
      result.current.toggleCardSelection('card2');
    });

    let status = result.current.getSelectionStatus();
    expect(status.count).toBe(2);
    expect(status.isMaxReached).toBe(true);
    expect(status.canSelectMore).toBe(false);
    expect(onMaxReached).toHaveBeenCalled();

    // Try to add third card - should not be added
    act(() => {
      result.current.toggleCardSelection('card3');
    });

    status = result.current.getSelectionStatus();
    expect(status.selectedCards).not.toContain('card3');
    expect(status.count).toBe(2);
    expect(onMaxReached).toHaveBeenCalledTimes(1); // Should only be called once
  });

  it('should validate selection correctly', () => {
    const { result } = renderHook(() => useCardSelection({
      maxCards: 3,
      onSelectionChange: vi.fn(),
      onMaxReached: vi.fn()
    }));

    // Empty selection should be invalid
    expect(result.current.validateSelection()).toBe(false);

    // Add one card
    act(() => {
      result.current.toggleCardSelection('card1');
    });

    // Single card should be valid
    expect(result.current.validateSelection()).toBe(true);

    // Add more cards
    act(() => {
      result.current.toggleCardSelection('card2');
      result.current.toggleCardSelection('card3');
    });

    // Full selection should still be valid
    expect(result.current.validateSelection()).toBe(true);
  });

  it('should handle custom validation function', () => {
    const customValidator = vi.fn((cards: string[]) => cards.length >= 2);
    const { result } = renderHook(() => useCardSelection({
      maxCards: 3,
      onSelectionChange: vi.fn(),
      onMaxReached: vi.fn(),
      customValidator
    }));

    // Should fail with less than 2 cards
    act(() => {
      result.current.toggleCardSelection('card1');
    });

    expect(result.current.validateSelection()).toBe(false);
    expect(customValidator).toHaveBeenCalledWith(['card1']);

    // Should pass with 2 or more cards
    act(() => {
      result.current.toggleCardSelection('card2');
    });

    expect(result.current.validateSelection()).toBe(true);
    expect(customValidator).toHaveBeenCalledWith(['card1', 'card2']);
  });

  it('should clear selection', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() => useCardSelection({
      maxCards: 3,
      onSelectionChange,
      onMaxReached: vi.fn()
    }));

    // Add some cards
    act(() => {
      result.current.toggleCardSelection('card1');
      result.current.toggleCardSelection('card2');
    });

    expect(result.current.getSelectionStatus().count).toBe(2);

    // Clear selection
    act(() => {
      result.current.clearSelection();
    });

    const status = result.current.getSelectionStatus();
    expect(status.selectedCards).toEqual([]);
    expect(status.count).toBe(0);
    expect(status.canSelectMore).toBe(true);
    expect(onSelectionChange).toHaveBeenLastCalledWith([]);
  });

  it('should handle duplicate card selection attempts', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() => useCardSelection({
      maxCards: 3,
      onSelectionChange,
      onMaxReached: vi.fn()
    }));

    // Add card twice
    act(() => {
      result.current.toggleCardSelection('card1');
      result.current.toggleCardSelection('card1');
    });

    // Should result in no selection (toggled on then off)
    const status = result.current.getSelectionStatus();
    expect(status.selectedCards).toEqual([]);
    expect(status.count).toBe(0);
  });

  it('should handle edge case of maxCards = 0', () => {
    const onMaxReached = vi.fn();
    const { result } = renderHook(() => useCardSelection({
      maxCards: 0,
      onSelectionChange: vi.fn(),
      onMaxReached
    }));

    const initialStatus = result.current.getSelectionStatus();
    expect(initialStatus.isMaxReached).toBe(true);
    expect(initialStatus.canSelectMore).toBe(false);

    // Try to select a card
    act(() => {
      result.current.toggleCardSelection('card1');
    });

    // Should not allow any selection
    const status = result.current.getSelectionStatus();
    expect(status.selectedCards).toEqual([]);
    expect(status.count).toBe(0);
  });

  it('should handle pre-selected cards', () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() => useCardSelection({
      maxCards: 3,
      onSelectionChange,
      onMaxReached: vi.fn(),
      initialSelection: ['card1', 'card2']
    }));

    const status = result.current.getSelectionStatus();
    expect(status.selectedCards).toEqual(['card1', 'card2']);
    expect(status.count).toBe(2);
    expect(status.canSelectMore).toBe(true);
    expect(onSelectionChange).toHaveBeenCalledWith(['card1', 'card2']);
  });
});
