import React from 'react';
import { Knowledge } from '../../game/types';
import Card from '../Card'; // Adjust path if needed

interface MarketColumnProps {
    marketCards: Knowledge[];
    deckCount: number;
    isMyTurn: boolean;
    phase: 'knowledge' | 'action' | 'end';
    onDrawKnowledge: (knowledgeId: string) => void;
}

const MarketColumn: React.FC<MarketColumnProps> = ({
    marketCards,
    deckCount,
    isMyTurn,
    phase,
    onDrawKnowledge
}) => {
    return (
        <div className="h-full flex flex-col items-center space-y-2 py-4 px-2 bg-blue-900/20 rounded-lg overflow-hidden">
            {/* Deck */}
            {/* Container defines size and aspect ratio */}
            <div className="relative w-[80%] max-w-[100px] aspect-[2/3] flex-shrink-0">
                <Card card={{ id: 'marketdeck', name: 'Deck', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '', element: 'neutral' }} showBack isDisabled /> {/* Removed size, added isDisabled */}
                <span className="absolute -right-1 -bottom-1 bg-black/70 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">{deckCount}</span>
            </div>

            {/* Market Cards */}
            <div className="flex-grow w-full overflow-y-auto space-y-2 flex flex-col items-center">
                {marketCards.map((card, idx) => {
                    const isDisabled = !isMyTurn || phase !== 'action';
                    return (
                        // Container defines size and aspect ratio
                        <div key={card.instanceId || `${card.id}-${idx}`} className="w-[90%] max-w-[120px] aspect-[2/3] flex-shrink-0">
                            <Card
                                card={card}
                                onClick={!isDisabled ? () => onDrawKnowledge(card.id) : undefined}
                                isDisabled={isDisabled} // Pass isDisabled to Card
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default MarketColumn;