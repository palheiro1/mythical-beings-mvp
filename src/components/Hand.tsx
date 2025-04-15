import React from 'react';
import { Knowledge } from '../game/types';
import Card from './Card';

interface HandProps {
  cards: Knowledge[];
  onCardClick?: (id: string) => void;
}

const Hand: React.FC<HandProps> = ({ cards, onCardClick }) => {
  return (
    <div className="flex justify-center items-end space-x-1 md:space-x-2 p-1 bg-black/20 rounded min-h-[7rem]"> {/* Adjusted min-height */}
      {cards.map((card) => (
        <Card 
          key={card.id} 
          card={card} 
          onClick={onCardClick} 
          size="small" // Use small cards in hand
        />
      ))}
      {cards.length === 0 && <p className="text-xs text-gray-400 italic">Hand is empty</p>}
    </div>
  );
};

export default Hand;
