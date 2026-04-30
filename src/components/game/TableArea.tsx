import React from 'react';
import { Creature, Knowledge, PlayerState } from '../../game/types.js';
import Card from '../Card.js';
import { useCardRegistry } from '../../context/CardRegistry.js';
import { cn } from '../ui/index.js';

interface TableAreaProps {
    currentPlayer: PlayerState;
    opponentPlayer: PlayerState;
    isMyTurn: boolean;
    phase: 'knowledge' | 'action' | 'end';
    selectedKnowledgeId: string | null;
    onCreatureClickForSummon: (creatureId: string) => void;
    onRotateCreature: (creatureId: string) => void;
}

const TableArea: React.FC<TableAreaProps> = ({
    currentPlayer,
    opponentPlayer,
    isMyTurn,
    phase,
    selectedKnowledgeId,
    onCreatureClickForSummon,
    onRotateCreature
}) => {
    const registry = useCardRegistry();

    const handlePlayerCreatureClick = (creatureId: string) => {
        if (isMyTurn && phase === 'action') {
            if (selectedKnowledgeId) {
                onCreatureClickForSummon(creatureId);
            } else {
                onRotateCreature(creatureId);
            }
        }
    };

    const getKnowledgeStatus = (knowledge: Knowledge) => {
        const maxRotations = Math.max(1, knowledge.maxRotations ?? 4);
        const currentStep = Math.min(maxRotations - 1, Math.floor((((knowledge.rotation ?? 0) % 360) + 360) % 360 / 90));
        const value = knowledge.valueCycle?.[currentStep];
        const effectLabel = typeof value === 'number'
            ? value > 0
                ? `${value} dmg`
                : value < 0
                    ? `${Math.abs(value)} def`
                    : '0'
            : 'Effect';

        return {
            steps: maxRotations,
            currentStep,
            effectLabel,
            isFinalNext: currentStep >= maxRotations - 1,
        };
    };

    const getKnowledgeForCreature = (player: PlayerState, creatureId?: string) => {
        if (!creatureId) return null;
        return player.field.find(slot => slot.creatureId === creatureId)?.knowledge ?? null;
    };

    const renderEmptySlot = (label: string, compact = false) => (
        <div className={cn(
            'grid h-full w-full place-items-center rounded-xl border border-dashed border-white/[0.12] bg-white/[0.018]',
            compact ? 'min-h-0' : '',
        )}>
            <div className="grid place-items-center gap-1 text-center">
                <div className={cn(
                    'rounded-full border border-violet-200/[0.15] bg-violet-500/10 shadow-inner',
                    compact ? 'h-7 w-7' : 'h-10 w-10',
                )} />
                <span className="max-w-full truncate px-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</span>
            </div>
        </div>
    );

    const renderSlot = ({
        cardData,
        keyName,
        rotation = 0,
        onClick,
        isSelected,
        isDisabled,
        kind,
        emptyLabel,
    }: {
        cardData: Creature | Knowledge | null;
        keyName: string;
        rotation?: number;
        onClick?: () => void;
        isSelected?: boolean;
        isDisabled?: boolean;
        kind: 'creature' | 'knowledge';
        emptyLabel: string;
    }) => {
        const isKnowledge = kind === 'knowledge';
        const knowledge = isKnowledge ? cardData as Knowledge | null : null;
        const slotSize = isKnowledge ? 112 : 132;

        return (
            <div
                key={keyName}
                className={cn(
                    'relative min-h-0 min-w-0 overflow-visible rounded-xl border bg-black/[0.14] p-1.5',
                    isKnowledge ? 'border-cyan-200/10' : 'border-amber-200/[0.12]',
                    selectedKnowledgeId && !isKnowledge && onClick && !isDisabled ? 'ring-1 ring-amber-300/50' : '',
                )}
                ref={(el) => {
                    if (!el) return;
                    registry.register(`table:${keyName}`, el as unknown as HTMLElement | null);
                    const instanceId = (cardData as Knowledge | null)?.instanceId;
                    if (instanceId) registry.register(`table:${instanceId}`, el as unknown as HTMLElement | null);
                    if (cardData?.id) registry.register(`table:${cardData.id}`, el as unknown as HTMLElement | null);
                }}
            >
                {cardData ? (
                    <div
                        className="mx-auto grid place-items-center overflow-visible"
                        style={{ width: `${slotSize}px`, height: `${slotSize}px` }}
                    >
                        <Card
                            card={cardData}
                            rotation={rotation}
                            onClick={onClick}
                            isSelected={isSelected}
                            isDisabled={isDisabled}
                            fit="board"
                            knowledgeStatus={knowledge ? getKnowledgeStatus(knowledge) : undefined}
                        />
                    </div>
                ) : (
                    <div
                        className="mx-auto grid place-items-center"
                        style={{ width: `${slotSize}px`, height: `${slotSize}px` }}
                    >
                        {renderEmptySlot(emptyLabel, isKnowledge)}
                    </div>
                )}
            </div>
        );
    };

    const laneCount = Math.max(currentPlayer.creatures.length, opponentPlayer.creatures.length, 3);

    return (
        <div className="relative grid h-full w-full grid-cols-3 gap-3 overflow-visible rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_48%,rgba(139,92,246,0.16),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] p-3 shadow-inner">
            <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px bg-gradient-to-r from-transparent via-amber-200/25 to-transparent" />

            {Array.from({ length: laneCount }).map((_, index) => {
                const opponentCreature = opponentPlayer.creatures[index];
                const currentCreature = currentPlayer.creatures[index];
                const opponentKnowledge = getKnowledgeForCreature(opponentPlayer, opponentCreature?.id);
                const currentKnowledge = getKnowledgeForCreature(currentPlayer, currentCreature?.id);
                const isDisabled = !isMyTurn || phase !== 'action';

                return (
                    <div
                        key={`lane-${index}`}
                        className="relative grid min-h-0 grid-rows-[minmax(0,1.05fr)_minmax(0,0.86fr)_minmax(0,0.86fr)_minmax(0,1.05fr)] gap-2 overflow-visible rounded-xl border border-white/[0.08] bg-black/[0.16] p-2"
                    >
                        <div className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-violet-200/0 via-violet-200/[0.12] to-violet-200/0" />

                        {renderSlot({
                            cardData: opponentCreature ?? null,
                            keyName: opponentCreature ? `op-creature-${opponentCreature.id}` : `op-creature-empty-${index}`,
                            rotation: ((opponentCreature?.rotation ?? 0) + 180),
                            isDisabled: true,
                            kind: 'creature',
                            emptyLabel: 'Opponent',
                        })}

                        <div ref={(el) => { if (el && opponentCreature) registry.register(`tableSlot:${opponentCreature.id}`, el as unknown as HTMLElement | null); }} className="min-h-0 overflow-visible">
                            {renderSlot({
                                cardData: opponentKnowledge,
                                keyName: opponentKnowledge ? `op-knowledge-${opponentKnowledge.instanceId}` : `op-knowledge-empty-${opponentCreature?.id ?? index}`,
                                rotation: ((opponentKnowledge?.rotation ?? 0) + 180),
                                isDisabled: true,
                                kind: 'knowledge',
                                emptyLabel: 'Knowledge',
                            })}
                        </div>

                        <div ref={(el) => { if (el && currentCreature) registry.register(`tableSlot:${currentCreature.id}`, el as unknown as HTMLElement | null); }} className="min-h-0 overflow-visible">
                            {renderSlot({
                                cardData: currentKnowledge,
                                keyName: currentKnowledge ? `my-knowledge-${currentKnowledge.instanceId}` : `my-knowledge-empty-${currentCreature?.id ?? index}`,
                                rotation: currentKnowledge?.rotation ?? 0,
                                isDisabled: true,
                                kind: 'knowledge',
                                emptyLabel: 'Knowledge',
                            })}
                        </div>

                        {renderSlot({
                            cardData: currentCreature ?? null,
                            keyName: currentCreature ? `my-creature-${currentCreature.id}` : `my-creature-empty-${index}`,
                            rotation: currentCreature?.rotation ?? 0,
                            onClick: currentCreature ? () => handlePlayerCreatureClick(currentCreature.id) : undefined,
                            isSelected: selectedKnowledgeId !== null && !!currentCreature,
                            isDisabled,
                            kind: 'creature',
                            emptyLabel: 'Your creature',
                        })}
                    </div>
                );
            })}
        </div>
    );
};

export default TableArea;
