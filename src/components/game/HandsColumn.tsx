import React from 'react';
import { Knowledge } from '../../game/types';
import Card from '../Card'; // Adjust path if needed

interface HandsColumnProps {
    currentPlayerHand: Knowledge[];
    opponentPlayerHand: Knowledge[];
    isMyTurn: boolean;
    phase: 'knowledge' | 'action' | 'end';
    selectedKnowledgeId: string | null;
    onHandCardClick: (knowledgeId: string) => void;
}

const HandsColumn: React.FC<HandsColumnProps> = ({
    currentPlayerHand,
    opponentPlayerHand,
    isMyTurn,
    phase,
    selectedKnowledgeId,
    onHandCardClick
}) => {
    const maxVisibleCards = 5; // Keep this logic for now

    return (
        <div className="h-full w-full flex flex-col overflow-hidden bg-black/10 rounded">
            {/* Opponent Hand Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-1 overflow-hidden relative">
                <span className="text-gray-400 text-xs absolute top-1 left-1/2 transform -translate-x-1/2">
                    Opponent ({opponentPlayerHand.length})
                </span>
                <div className="flex justify-center items-center gap-1 w-full h-full p-1">
                    {opponentPlayerHand.length === 0 ? (
                         // Container defines size
                         <div className="h-[90%] aspect-[2/3]">
                            <Card card={{ id: 'opp-back', name: 'Back', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '' }} showBack /> {/* Removed size */}
                         </div>
                    ) : (
                        opponentPlayerHand.slice(0, maxVisibleCards).map((card, idx) => (
                            // Container defines size
                            <div key={card.id + idx + '-opp'} className="h-[90%] aspect-[2/3]">
                                <Card card={card} showBack /> {/* Removed size */}
                            </div>
                        ))
                    )}
                    {opponentPlayerHand.length > maxVisibleCards && (
                         <span className="text-xs text-gray-400">+{opponentPlayerHand.length - maxVisibleCards}</span>
                    )}
                </div>
            </div>

             <hr className="border-gray-600 w-full" />

            {/* Player Hand Area */}
            <div className="flex-1 flex flex-col items-center justify-center p-1 overflow-hidden relative">
                 <span className="text-gray-400 text-xs absolute bottom-1 left-1/2 transform -translate-x-1/2">
                    Your Hand ({currentPlayerHand.length}/5)
                 </span>
                <div className="flex justify-center items-center gap-1 w-full h-full p-1">
                    {currentPlayerHand.length === 0 ? (
                         // Container defines size
                         <div className="h-[90%] aspect-[2/3]">
                            <Card card={{ id: 'player-back', name: 'Back', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '' }} showBack /> {/* Removed size */}
                         </div>
                    ) : (
                        currentPlayerHand.slice(0, maxVisibleCards).map((card, idx) => (
                            // Container defines size
                            <div key={card.id + '-player'} className={`h-[90%] aspect-[2/3] transition-transform duration-200 ${selectedKnowledgeId === card.id ? '-translate-y-2' : ''}`}>
                                <Card
                                    card={card}
                                    onClick={isMyTurn && phase === 'action' ? () => onHandCardClick(card.id) : undefined}
                                    isSelected={selectedKnowledgeId === card.id}
                                    // Removed size
                                />
                            </div>
                        ))
                    )}
                     {currentPlayerHand.length > maxVisibleCards && (
                         <span className="text-xs text-gray-400">+{currentPlayerHand.length - maxVisibleCards}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HandsColumn;