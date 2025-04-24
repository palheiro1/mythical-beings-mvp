import React from 'react';
import { Creature, Knowledge, PlayerState } from '../../game/types';
import Card from '../Card'; // Adjust path if needed

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
        <div key={key} className="w-full h-full flex items-center justify-center p-0.5">
            {/* Inner div enforces aspect ratio and takes full height of the cell */}
            <div className="h-full aspect-[2/3]">
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
                    <div className="w-full h-full border border-dashed border-gray-500/50 rounded-lg"></div>
                )}
            </div>
        </div>
    );


    return (
        // Explicitly define rows with minmax(0, 1fr) to allow shrinking
        <div className="grid grid-cols-3 grid-rows-[repeat(4,minmax(0,1fr))] gap-1 justify-items-center items-center w-full h-full bg-black/10 rounded p-1">
            {/* Row 1: Opponent Beings */}
            {opponentPlayer.creatures.map((creature) => renderSlot(
                creature,
                creature.id,
                (creature.rotation ?? 0) + 180, // Add 180 to flip opponent cards, but respect their rotation
                undefined, // No onClick for opponent creatures
                false,
                true // Opponent cards are always disabled for interaction
            ))}

            {/* Row 2: Opponent Spells */}
            {opponentPlayer.field.map((slot) => renderSlot(
                slot.knowledge,
                slot.knowledge ? slot.knowledge.instanceId! : `empty-op-${slot.creatureId}`,
                 180,
                undefined,
                false,
                true // Opponent cards are always disabled
            ))}

            {/* Row 3: Player Spells */}
            {currentPlayer.field.map((slot) => renderSlot(
                slot.knowledge,
                slot.knowledge ? slot.knowledge.instanceId! : `empty-my-${slot.creatureId}`,
                0,
                undefined, // No onClick for field spells (usually)
                false,
                true // Field spells are usually not directly clickable
            ))}

            {/* Row 4: Player Beings */}
            {currentPlayer.creatures.map((creature) => {
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