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
      className={`border-2 ${borderColor} rounded-lg p-2 m-1 bg-gray-800 text-white w-32 h-48 flex flex-col justify-between items-center text-center shadow-md ${onClick ? 'cursor-pointer hover:border-blue-500' : ''}`}
      onClick={onClick}
    >
      <div className="text-xs font-bold mb-1 truncate w-full">{card.name}</div>
      <img src={card.image} alt={card.name} className="w-20 h-20 object-contain my-1" />
      <div className="text-xs w-full">
        {isCreature ? (
          <>
            <div>Element: {card.element}</div>
            <div>Wisdom: {card.currentWisdom ?? card.baseWisdom}</div>
          </>
        ) : (
          <>
            <div>Type: {card.type}</div>
            <div>Cost: {card.cost}</div>
            {/* Display rotation if present */} 
            {card.rotation !== undefined && <div>Rot: {card.rotation}°</div>}
          </>
        )}
      </div>
      {/* Basic effect/ability display - can be expanded */} 
      <div className="text-[10px] mt-1 overflow-hidden text-ellipsis h-6 w-full">
        {isCreature ? card.passiveAbility : card.effect}
      </div>
    </div>
  );
};

export default Card;
