// Accessibility utilities and improvements for NFT Selection
import React from 'react';

// ARIA labels and descriptions
export const ARIA_LABELS = {
  cardGrid: 'Available cards for selection',
  selectedCards: 'Currently selected cards',
  card: (cardName: string, isSelected: boolean) => 
    `${cardName} card, ${isSelected ? 'selected' : 'not selected'}`,
  timer: (timeLeft: number) => 
    `Time remaining: ${timeLeft} seconds`,
  confirmButton: 'Confirm card selection',
  clearSelection: 'Clear all selected cards',
  connectionStatus: (status: string) => 
    `Connection status: ${status}`,
  loadingCards: 'Loading available cards',
  errorMessage: 'Error message'
} as const;

// Keyboard navigation hook
export const useKeyboardNavigation = (
  cards: Array<{ id: string; name: string }>,
  selectedCards: string[],
  onToggleCard: (cardId: string) => void,
  onConfirm?: () => void,
  onClear?: () => void
) => {
  const [focusedIndex, setFocusedIndex] = React.useState(0);
  const gridRef = React.useRef<HTMLDivElement>(null);

  const handleKeyDown = React.useCallback((event: KeyboardEvent) => {
    if (!cards.length) return;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        setFocusedIndex(prev => (prev + 1) % cards.length);
        break;
      
      case 'ArrowLeft':
        event.preventDefault();
        setFocusedIndex(prev => (prev - 1 + cards.length) % cards.length);
        break;
      
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 3, cards.length - 1)); // Assuming 3 cards per row
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 3, 0));
        break;
      
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (focusedIndex < cards.length) {
          onToggleCard(cards[focusedIndex].id);
        }
        break;
      
      case 'Escape':
        event.preventDefault();
        onClear?.();
        break;
      
      case 'c':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          onConfirm?.();
        }
        break;
    }
  }, [cards, focusedIndex, onToggleCard, onConfirm, onClear]);

  React.useEffect(() => {
    const currentGrid = gridRef.current;
    if (currentGrid) {
      currentGrid.addEventListener('keydown', handleKeyDown);
      return () => currentGrid.removeEventListener('keydown', handleKeyDown);
    }
  }, [handleKeyDown]);

  // Focus management
  React.useEffect(() => {
    if (gridRef.current && cards.length > 0) {
      const focusedCard = gridRef.current.children[focusedIndex] as HTMLElement;
      focusedCard?.focus();
    }
  }, [focusedIndex, cards.length]);

  return {
    gridRef,
    focusedIndex,
    setFocusedIndex
  };
};

// Screen reader announcements hook
export const useScreenReaderAnnouncements = () => {
  const [announcement, setAnnouncement] = React.useState('');

  const announce = React.useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    setAnnouncement(message);
    
    // Clear announcement after a short delay to allow for repeated announcements
    setTimeout(() => setAnnouncement(''), 100);
  }, []);

  const announceCardSelection = React.useCallback((cardName: string, isSelected: boolean, selectedCount: number, maxCards: number) => {
    const action = isSelected ? 'selected' : 'deselected';
    const message = `${cardName} ${action}. ${selectedCount} of ${maxCards} cards selected.`;
    announce(message);
  }, [announce]);

  const announceTimer = React.useCallback((timeLeft: number) => {
    if (timeLeft <= 10 && timeLeft > 0) {
      announce(`${timeLeft} seconds remaining`, 'assertive');
    } else if (timeLeft === 0) {
      announce('Time expired', 'assertive');
    }
  }, [announce]);

  const announceConnectionStatus = React.useCallback((status: 'connected' | 'disconnected' | 'reconnecting') => {
    const messages = {
      connected: 'Connected to game server',
      disconnected: 'Disconnected from game server',
      reconnecting: 'Reconnecting to game server'
    };
    announce(messages[status], 'assertive');
  }, [announce]);

  const announceError = React.useCallback((error: string) => {
    announce(`Error: ${error}`, 'assertive');
  }, [announce]);

  return {
    announcement,
    announce,
    announceCardSelection,
    announceTimer,
    announceConnectionStatus,
    announceError
  };
};

// Accessible card component
interface AccessibleCardProps {
  card: { id: string; name: string; image: string };
  isSelected: boolean;
  isFocused: boolean;
  onToggle: (cardId: string) => void;
  onFocus: (index: number) => void;
  index: number;
  disabled?: boolean;
}

export const AccessibleCard: React.FC<AccessibleCardProps> = ({
  card,
  isSelected,
  isFocused,
  onToggle,
  onFocus,
  index,
  disabled = false
}) => {
  const cardRef = React.useRef<HTMLButtonElement>(null);

  const handleClick = () => {
    if (!disabled) {
      onToggle(card.id);
    }
  };

  const handleFocus = () => {
    onFocus(index);
  };

  React.useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.focus();
    }
  }, [isFocused]);

  return (
    <button
      ref={cardRef}
      className={`
        card-button relative focus:outline-none focus:ring-2 focus:ring-blue-500
        ${isSelected ? 'ring-2 ring-yellow-400' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-105'}
        transition-all duration-200
      `}
      onClick={handleClick}
      onFocus={handleFocus}
      disabled={disabled}
      aria-label={ARIA_LABELS.card(card.name, isSelected)}
      aria-pressed={isSelected}
      tabIndex={isFocused ? 0 : -1}
      role="checkbox"
      aria-checked={isSelected}
    >
      <img
        src={card.image}
        alt={`${card.name} card`}
        className="w-full h-auto rounded-lg"
        draggable={false}
      />
      
      {isSelected && (
        <div
          className="absolute top-2 right-2 bg-yellow-400 text-black rounded-full w-6 h-6 flex items-center justify-center"
          aria-hidden="true"
        >
          ✓
        </div>
      )}
      
      {isFocused && (
        <div
          className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none"
          aria-hidden="true"
        />
      )}
    </button>
  );
};

// Accessible timer component
interface AccessibleTimerProps {
  timeLeft: number;
  isRunning: boolean;
  onTimeExpire?: () => void;
}

export const AccessibleTimer: React.FC<AccessibleTimerProps> = ({
  timeLeft,
  isRunning,
  onTimeExpire
}) => {
  const { announceTimer } = useScreenReaderAnnouncements();
  const prevTimeLeft = React.useRef(timeLeft);

  React.useEffect(() => {
    if (prevTimeLeft.current !== timeLeft) {
      announceTimer(timeLeft);
      prevTimeLeft.current = timeLeft;
      
      if (timeLeft === 0 && onTimeExpire) {
        onTimeExpire();
      }
    }
  }, [timeLeft, announceTimer, onTimeExpire]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getAriaValueText = () => {
    if (timeLeft <= 0) return 'Time expired';
    if (timeLeft <= 10) return `${timeLeft} seconds remaining - hurry up`;
    return `${timeLeft} seconds remaining`;
  };

  return (
    <div
      className={`
        timer text-center p-4 rounded-lg
        ${timeLeft <= 10 ? 'bg-red-100 text-red-800 animate-pulse' : 'bg-blue-100 text-blue-800'}
        ${!isRunning ? 'opacity-50' : ''}
      `}
      role="timer"
      aria-live="polite"
      aria-atomic="true"
      aria-label={ARIA_LABELS.timer(timeLeft)}
    >
      <div
        className="text-2xl font-bold"
        aria-hidden="true"
      >
        {formatTime(timeLeft)}
      </div>
      
      <div className="sr-only">
        {getAriaValueText()}
      </div>
      
      {timeLeft <= 10 && timeLeft > 0 && (
        <div className="text-sm mt-1 font-semibold">
          Hurry up!
        </div>
      )}
    </div>
  );
};

// Screen reader only announcements component
interface ScreenReaderAnnouncementsProps {
  announcement: string;
}

export const ScreenReaderAnnouncements: React.FC<ScreenReaderAnnouncementsProps> = ({
  announcement
}) => {
  return (
    <div
      className="sr-only"
      aria-live="polite"
      aria-atomic="true"
      role="status"
    >
      {announcement}
    </div>
  );
};

// Focus trap hook for modal-like behavior
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleTabKey);
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  }, [isActive]);

  return containerRef;
};

// Reduced motion hook
export const useReducedMotion = () => {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
};
