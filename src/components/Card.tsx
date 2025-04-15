import React from 'react';
import { Creature, Knowledge } from '../game/types';

interface CardProps {
  card: Creature | Knowledge;
  onClick?: (id: string) => void;
  isSelected?: boolean;
  size?: 'small' | 'medium' | 'large';
  rotation?: number; // degrees (0, 90, 180, 270)
  showBack?: boolean; // If true, show card back
}

const Card: React.FC<CardProps> = ({ card, onClick, isSelected, size = 'medium', rotation = 0, showBack = false }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(card.id);
    }
  };

  const sizeClasses = {
    small: 'w-[48px] h-[72px] text-[7px]', // 48x72px
    medium: 'w-[64px] h-[96px] text-[8px]', // 64x96px
    large: 'w-[80px] h-[120px] text-xs' // 80x120px
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
        ${sizeClasses[size]} ${rotateClass}
        bg-gray-700 border rounded-lg shadow-md overflow-hidden 
        flex flex-col justify-between 
        cursor-pointer transition-transform duration-300 ease-in-out 
        ${onClick ? 'hover:scale-105 hover:shadow-lg' : 'cursor-default'}
        ${isSelected ? 'border-yellow-400 border-2 ring-2 ring-yellow-400' : 'border-gray-500'}
      `}
      onClick={handleClick}
      style={{ perspective: '600px' }}
    >
      <div className="w-full h-2/3 bg-gray-800 flex items-center justify-center overflow-hidden">
        <img src={imagePath} alt={card.name} className="object-contain w-full h-full" draggable={false} />
      </div>
      {!showBack && (
        <div className="p-1 h-1/3 flex flex-col justify-between">
          <h3 className="font-bold truncate">{card.name}</h3>
          {cardType === 'Creature' && (
            <div className="flex justify-between items-center">
              <span>W: {(card as Creature).currentWisdom ?? (card as Creature).baseWisdom}</span>
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
  );
};

export default Card;
