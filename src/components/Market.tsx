import React from 'react';
import { Knowledge } from '../game/types';
import Card from './Card';

interface MarketProps {
  cards: Knowledge[];
  onCardClick?: (cardId: string) => void; // Optional: For selecting a card to draw
}

const Market: React.FC<MarketProps> = ({ cards, onCardClick }) => {
  return (
    <div className="flex justify-center items-center p-2 bg-blue-900 rounded min-h-[150px]">
      <h3 className="text-sm font-semibold mr-2">Market:</h3>
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
