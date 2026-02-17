import { memo, useMemo } from 'react';
import { Creature, Knowledge } from '../game/types.js';

interface OptimizedCardProps {
  card: Creature | Knowledge;
  isSelected?: boolean;
  onClick?: (id: string) => void;
  isDisabled?: boolean;
  showSelectionIndicator?: boolean;
  className?: string;
}

// Memoized card component to prevent unnecessary re-renders
export const OptimizedCard = memo<OptimizedCardProps>(({ 
  card, 
  isSelected = false, 
  onClick, 
  isDisabled = false,
  showSelectionIndicator = true,
  className = ''
}) => {
  const handleClick = useMemo(() => {
    if (!onClick || isDisabled) return undefined;
    return () => onClick(card.id);
  }, [onClick, isDisabled, card.id]);

  const cardClasses = useMemo(() => {
    const baseClasses = 'relative bg-white/10 backdrop-blur-sm rounded-xl transition-all duration-200 cursor-pointer hover:scale-105 hover:bg-white/20';
    const selectedClasses = isSelected ? 'ring-4 ring-blue-400 bg-blue-500/20' : '';
    const disabledClasses = isDisabled ? 'opacity-50 cursor-not-allowed' : '';
    
    return `${baseClasses} ${selectedClasses} ${disabledClasses} ${className}`.trim();
  }, [isSelected, isDisabled, className]);

  const cardStats = useMemo(() => {
    if ('attack' in card && 'defense' in card) {
      return { attack: card.attack, defense: card.defense, type: 'creature' };
    }
    if ('knowledge_points' in card) {
      return { points: card.knowledge_points, type: 'knowledge' };
    }
    return null;
  }, [card]);

  return (
    <div
      className={cardClasses}
      onClick={handleClick}
      style={{ aspectRatio: '3/4' }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick && !isDisabled ? 0 : undefined}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && handleClick) {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`${card.name} card${isSelected ? ' (selected)' : ''}`}
      aria-pressed={showSelectionIndicator ? isSelected : undefined}
    >
      {/* Selection indicator */}
      {showSelectionIndicator && isSelected && (
        <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center z-10">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      <div className="p-4 h-full flex flex-col justify-between">
        {/* Card header */}
        <div className="text-center">
          <h3 className="text-white font-bold text-sm mb-1 truncate">{card.name}</h3>
          <p className="text-white/60 text-xs">{card.rarity}</p>
        </div>

        {/* Card image/icon */}
        <div className="flex-1 flex items-center justify-center my-3">
          {card.image_url ? (
            <img
              src={card.image_url}
              alt={card.name}
              className="max-w-full max-h-20 object-contain rounded"
              loading="lazy"
            />
          ) : (
            <div className="w-16 h-16 bg-white/20 rounded-lg flex items-center justify-center">
              <span className="text-2xl">
                {cardStats?.type === 'creature' ? '🐾' : '📚'}
              </span>
            </div>
          )}
        </div>

        {/* Card stats */}
        <div className="text-center">
          {cardStats?.type === 'creature' && (
            <div className="flex justify-between items-center text-sm">
              <div className="flex items-center space-x-1">
                <span className="text-red-400">⚔️</span>
                <span className="text-white">{cardStats.attack}</span>
              </div>
              <div className="flex items-center space-x-1">
                <span className="text-blue-400">🛡️</span>
                <span className="text-white">{cardStats.defense}</span>
              </div>
            </div>
          )}
          
          {cardStats?.type === 'knowledge' && (
            <div className="flex justify-center items-center space-x-1 text-sm">
              <span className="text-purple-400">✨</span>
              <span className="text-white">{cardStats.points}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

OptimizedCard.displayName = 'OptimizedCard';

// Grid component for cards with proper spacing
interface CardGridProps {
  cards: (Creature | Knowledge)[];
  selectedCards: string[];
  onCardClick?: (cardId: string) => void;
  isDisabled?: boolean;
  className?: string;
}

export const CardGrid = memo<CardGridProps>(({ 
  cards, 
  selectedCards, 
  onCardClick, 
  isDisabled = false,
  className = '' 
}) => {
  const gridClasses = useMemo(() => 
    `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 ${className}`.trim(),
    [className]
  );

  return (
    <div className={gridClasses}>
      {cards.map((card) => (
        <OptimizedCard
          key={card.id}
          card={card}
          isSelected={selectedCards.includes(card.id)}
          onClick={onCardClick}
          isDisabled={isDisabled}
        />
      ))}
    </div>
  );
});

CardGrid.displayName = 'CardGrid';
