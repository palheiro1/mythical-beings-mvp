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
            <div className="flex min-h-[108px] shrink-0 flex-col gap-2 overflow-hidden p-2 xl:min-h-0 xl:basis-[24%]" ref={oppHandRef}>
                <div className="shrink-0">
                    <StatusBadge tone="muted">{opponentPlayerLabel} ({opponentPlayerHand.length})</StatusBadge>
                </div>
                <div className="arena-scrollbar flex min-h-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden p-1 xl:grid xl:grid-cols-2 xl:place-items-center xl:gap-1.5 xl:overflow-hidden">
                    {opponentPlayerHand.length === 0 ? (
                         // Container defines size
                         <div className="aspect-[921/1217] h-[82px] shrink-0 xl:h-auto xl:w-full xl:max-w-[68px]">
                            <Card card={{ id: 'opp-back', name: 'Back', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '', element: 'neutral' }} showBack isDisabled />
                         </div>
                    ) : (
                        opponentPlayerHand.slice(0, maxVisibleCards).map((card, idx) => (
                            // Container defines size - REMOVED hover:scale-105
                            <div key={card.id + idx + '-opp'} className="aspect-[921/1217] h-[82px] shrink-0 transition-all xl:h-auto xl:w-full xl:max-w-[68px]">
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

            <div className="flex min-h-[190px] flex-1 flex-col gap-2 overflow-hidden p-2 xl:min-h-0" ref={myHandRef}>
                <div className="shrink-0">
                    <StatusBadge tone={isMyTurn && phase === 'action' ? 'violet' : 'muted'}>{currentPlayerLabel} ({currentPlayerHand.length}/5)</StatusBadge>
                </div>
                <div className="arena-scrollbar flex min-h-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden p-1 xl:grid xl:grid-cols-2 xl:content-start xl:items-start xl:justify-items-center xl:overflow-x-hidden xl:overflow-y-auto xl:pr-1">
                    {currentPlayerHand.length === 0 ? (
                        // Container defines size
                        <div className="aspect-[921/1217] h-[142px] shrink-0 xl:h-auto xl:w-full xl:max-w-[112px]">
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
                                    className={cn('aspect-[921/1217] h-[142px] shrink-0 rounded-lg transition-all xl:h-auto xl:w-full xl:max-w-[112px]', !isSpectator && selectedKnowledgeId === instanceId ? 'card-state-ring' : '')} // Compare with instanceId
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
