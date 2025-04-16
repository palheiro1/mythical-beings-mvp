import React from 'react';
import { Knowledge } from '../../game/types';
import Card from '../Card';

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
        <div className="h-full w-full flex flex-col overflow-hidden rounded-lg">
            {/* Opponent Hand Area - reduced from flex-1 to flex-none with fixed height */}
            <div className="flex-none h-1/5 flex flex-col items-center justify-center p-2 overflow-hidden relative">
                <span className="text-gray-200 text-sm font-medium absolute top-1 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black/30 rounded-full">
                    Opponent ({opponentPlayerHand.length})
                </span>
                <div className="flex justify-center items-center gap-2 w-full h-full p-1">
                    {opponentPlayerHand.length === 0 ? (
                         // Container defines size
                         <div className="h-[85%] aspect-[2/3]">
                            <Card card={{ id: 'opp-back', name: 'Back', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '' }} showBack />
                         </div>
                    ) : (
                        opponentPlayerHand.slice(0, maxVisibleCards).map((card, idx) => (
                            // Container defines size
                            <div key={card.id + idx + '-opp'} className="h-[85%] aspect-[2/3] transition-all hover:scale-105">
                                <Card card={card} showBack />
                            </div>
                        ))
                    )}
                    {opponentPlayerHand.length > maxVisibleCards && (
                         <span className="text-xs text-white bg-black/50 px-2 py-1 rounded-full">+{opponentPlayerHand.length - maxVisibleCards}</span>
                    )}
                </div>
            </div>

            <hr className="border-white/20 w-full mx-auto" />

            {/* Empty Middle Section 1 */}
            <div className="flex-grow flex flex-col justify-center items-center opacity-30 text-white/50">
                <div className="w-full h-1/3 flex items-center justify-center">
                    <span className="text-xs">Field Zone</span>
                </div>
            </div>

            {/* Empty Middle Section 2 */}
            <div className="flex-grow flex flex-col justify-center items-center opacity-30 text-white/50">
                <div className="w-full h-1/3 flex items-center justify-center">
                    <span className="text-xs">Strategy Zone</span>
                </div>
            </div>

            <hr className="border-white/20 w-full mx-auto" />

            {/* Player Hand Area - reduced from flex-1 to flex-none with fixed height */}
            <div className="flex-none h-1/5 flex flex-col items-center justify-center p-2 overflow-hidden relative">
                <span className="text-gray-200 text-sm font-medium absolute bottom-1 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black/30 rounded-full">
                    Your Hand ({currentPlayerHand.length}/5)
                </span>
                <div className="flex justify-center items-center gap-2 w-full h-full p-1">
                    {currentPlayerHand.length === 0 ? (
                        // Container defines size
                        <div className="h-[85%] aspect-[2/3]">
                            <Card card={{ id: 'player-back', name: 'Back', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '' }} showBack />
                        </div>
                    ) : (
                        currentPlayerHand.slice(0, maxVisibleCards).map((card, idx) => (
                            // Container defines size with hover effect
                            <div 
                                key={card.id + idx + '-player'} 
                                className={`h-[85%] aspect-[2/3] transition-all ${
                                    isMyTurn && phase === 'action' ? 'hover:scale-110 cursor-pointer' : ''
                                } ${selectedKnowledgeId === card.id ? 'ring-2 ring-yellow-400 scale-105' : ''}`}
                                onClick={isMyTurn && phase === 'action' ? () => onHandCardClick(card.id) : undefined}
                            >
                                <Card card={card} isSelected={selectedKnowledgeId === card.id} />
                            </div>
                        ))
                    )}
                    {currentPlayerHand.length > maxVisibleCards && (
                        <span className="text-xs text-white bg-black/50 px-2 py-1 rounded-full">+{currentPlayerHand.length - maxVisibleCards}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HandsColumn;