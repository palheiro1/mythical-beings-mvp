import React from 'react';
import { Creature, Knowledge } from '../game/types';

interface CardProps {
  card: Creature | Knowledge;
  onClick?: () => void; // Optional click handler for interactivity later
  isSelected?: boolean; // Optional styling for selected cards
}

const Card: React.FC<CardProps> = ({ card, onClick, isSelected }) => {
  const isCreature = 'element' in card;
  const borderColor = isSelected ? 'border-yellow-400' : 'border-gray-600';

  return (
    <div
      // Adjusted size: smaller base, scales up on medium screens
      className={`border-2 ${borderColor} rounded-lg p-1 m-1 bg-gray-800 text-white w-24 h-36 md:w-32 md:h-48 flex flex-col justify-between items-center text-center shadow-md ${onClick ? 'cursor-pointer hover:border-blue-500 transition-colors' : ''}`}
      onClick={onClick}
    >
      {/* Adjusted text size for smaller base card */}
      <div className="text-[10px] md:text-xs font-bold mb-1 truncate w-full">{card.name}</div>
      {/* Adjusted image size */}
      <img src={card.image} alt={card.name} className="w-16 h-16 md:w-20 md:h-20 object-contain my-1" />
      {/* Adjusted text size */}
      <div className="text-[10px] md:text-xs w-full">
        {isCreature ? (
          <>
            <div>Element: {card.element}</div>
            <div>Wisdom: {card.currentWisdom ?? card.baseWisdom}</div>
          </>
        ) : (
          <>
            <div>Type: {card.type}</div>
            <div>Cost: {card.cost}</div>
            {card.rotation !== undefined && <div>Rot: {card.rotation}°</div>}
          </>
        )}
      </div>
      {/* Adjusted text size and height */}
      <div className="text-[9px] md:text-[10px] mt-1 overflow-hidden text-ellipsis h-5 md:h-6 w-full">
        {isCreature ? card.passiveAbility : card.effect}
      </div>
    </div>
  );
};

export default Card;
