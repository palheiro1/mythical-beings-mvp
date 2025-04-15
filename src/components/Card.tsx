import React from 'react';
import { Creature, Knowledge } from '../game/types';

interface CardProps {
  card: Creature | Knowledge;
  onClick?: (id: string) => void;
  isSelected?: boolean; // Optional prop for highlighting
  size?: 'small' | 'medium' | 'large'; // Add size prop
}

const Card: React.FC<CardProps> = ({ card, onClick, isSelected, size = 'medium' }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(card.id);
    }
  };

  // Define size classes based on the prop
  const sizeClasses = {
    small: 'w-16 h-24 text-[8px]', // Smaller size for hand/market
    medium: 'w-24 h-36 text-[10px]', // Default size for field
    large: 'w-32 h-48 text-xs' // Larger size for detail view?
  };

  const cardType = 'element' in card ? 'Creature' : 'Knowledge'; // Check for 'element' instead of 'power'
  // --- FIX: Use card.image directly as it already contains the full path ---
  const imagePath = card.image; 
  // --- END FIX ---

  return (
    <div
      className={`
        ${sizeClasses[size]} /* Apply dynamic size */
        bg-gray-700 border rounded-lg shadow-md overflow-hidden 
        flex flex-col justify-between 
        cursor-pointer transition-transform duration-150 ease-in-out 
        ${onClick ? 'hover:scale-105 hover:shadow-lg' : 'cursor-default'}
        ${isSelected ? 'border-yellow-400 border-2 ring-2 ring-yellow-400' : 'border-gray-500'}
      `}
      onClick={handleClick}
    >
      {/* Image container */}
      <div className="w-full h-2/3 bg-gray-800 flex items-center justify-center overflow-hidden">
        <img src={imagePath} alt={card.name} className="object-contain w-full h-full" />
      </div>
      {/* Details container */}
      <div className="p-1 h-1/3 flex flex-col justify-between">
        <h3 className="font-bold truncate">{card.name}</h3>
        {cardType === 'Creature' && (
          <div className="flex justify-between items-center">
            {/* Display currentWisdom or baseWisdom. Power is on PlayerState, not Creature. */}
            <span>W: {(card as Creature).currentWisdom ?? (card as Creature).baseWisdom}</span>
          </div>
        )}
        {cardType === 'Knowledge' && (
          <div>
            <p>Cost: {(card as Knowledge).cost}</p>
            {/* <p className="truncate text-[9px]">{(card as Knowledge).effect}</p> */}
          </div>
        )}
      </div>
    </div>
  );
};

export default Card;
