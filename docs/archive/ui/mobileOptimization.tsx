// Mobile optimization utilities for NFT Selection
import React from 'react';

// Touch gesture detection hook
export const useTouchGestures = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  onDoubleTap?: () => void
) => {
  const touchStartRef = React.useRef<{ x: number; y: number; time: number } | null>(null);
  const lastTapRef = React.useRef<number>(0);

  const handleTouchStart = React.useCallback((e: TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now()
    };
  }, []);

  const handleTouchEnd = React.useCallback((e: TouchEvent) => {
    if (!touchStartRef.current) return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;
    const currentTime = Date.now();

    // Detect double tap
    if (deltaTime < 300 && Math.abs(deltaX) < 30 && Math.abs(deltaY) < 30) {
      if (currentTime - lastTapRef.current < 300) {
        onDoubleTap?.();
      }
      lastTapRef.current = currentTime;
    }

    // Detect swipes (minimum distance and maximum time)
    if (deltaTime < 300 && (Math.abs(deltaX) > 50 || Math.abs(deltaY) > 50)) {
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Horizontal swipe
        if (deltaX > 0) {
          onSwipeRight?.();
        } else {
          onSwipeLeft?.();
        }
      } else {
        // Vertical swipe
        if (deltaY > 0) {
          onSwipeDown?.();
        } else {
          onSwipeUp?.();
        }
      }
    }

    touchStartRef.current = null;
  }, [onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown, onDoubleTap]);

  const touchHandlers = {
    onTouchStart: handleTouchStart,
    onTouchEnd: handleTouchEnd
  };

  return touchHandlers;
};

// Mobile viewport detection hook
export const useMobileViewport = () => {
  const [isMobile, setIsMobile] = React.useState(false);
  const [orientation, setOrientation] = React.useState<'portrait' | 'landscape'>('portrait');
  const [viewportSize, setViewportSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      setIsMobile(width < 768); // Tailwind md breakpoint
      setOrientation(width > height ? 'landscape' : 'portrait');
      setViewportSize({ width, height });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  return {
    isMobile,
    orientation,
    viewportSize,
    isSmallScreen: viewportSize.width < 640, // Tailwind sm breakpoint
    isLandscape: orientation === 'landscape'
  };
};

// Mobile-optimized card grid component
interface MobileCardGridProps {
  cards: Array<{ id: string; name: string; image: string }>;
  selectedCards: string[];
  onCardToggle: (cardId: string) => void;
  maxCards: number;
  disabled?: boolean;
}

export const MobileCardGrid: React.FC<MobileCardGridProps> = ({
  cards,
  selectedCards,
  onCardToggle,
  maxCards,
  disabled = false
}) => {
  const { isMobile, isSmallScreen, orientation } = useMobileViewport();
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);

  // Calculate optimal grid columns based on viewport
  const getGridColumns = () => {
    if (isSmallScreen) {
      return orientation === 'landscape' ? 4 : 2;
    }
    return isMobile ? 3 : 4;
  };

  const gridColumns = getGridColumns();

  // Touch gestures for card interaction
  const touchGestures = useTouchGestures(
    undefined, // onSwipeLeft
    undefined, // onSwipeRight
    undefined, // onSwipeUp
    undefined, // onSwipeDown
    () => setIsSelectionMode(!isSelectionMode) // onDoubleTap to toggle selection mode
  );

  return (
    <div className="mobile-card-grid">
      {isMobile && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
          <p>💡 Tip: Tap cards to select, double-tap anywhere to toggle selection mode</p>
          {selectedCards.length > 0 && (
            <p className="mt-1">Selected: {selectedCards.length}/{maxCards}</p>
          )}
        </div>
      )}

      <div
        className={`
          grid gap-2 md:gap-4
          ${gridColumns === 2 ? 'grid-cols-2' : ''}
          ${gridColumns === 3 ? 'grid-cols-3' : ''}
          ${gridColumns === 4 ? 'grid-cols-4' : ''}
          ${isSelectionMode ? 'selection-mode' : ''}
        `}
        {...touchGestures}
      >
        {cards.map((card) => (
          <MobileCard
            key={card.id}
            card={card}
            isSelected={selectedCards.includes(card.id)}
            onToggle={() => onCardToggle(card.id)}
            disabled={disabled || (selectedCards.length >= maxCards && !selectedCards.includes(card.id))}
            selectionMode={isSelectionMode}
          />
        ))}
      </div>

      {/* Mobile-specific selection controls */}
      {isMobile && selectedCards.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 bg-white border border-gray-300 rounded-lg p-3 shadow-lg">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">
              {selectedCards.length}/{maxCards} selected
            </span>
            <div className="flex gap-2">
              <button
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                onClick={() => {
                  selectedCards.forEach(cardId => onCardToggle(cardId));
                }}
              >
                Clear
              </button>
              <button
                className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                disabled={selectedCards.length === 0}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Mobile-optimized card component
interface MobileCardProps {
  card: { id: string; name: string; image: string };
  isSelected: boolean;
  onToggle: () => void;
  disabled?: boolean;
  selectionMode?: boolean;
}

export const MobileCard: React.FC<MobileCardProps> = ({
  card,
  isSelected,
  onToggle,
  disabled = false,
  selectionMode = false
}) => {
  const [isPressed, setIsPressed] = React.useState(false);

  const handleTouchStart = () => {
    if (!disabled) {
      setIsPressed(true);
    }
  };

  const handleTouchEnd = () => {
    setIsPressed(false);
    if (!disabled) {
      onToggle();
    }
  };

  return (
    <div
      className={`
        mobile-card relative cursor-pointer select-none
        transition-all duration-150 ease-out
        ${isPressed ? 'scale-95' : 'scale-100'}
        ${isSelected ? 'ring-2 ring-yellow-400 ring-offset-2' : ''}
        ${disabled ? 'opacity-50' : ''}
        ${selectionMode ? 'animate-pulse' : ''}
      `}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleTouchStart}
      onMouseUp={handleTouchEnd}
      onMouseLeave={() => setIsPressed(false)}
    >
      <div className="relative overflow-hidden rounded-lg bg-gray-100">
        <img
          src={card.image}
          alt={card.name}
          className="w-full h-auto aspect-[3/4] object-cover"
          draggable={false}
        />
        
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2 bg-yellow-400 text-black rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">
            ✓
          </div>
        )}
        
        {/* Disabled overlay */}
        {disabled && (
          <div className="absolute inset-0 bg-black bg-opacity-30 flex items-center justify-center">
            <span className="text-white text-xs bg-black bg-opacity-50 px-2 py-1 rounded">
              Max reached
            </span>
          </div>
        )}
        
        {/* Touch feedback */}
        {isPressed && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-20" />
        )}
      </div>
      
      {/* Card name (mobile only) */}
      <div className="mt-1 text-xs text-center text-gray-700 truncate px-1">
        {card.name}
      </div>
    </div>
  );
};

// Mobile-optimized timer component
interface MobileTimerProps {
  timeLeft: number;
  isRunning: boolean;
  onTimeExpire?: () => void;
}

export const MobileTimer: React.FC<MobileTimerProps> = ({
  timeLeft,
  isRunning,
  onTimeExpire
}) => {
  const { isMobile, isSmallScreen } = useMobileViewport();

  React.useEffect(() => {
    if (timeLeft === 0 && onTimeExpire) {
      onTimeExpire();
    }
  }, [timeLeft, onTimeExpire]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    if (timeLeft <= 10) return 'bg-red-500 text-white';
    if (timeLeft <= 30) return 'bg-yellow-500 text-black';
    return 'bg-blue-500 text-white';
  };

  return (
    <div
      className={`
        mobile-timer fixed top-4 right-4 z-50
        ${isMobile ? 'top-2 right-2' : ''}
        ${isSmallScreen ? 'text-sm' : 'text-base'}
      `}
    >
      <div
        className={`
          px-3 py-2 rounded-full font-bold shadow-lg
          ${getTimerColor()}
          ${timeLeft <= 10 ? 'animate-pulse' : ''}
          ${!isRunning ? 'opacity-50' : ''}
        `}
      >
        {formatTime(timeLeft)}
      </div>
      
      {/* Progress ring for mobile */}
      {isMobile && (
        <div className="absolute inset-0 -rotate-90">
          <svg className="w-full h-full" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="opacity-20"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={`${(timeLeft / 60) * 62.83} 62.83`}
              className="transition-all duration-1000"
            />
          </svg>
        </div>
      )}
    </div>
  );
};

// Mobile haptic feedback hook
export const useHapticFeedback = () => {
  const vibrate = React.useCallback((pattern: number | number[] = 50) => {
    if ('vibrate' in navigator && navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  }, []);

  const vibrateSuccess = React.useCallback(() => {
    vibrate([50, 50, 50]);
  }, [vibrate]);

  const vibrateError = React.useCallback(() => {
    vibrate([100, 50, 100]);
  }, [vibrate]);

  const vibrateSelection = React.useCallback(() => {
    vibrate(30);
  }, [vibrate]);

  return {
    vibrate,
    vibrateSuccess,
    vibrateError,
    vibrateSelection
  };
};

// Safe area insets hook for notched devices
export const useSafeAreaInsets = () => {
  const [insets, setInsets] = React.useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0
  });

  React.useEffect(() => {
    const updateInsets = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      setInsets({
        top: parseInt(computedStyle.getPropertyValue('--safe-area-inset-top') || '0'),
        right: parseInt(computedStyle.getPropertyValue('--safe-area-inset-right') || '0'),
        bottom: parseInt(computedStyle.getPropertyValue('--safe-area-inset-bottom') || '0'),
        left: parseInt(computedStyle.getPropertyValue('--safe-area-inset-left') || '0')
      });
    };

    updateInsets();
    window.addEventListener('resize', updateInsets);
    window.addEventListener('orientationchange', updateInsets);

    return () => {
      window.removeEventListener('resize', updateInsets);
      window.removeEventListener('orientationchange', updateInsets);
    };
  }, []);

  return insets;
};
