import React from 'react';
import { Creature, Knowledge } from '../game/types';

interface CardProps {
  card: Creature | Knowledge;
  onClick?: (id: string) => void;
  isSelected?: boolean;
  rotation?: number; // degrees (0, 90, 180, 270)
  showBack?: boolean; // If true, show card back
}

const Card: React.FC<CardProps> = ({ card, onClick, isSelected, rotation = 0, showBack = false }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(card.id);
    }
  };

  // Tailwind rotate classes (rounded to nearest 90)
  const rotateClass = {
    0: '',
    90: 'rotate-90',
    180: 'rotate-180',
    270: '-rotate-90',
  }[rotation % 360];

  const cardType = 'element' in card ? 'Creature' : 'Knowledge';
  const imagePath = showBack ? '/images/spells/back.jpg' : card.image;

  return (
    <div
      className={`
        w-full h-full ${rotateClass} /* Use w-full h-full */
        bg-gray-700 border rounded-lg shadow-md overflow-hidden
        flex flex-col justify-between
        cursor-pointer transition-transform duration-300 ease-in-out
        ${onClick ? 'hover:scale-105 hover:shadow-lg' : 'cursor-default'}
        ${isSelected ? 'border-yellow-400 border-2 ring-2 ring-yellow-400' : 'border-gray-500'}
      `}
      onClick={handleClick}
      style={{ perspective: '600px' }}
    >
      {/* Image Area - Maintain aspect ratio within its container */}
      <div className="w-full h-2/3 bg-gray-800 flex items-center justify-center overflow-hidden">
        <img src={imagePath} alt={card.name} className="object-contain w-full h-full" draggable={false} />
      </div>
      {/* Text Area */}
      {!showBack && (
        // Use smaller text size to fit potentially smaller cards
        <div className="p-1 h-1/3 flex flex-col justify-between text-[8px] leading-tight"> {/* Adjusted text size/leading */}
          <h3 className="font-bold truncate">{card.name}</h3>
          {cardType === 'Creature' && (
            <div className="flex justify-between items-center">
              <span>W: {(card as Creature).currentWisdom ?? (card as Creature).baseWisdom}</span>
              {/* Add element icon or text if needed */}
            </div>
          )}
          {cardType === 'Knowledge' && (
            <div>
              <p>Cost: {(card as Knowledge).cost}</p>
              {/* Add type icon or text if needed */}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Card;
