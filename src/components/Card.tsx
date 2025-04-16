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

  const cardType = 'element' in card ? 'Creature' : 'Knowledge';
  const imagePath = showBack ? '/images/spells/back.jpg' : card.image;

  // Calculate rotation style to apply to inner content only
  const rotationStyle = {
    transform: rotation ? `rotate(${-rotation}deg)` : 'none', // Negative for counterclockwise
    transition: 'transform 0.3s ease-in-out',
    transformOrigin: 'center center',
  };

  return (
    <div
      className={`
        w-full h-full
        bg-gray-700 border rounded-lg shadow-md 
        cursor-pointer 
        ${onClick ? 'hover:shadow-lg' : 'cursor-default'}
        ${isSelected ? 'border-yellow-400 border-2 ring-2 ring-yellow-400' : 'border-gray-500'}
      `}
      onClick={handleClick}
    >
      {/* Using a wrapper div for card content that rotates */}
      <div 
        className="w-full h-full flex flex-col transition-transform duration-300"
        style={rotationStyle}
      >
        {/* Image Area - Maintain aspect ratio within its container */}
        <div className="w-full h-2/3 bg-gray-800 flex items-center justify-center overflow-hidden">
          <img 
            src={imagePath} 
            alt={card.name} 
            className="object-contain w-full h-full" 
            draggable={false} 
          />
        </div>
        
        {/* Text Area */}
        {!showBack && (
          <div className="p-1 h-1/3 flex flex-col justify-between text-[8px] leading-tight bg-gray-700"> 
            <h3 className="font-bold truncate">{card.name}</h3>
            {cardType === 'Creature' && (
              <div className="flex justify-between items-center">
                <span>W: {(card as Creature).currentWisdom ?? (card as Creature).baseWisdom}</span>
                <span className="text-xs">
                  {(card as Creature).element.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            {cardType === 'Knowledge' && (
              <div>
                <p>Cost: {(card as Knowledge).cost}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
