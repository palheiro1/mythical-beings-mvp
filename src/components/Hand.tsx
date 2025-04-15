import React from 'react';
import { Knowledge } from '../game/types';
import Card from './Card';

interface HandProps {
  cards: Knowledge[];
  onCardClick?: (cardId: string) => void; // Optional: For selecting a card to play
}

const Hand: React.FC<HandProps> = ({ cards, onCardClick }) => {
  return (
    // Added flex-wrap, gap, and adjusted padding/min-height for responsiveness
    <div className="flex flex-wrap justify-center items-end p-1 md:p-2 bg-gray-700 rounded min-h-[100px] md:min-h-[150px] gap-1 md:gap-2">
      <h3 className="text-xs md:text-sm font-semibold mr-2 self-center w-full md:w-auto text-center md:text-left mb-1 md:mb-0">Hand:</h3>
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
