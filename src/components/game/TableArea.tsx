import React from 'react';
import { Creature, Knowledge, PlayerState } from '../../game/types.js';
import Card from '../Card.js'; // Adjust path if needed
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

    // Helper to render a slot (either a card or an empty placeholder)
    const renderSlot = (cardData: Creature | Knowledge | null, key: string, rotation = 0, onClick?: () => void, isSelected?: boolean, isDisabled?: boolean) => (
        // Outer div fills the grid cell and centers content
        <div key={key} className="w-full h-full flex items-center justify-center p-0.5" ref={(el) => { if (el) registry.register(`table:${key}`, el as unknown as HTMLElement | null); }}>
            {/* Inner div enforces aspect ratio and takes full height of the cell */}
            <div className={cn('h-full aspect-[2/3] rounded-xl', onClick && !isDisabled ? 'transition-transform hover:-translate-y-0.5 hover:scale-[1.02]' : '')}>
                {cardData ? (
                    <Card
                        card={cardData}
                        rotation={rotation}
                        onClick={onClick} // onClick is already conditional based on props
                        isSelected={isSelected}
                        isDisabled={isDisabled} // Pass isDisabled prop
                    />
                ) : (
                    // Make placeholder also respect aspect ratio
                    <div className="grid h-full w-full place-items-center rounded-xl border border-dashed border-violet-200/20 bg-white/[0.025]">
                        <div className="h-10 w-10 rounded-full border border-white/10 bg-violet-500/10 opacity-50" />
                    </div>
                )}
            </div>
        </div>
    );


    return (
        // Explicitly define rows with minmax(0, 1fr) to allow shrinking
        <div className="grid h-full w-full grid-cols-3 grid-rows-[repeat(4,minmax(0,1fr))] items-center justify-items-center gap-2 rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_50%_50%,rgba(139,92,246,0.16),transparent_42%),rgba(255,255,255,0.03)] p-3 shadow-inner">
            {/* Row 1: Opponent Beings */}
            {opponentPlayer.creatures.map((creature: Creature) => renderSlot(
                creature,
                creature.id,
                (creature.rotation ?? 0) + 180, // Add 180 to flip opponent cards, but respect their rotation
                undefined, // No onClick for opponent creatures
                false,
                true // Opponent cards are always disabled for interaction
            ))}

            {/* Row 2: Opponent Spells */}
                        {opponentPlayer.field.map((slot: { creatureId: string; knowledge: Knowledge | null }) => (
                                <div key={`op-slot-${slot.creatureId}`} className="w-full h-full" ref={(el) => { if (el) registry.register(`tableSlot:${slot.creatureId}`, el as unknown as HTMLElement | null); }}>
                                    {renderSlot(
                                        slot.knowledge,
                                        slot.knowledge ? slot.knowledge.instanceId! : `empty-op-${slot.creatureId}`,
                                        180,
                                        undefined,
                                        false,
                                        true
                                    )}
                                </div>
                        ))}

            {/* Row 3: Player Spells */}
                        {currentPlayer.field.map((slot: { creatureId: string; knowledge: Knowledge | null }) => (
                                <div key={`my-slot-${slot.creatureId}`} className="w-full h-full" ref={(el) => { if (el) registry.register(`tableSlot:${slot.creatureId}`, el as unknown as HTMLElement | null); }}>
                                    {renderSlot(
                                        slot.knowledge,
                                        slot.knowledge ? slot.knowledge.instanceId! : `empty-my-${slot.creatureId}`,
                                        0,
                                        undefined,
                                        false,
                                        true
                                    )}
                                </div>
                        ))}

            {/* Row 4: Player Beings */}
            {currentPlayer.creatures.map((creature: Creature) => {
                const isDisabled = !isMyTurn || phase !== 'action';
                return renderSlot(
                    creature,
                    creature.id,
                    creature.rotation ?? 0, // Use the creature's rotation value
                    () => handlePlayerCreatureClick(creature.id), // Keep original onClick logic
                    selectedKnowledgeId !== null, // Highlight all player creatures when selecting target
                    isDisabled // Pass calculated isDisabled state
                );
            })}
        </div>
    );
};

export default TableArea;
