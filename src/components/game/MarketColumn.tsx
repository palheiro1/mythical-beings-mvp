import React from 'react';
import { Knowledge } from '../../game/types.js';
import Card from '../Card.js'; // Adjust path if needed
import { useCardRegistry } from '../../context/CardRegistry.js';
import { RefreshCw } from 'lucide-react';
import { StatusBadge } from '../ui/index.js';

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
    const registry = useCardRegistry();
    return (
        <div className="flex h-full min-h-[300px] flex-col items-center space-y-3 overflow-hidden rounded-2xl border border-white/10 bg-cyan-500/[0.04] px-2 py-3 xl:min-h-0">
            <div className="flex w-full items-center justify-between px-1">
                <StatusBadge tone="blue">Market</StatusBadge>
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-slate-300">
                    <RefreshCw className="h-3 w-3" aria-hidden />
                    {marketCards.length}
                </span>
            </div>
            {/* Deck */}
            {/* Container defines size and aspect ratio */}
            <div className="relative aspect-[921/1217] w-[78%] max-w-[112px] flex-shrink-0">
                <Card card={{ id: 'marketdeck', name: 'Deck', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '', element: 'neutral' }} showBack isDisabled /> {/* Removed size, added isDisabled */}
                <span className="absolute -bottom-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-cyan-300/30 bg-black/80 text-xs font-bold text-cyan-100">{deckCount}</span>
            </div>

            {/* Market Cards */}
            <div className="arena-scrollbar flex w-full flex-grow flex-col items-center space-y-2 overflow-y-auto pr-1">
                {marketCards.map((card, idx) => {
                    const isDisabled = !isMyTurn || phase !== 'action';
                    return (
                        // Container defines size and aspect ratio
                        <div
                            key={card.instanceId || `${card.id}-${idx}`}
                            className={`aspect-[921/1217] w-[92%] max-w-[132px] flex-shrink-0 ${!isDisabled ? 'transition-transform hover:scale-[1.03]' : ''}`}
                            ref={(el) => {
                                if (card.instanceId) registry.register(`market:${card.instanceId}`, el as unknown as HTMLElement | null);
                            }}
                        >
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
