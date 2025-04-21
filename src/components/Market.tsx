import React from 'react';
import { Knowledge } from '../game/types';
import Card from './Card';

interface MarketProps {
  cards: Knowledge[];
  onCardClick?: (id: string) => void;
}

const Market: React.FC<MarketProps> = ({ cards, onCardClick }) => {
  return (
    <div className="flex justify-center items-center space-x-1 md:space-x-2 p-1 bg-blue-900/30 rounded min-h-[7rem]"> {/* Adjusted min-height */}
      {cards.map((card) => (
        <Card 
          key={card.id} 
          card={card} 
          onClick={onCardClick} 
        />
      ))}
      {cards.length === 0 && <p className="text-xs text-gray-400 italic">Market is empty</p>}
    </div>
  );
};

export default Market;
