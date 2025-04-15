import React from 'react';
import { Knowledge } from '../game/types';
import Card from './Card';

interface MarketProps {
  cards: Knowledge[];
  onCardClick?: (cardId: string) => void; // Optional: For selecting a card to draw
}

const Market: React.FC<MarketProps> = ({ cards, onCardClick }) => {
  return (
    // Added gap for better spacing when wrapping
    <div className="flex flex-wrap justify-center items-center p-1 md:p-2 bg-blue-900 rounded min-h-[100px] md:min-h-[150px] gap-1 md:gap-2">
      <h3 className="text-xs md:text-sm font-semibold mr-2 self-center w-full md:w-auto text-center md:text-left mb-1 md:mb-0">Market:</h3>
      {cards.map((card) => (
        <Card
          key={card.id}
          card={card}
          onClick={onCardClick ? () => onCardClick(card.id) : undefined}
        />
      ))}
    </div>
  );
};

export default Market;
