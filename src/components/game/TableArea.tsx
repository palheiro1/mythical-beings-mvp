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
    const renderSlot = (cardData: Creature | Knowledge | null, key: string, rotation = 0, onClick?: () => void, isSelected?: boolean) => (
        // This div now fully controls the size and aspect ratio of the card inside
        <div key={key} className="w-full h-full flex items-center justify-center p-0.5 aspect-[2/3]"> {/* Enforce aspect ratio */}
            {cardData ? (
                <Card
                    card={cardData}
                    rotation={rotation}
                    onClick={onClick}
                    isSelected={isSelected}
                />
            ) : (
                <div className="w-full h-full border border-dashed border-gray-500/50 rounded-lg"></div>
            )}
        </div>
    );


    return (
        // The grid layout defines the cells where cards will be placed
        <div className="grid grid-cols-3 grid-rows-4 gap-1 justify-items-center items-center w-full h-full overflow-hidden bg-black/10 rounded p-1">
            {/* Row 1: Opponent Beings */}
            {opponentPlayer.creatures.map((creature) => renderSlot(
                creature, 
                creature.id, 
                (creature.rotation ?? 0) + 180 // Add 180 to flip opponent cards, but respect their rotation
            ))}

            {/* Row 2: Opponent Spells */}
            {opponentPlayer.field.map((slot, idx) => renderSlot(slot.knowledge, slot.creatureId + idx, 180))}

            {/* Row 3: Player Spells */}
            {currentPlayer.field.map((slot, idx) => renderSlot(slot.knowledge, slot.creatureId + idx + 10))}

            {/* Row 4: Player Beings */}
            {currentPlayer.creatures.map((creature) => renderSlot(
                creature,
                creature.id,
                creature.rotation ?? 0, // Use the creature's rotation value
                () => handlePlayerCreatureClick(creature.id),
                selectedKnowledgeId !== null // Highlight all player creatures when selecting target
            ))}
        </div>
    );
};

export default TableArea;