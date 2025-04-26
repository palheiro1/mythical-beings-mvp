"use strict";
exports.__esModule = true;
var react_1 = require("react");
var Card_1 = require("../Card"); // Adjust path if needed
var TableArea = function (_a) {
    var currentPlayer = _a.currentPlayer, opponentPlayer = _a.opponentPlayer, isMyTurn = _a.isMyTurn, phase = _a.phase, selectedKnowledgeId = _a.selectedKnowledgeId, onCreatureClickForSummon = _a.onCreatureClickForSummon, onRotateCreature = _a.onRotateCreature;
    var handlePlayerCreatureClick = function (creatureId) {
        if (isMyTurn && phase === 'action') {
            if (selectedKnowledgeId) {
                onCreatureClickForSummon(creatureId);
            }
            else {
                onRotateCreature(creatureId);
            }
        }
    };
    // Helper to render a slot (either a card or an empty placeholder)
    var renderSlot = function (cardData, key, rotation, onClick, isSelected, isDisabled) {
        if (rotation === void 0) { rotation = 0; }
        return (
        // Outer div fills the grid cell and centers content
        <div key={key} className="w-full h-full flex items-center justify-center p-0.5">
            {/* Inner div enforces aspect ratio and takes full height of the cell */}
            <div className="h-full aspect-[2/3]">
                {cardData ? (<Card_1["default"] card={cardData} rotation={rotation} onClick={onClick} // onClick is already conditional based on props
             isSelected={isSelected} isDisabled={isDisabled} // Pass isDisabled prop
            />) : (
            // Make placeholder also respect aspect ratio
            <div className="w-full h-full border border-dashed border-gray-500/50 rounded-lg"></div>)}
            </div>
        </div>);
    };
    return (
    // Explicitly define rows with minmax(0, 1fr) to allow shrinking
    <div className="grid grid-cols-3 grid-rows-[repeat(4,minmax(0,1fr))] gap-1 justify-items-center items-center w-full h-full bg-black/10 rounded p-1">
            {/* Row 1: Opponent Beings */}
            {opponentPlayer.creatures.map(function (creature) {
            var _a;
            return renderSlot(creature, creature.id, ((_a = creature.rotation) !== null && _a !== void 0 ? _a : 0) + 180, // Add 180 to flip opponent cards, but respect their rotation
            undefined, // No onClick for opponent creatures
            false, true // Opponent cards are always disabled for interaction
            );
        })}

            {/* Row 2: Opponent Spells */}
            {opponentPlayer.field.map(function (slot) { return renderSlot(slot.knowledge, slot.knowledge ? slot.knowledge.instanceId : "empty-op-".concat(slot.creatureId), 180, undefined, false, true // Opponent cards are always disabled
        ); })}

            {/* Row 3: Player Spells */}
            {currentPlayer.field.map(function (slot) { return renderSlot(slot.knowledge, slot.knowledge ? slot.knowledge.instanceId : "empty-my-".concat(slot.creatureId), 0, undefined, // No onClick for field spells (usually)
        false, true // Field spells are usually not directly clickable
        ); })}

            {/* Row 4: Player Beings */}
            {currentPlayer.creatures.map(function (creature) {
            var _a;
            var isDisabled = !isMyTurn || phase !== 'action';
            return renderSlot(creature, creature.id, (_a = creature.rotation) !== null && _a !== void 0 ? _a : 0, // Use the creature's rotation value
            function () { return handlePlayerCreatureClick(creature.id); }, // Keep original onClick logic
            selectedKnowledgeId !== null, // Highlight all player creatures when selecting target
            isDisabled // Pass calculated isDisabled state
            );
        })}
        </div>);
};
exports["default"] = TableArea;
