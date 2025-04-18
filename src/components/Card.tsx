import React from 'react';
import { Creature, Knowledge } from '../game/types';

interface CardProps {
  card: Creature | Knowledge;
  onClick?: (id: string) => void;
  isSelected?: boolean;
  rotation?: number; // degrees (0, 90, 180, 270)
  showBack?: boolean; // If true, show card back
}

const Card: React.FC<CardProps> = ({ card, onClick, isSelected, rotation = 0, showBack = false }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(card.id);
    }
  };

  const cardType = 'element' in card ? 'Creature' : 'Knowledge';
  const imagePath = showBack ? '/images/spells/back.jpg' : card.image;

  // Calculate rotation style to apply to inner content only
  const rotationStyle = {
    transform: rotation ? `rotate(${-rotation}deg)` : 'none', // Negative for counterclockwise
    transition: 'transform 0.3s ease-in-out',
    transformOrigin: 'center center',
  };

  return (
    <div
      className={`
        w-full h-full
        bg-gray-700 rounded-[10px] shadow-md overflow-hidden /* Use arbitrary radius */
        /* Removed transform/hover classes - will be handled by parent */
        ${onClick ? 'cursor-pointer hover:shadow-lg' : 'cursor-default'} /* Conditional cursor and shadow */
        /* Apply border style conditionally */
        ${isSelected ? 'border-yellow-400 border-2 ring-2 ring-yellow-400' : 'border-2 border-gray-500'} 
      `}
      onClick={() => { 
        console.log('Card clicked:', card, 'onClick:', !!onClick);
        handleClick();
      }}
    >
      {/* Using a wrapper div for card content that rotates */}
      <div 
        className="w-full h-full flex flex-col transition-transform duration-300"
        style={rotationStyle}
      >
        {/* Image Area */}
        <div className="w-full h-full bg-gray-800 flex items-center justify-center"> 
          <img 
            src={imagePath} 
            alt={card.name} 
            className="object-cover w-full h-full" 
            draggable={false} 
          />
        </div>
        
      </div>
    </div>
  );
};

export default Card;
