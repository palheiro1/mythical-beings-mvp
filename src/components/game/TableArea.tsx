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
            'grid h-full w-full place-items-center rounded-lg border border-dashed border-[rgba(220,200,162,0.14)] bg-black/[0.18]',
            compact ? 'min-h-0' : '',
        )}>
            <div className="grid place-items-center gap-1 text-center">
                <div className={cn(
                    'rounded-full border border-cyan-200/[0.18] bg-cyan-500/[0.06] shadow-inner',
                    compact ? 'h-7 w-7' : 'h-10 w-10',
                )} />
                <span className="hidden max-w-full truncate px-2 text-[10px] font-bold uppercase tracking-normal text-slate-500 sm:block">{label}</span>
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
        const slotSize = isKnowledge ? 'clamp(78px, 20vw, 112px)' : 'clamp(92px, 24vw, 132px)';

        return (
            <div
                key={keyName}
                className={cn(
                    'relative min-h-0 min-w-0 overflow-visible rounded-lg border bg-black/[0.2] p-1.5 shadow-[inset_0_1px_12px_rgba(0,0,0,0.28)]',
                    isKnowledge ? 'border-cyan-200/[0.13]' : 'border-amber-200/[0.16]',
                    selectedKnowledgeId && !isKnowledge && onClick && !isDisabled ? 'arcane-focus' : '',
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
                        style={{ width: slotSize, height: slotSize }}
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
                        style={{ width: slotSize, height: slotSize }}
                    >
                        {renderEmptySlot(emptyLabel, isKnowledge)}
                    </div>
                )}
            </div>
        );
    };

    const laneCount = Math.max(currentPlayer.creatures.length, opponentPlayer.creatures.length, 3);

    return (
        <div className="surface-playmat relative grid h-full min-h-[460px] w-full grid-cols-3 gap-2 overflow-visible rounded-xl border p-2 sm:gap-3 sm:p-3 xl:min-h-0">
            <div className="pointer-events-none absolute inset-x-4 top-1/2 h-px bg-gradient-to-r from-transparent via-amber-200/45 to-transparent" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-amber-200/16 bg-black/20 text-[10px] font-black uppercase tracking-normal text-amber-100/35 shadow-inner">
                Duel
            </div>

            {Array.from({ length: laneCount }).map((_, index) => {
                const opponentCreature = opponentPlayer.creatures[index];
                const currentCreature = currentPlayer.creatures[index];
                const opponentKnowledge = getKnowledgeForCreature(opponentPlayer, opponentCreature?.id);
                const currentKnowledge = getKnowledgeForCreature(currentPlayer, currentCreature?.id);
                const isDisabled = !isMyTurn || phase !== 'action';

                return (
                    <div
                        key={`lane-${index}`}
                        className="relative grid min-h-0 grid-rows-[minmax(0,1.05fr)_minmax(0,0.86fr)_minmax(0,0.86fr)_minmax(0,1.05fr)] gap-2 overflow-visible rounded-lg border border-[rgba(220,200,162,0.11)] bg-black/[0.18] p-2 shadow-[inset_0_0_28px_rgba(0,0,0,0.34)]"
                    >
                        <div className="pointer-events-none absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-gradient-to-b from-violet-200/0 via-cyan-200/[0.14] to-violet-200/0" />
                        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-transparent via-amber-200/[0.11] to-transparent" />

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
