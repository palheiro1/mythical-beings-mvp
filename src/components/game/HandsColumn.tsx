import React, { useRef, useEffect } from 'react';
import { Knowledge } from '../../game/types.js';
import Card from '../Card.js';
import { useCardRegistry } from '../../context/CardRegistry.js';
import { cn, StatusBadge } from '../ui/index.js';

interface HandsColumnProps {
    currentPlayerHand: Knowledge[];
    opponentPlayerHand: Knowledge[];
    isMyTurn: boolean;
    phase: 'knowledge' | 'action' | 'end';
    selectedKnowledgeId: string | null;
    onHandCardClick: (instanceId: string) => void; // Change signature to expect instanceId
    isSpectator?: boolean;
    currentPlayerLabel?: string;
    opponentPlayerLabel?: string;
}

const HandsColumn: React.FC<HandsColumnProps> = ({
    currentPlayerHand,
    opponentPlayerHand,
    isMyTurn,
    phase,
    selectedKnowledgeId,
    onHandCardClick,
    isSpectator = false,
    currentPlayerLabel = 'Your Hand',
    opponentPlayerLabel = 'Opponent'
}) => {
    const maxVisibleCards = 5; // Keep this logic for now
    const registry = useCardRegistry();
    const oppHandRef = useRef<HTMLDivElement | null>(null);
    const myHandRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (oppHandRef.current) registry.register('hand:opponent', oppHandRef.current);
        if (myHandRef.current) registry.register('hand:player', myHandRef.current);
        return () => {
            registry.register('hand:opponent', null as unknown as HTMLElement | null);
            registry.register('hand:player', null as unknown as HTMLElement | null);
        };
    }, [registry]);

    return (
        <div className="surface-obsidian flex h-full min-h-[260px] w-full flex-col overflow-hidden rounded-xl border">
            {/* Opponent Hand Area - reduced from flex-1 to flex-none with fixed height */}
            <div className="relative flex min-h-[120px] flex-1 flex-col items-center justify-center overflow-hidden p-2" ref={oppHandRef}>
                <div className="absolute left-2 top-2 z-10">
                    <StatusBadge tone="muted">{opponentPlayerLabel} ({opponentPlayerHand.length})</StatusBadge>
                </div>
                <div className="flex h-full w-full items-center justify-center gap-2 p-1">
                    {opponentPlayerHand.length === 0 ? (
                         // Container defines size
                         <div className="h-[85%] aspect-[921/1217]">
                            <Card card={{ id: 'opp-back', name: 'Back', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '', element: 'neutral' }} showBack isDisabled />
                         </div>
                    ) : (
                        opponentPlayerHand.slice(0, maxVisibleCards).map((card, idx) => (
                            // Container defines size - REMOVED hover:scale-105
                            <div key={card.id + idx + '-opp'} className="h-[85%] aspect-[921/1217] transition-all">
                                <Card card={card} showBack isDisabled />
                            </div>
                        ))
                    )}
                    {opponentPlayerHand.length > maxVisibleCards && (
                         <span className="rounded-md border border-white/10 bg-black/50 px-2 py-1 text-xs text-white">+{opponentPlayerHand.length - maxVisibleCards}</span>
                    )}
                </div>
            </div>

            <div className="mx-auto h-px w-full border-t border-white/10" />

            {/* Player Hand Area - reduced from flex-1 to flex-none with fixed height */}
            <div className="relative flex min-h-[120px] flex-1 flex-col items-center justify-center overflow-hidden p-2" ref={myHandRef}>
                <div className="absolute bottom-2 left-2 z-10">
                    <StatusBadge tone={isMyTurn && phase === 'action' ? 'violet' : 'muted'}>{currentPlayerLabel} ({currentPlayerHand.length}/5)</StatusBadge>
                </div>
                <div className="flex h-full w-full items-center justify-center gap-2 p-1">
                    {currentPlayerHand.length === 0 ? (
                        // Container defines size
                        <div className="h-[85%] aspect-[921/1217]">
                            <Card card={{ id: 'player-back', name: 'Back', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '', element: 'neutral' }} showBack isDisabled />
                        </div>
                    ) : (
                        currentPlayerHand.slice(0, maxVisibleCards).map((card, idx) => {
                            const isDisabled = isSpectator || !isMyTurn || phase !== 'action';
                            // Ensure card.instanceId exists before using it
                            const instanceId = card.instanceId || `fallback-instance-${card.id}-${idx}`;
                            if (!card.instanceId) {
                                console.warn(`Card in hand missing instanceId: ${card.name} (${card.id})`);
                            }
                            return (
                                // Container defines size with hover effect - REMOVED hover:scale-110 and cursor-pointer
                                <div
                                    key={instanceId} // Use instanceId for key
                                    className={cn('h-[85%] aspect-[921/1217] rounded-lg transition-all', !isSpectator && selectedKnowledgeId === instanceId ? 'scale-105 card-state-ring' : '')} // Compare with instanceId
                                    ref={(el) => {
                                        if (card.instanceId) registry.register(`hand:${card.instanceId}`, el as unknown as HTMLElement | null);
                                    }}
                                >
                                    <Card
                                        card={card}
                                        onClick={!isDisabled ? () => onHandCardClick(instanceId) : undefined}
                                        showBack={isSpectator}
                                        isSelected={!isSpectator && selectedKnowledgeId === instanceId} // Compare with instanceId
                                        isDisabled={isDisabled} // Pass isDisabled to Card
                                        ariaLabel={`${card.name}, hand card${selectedKnowledgeId === instanceId ? ', selected' : ''}`}
                                    />
                                </div>
                            );
                        })
                    )}
                    {currentPlayerHand.length > maxVisibleCards && (
                        <span className="rounded-md border border-white/10 bg-black/50 px-2 py-1 text-xs text-white">+{currentPlayerHand.length - maxVisibleCards}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HandsColumn;
