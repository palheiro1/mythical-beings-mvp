import { useState, useCallback, useEffect } from 'react';

export interface UseCardSelectionOptions {
  maxCards: number;
  onSelectionChange?: (selectedCards: string[]) => void;
  onMaxReached?: () => void;
  customValidator?: (selectedCards: string[]) => boolean;
  initialSelection?: string[];
}

export interface SelectionStatus {
  selectedCards: string[];
  count: number;
  isMaxReached: boolean;
  canSelectMore: boolean;
  maxCards?: number;
  remaining?: number;
  percentage?: number;
  isComplete?: boolean;
}

export function useCardSelection(options: UseCardSelectionOptions) {
  const {
    maxCards,
    onSelectionChange,
    onMaxReached,
    customValidator,
    initialSelection = []
  } = options;

  const [selectedCards, setSelectedCards] = useState<string[]>(initialSelection);
  const [hasReachedMax, setHasReachedMax] = useState(false);

  // Call onSelectionChange when selection changes
  useEffect(() => {
    onSelectionChange?.(selectedCards);
  }, [selectedCards, onSelectionChange]);

  // Check if max is reached and call callback
  useEffect(() => {
    const isMaxReached = selectedCards.length >= maxCards;
    if (isMaxReached && !hasReachedMax && selectedCards.length > 0) {
      setHasReachedMax(true);
      onMaxReached?.();
    } else if (!isMaxReached) {
      setHasReachedMax(false);
    }
  }, [selectedCards.length, maxCards, hasReachedMax, onMaxReached]);

  const toggleCardSelection = useCallback((cardId: string) => {
    setSelectedCards(prev => {
      const isSelected = prev.includes(cardId);
      
      if (isSelected) {
        // Remove card
        return prev.filter(id => id !== cardId);
      } else {
        // Add card if not at max limit
        if (prev.length >= maxCards) {
          return prev; // Don't add if at max
        }
        return [...prev, cardId];
      }
    });
  }, [maxCards]);

  const clearSelection = useCallback(() => {
    setSelectedCards([]);
  }, []);

  const validateSelection = useCallback(() => {
    if (customValidator) {
      return customValidator(selectedCards);
    }
    
    // Default validation: at least one card must be selected
    return selectedCards.length > 0;
  }, [selectedCards, customValidator]);

  const getSelectionStatus = useCallback((): SelectionStatus => {
    const count = selectedCards.length;
    const isMaxReached = count >= maxCards;
    const canSelectMore = count < maxCards;

    return {
      selectedCards: [...selectedCards],
      count,
      isMaxReached,
      canSelectMore
    };
  }, [selectedCards, maxCards]);

  return {
    toggleCardSelection,
    clearSelection,
    validateSelection,
    getSelectionStatus
  };
}