import React from 'react';
import { Knowledge } from '../game/types';
import Card from './Card';

interface HandProps {
  cards: Knowledge[];
  onCardClick?: (cardId: string) => void; // Optional: For selecting a card to play
}

const Hand: React.FC<HandProps> = ({ cards, onCardClick }) => {
  return (
    <div className="flex justify-center items-end p-2 bg-gray-700 rounded min-h-[150px]">
      <h3 className="text-sm font-semibold mr-2 self-center">Hand:</h3>
      {cards.length === 0 ? (
        <p className="text-xs text-gray-400 self-center">Empty</p>
      ) : (
        cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            onClick={onCardClick ? () => onCardClick(card.id) : undefined}
          />
        ))
      )}
    </div>
  );
};

export default Hand;
