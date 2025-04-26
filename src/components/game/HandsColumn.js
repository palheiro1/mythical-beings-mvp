"use strict";
exports.__esModule = true;
var react_1 = require("react");
var Card_1 = require("../Card");
var HandsColumn = function (_a) {
    var currentPlayerHand = _a.currentPlayerHand, opponentPlayerHand = _a.opponentPlayerHand, isMyTurn = _a.isMyTurn, phase = _a.phase, selectedKnowledgeId = _a.selectedKnowledgeId, onHandCardClick = _a.onHandCardClick;
    var maxVisibleCards = 5; // Keep this logic for now
    return (<div className="h-full w-full flex flex-col overflow-hidden rounded-lg">
            {/* Opponent Hand Area - reduced from flex-1 to flex-none with fixed height */}
            <div className="flex-none h-1/5 flex flex-col items-center justify-center p-2 overflow-hidden relative">
                <span className="text-gray-200 text-sm font-medium absolute top-1 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black/30 rounded-full">
                    Opponent ({opponentPlayerHand.length})
                </span>
                <div className="flex justify-center items-center gap-2 w-full h-full p-1">
                    {opponentPlayerHand.length === 0 ? (
        // Container defines size
        <div className="h-[85%] aspect-[2/3]">
                            <Card_1["default"] card={{ id: 'opp-back', name: 'Back', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '', element: 'neutral' }} showBack isDisabled/>
                         </div>) : (opponentPlayerHand.slice(0, maxVisibleCards).map(function (card, idx) { return (
        // Container defines size - REMOVED hover:scale-105
        <div key={card.id + idx + '-opp'} className="h-[85%] aspect-[2/3] transition-all">
                                <Card_1["default"] card={card} showBack isDisabled/>
                            </div>); }))}
                    {opponentPlayerHand.length > maxVisibleCards && (<span className="text-xs text-white bg-black/50 px-2 py-1 rounded-full">+{opponentPlayerHand.length - maxVisibleCards}</span>)}
                </div>
            </div>

            <hr className="border-white/20 w-full mx-auto"/>

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

            <hr className="border-white/20 w-full mx-auto"/>

            {/* Player Hand Area - reduced from flex-1 to flex-none with fixed height */}
            <div className="flex-none h-1/5 flex flex-col items-center justify-center p-2 overflow-hidden relative">
                <span className="text-gray-200 text-sm font-medium absolute bottom-1 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-black/30 rounded-full">
                    Your Hand ({currentPlayerHand.length}/5)
                </span>
                <div className="flex justify-center items-center gap-2 w-full h-full p-1">
                    {currentPlayerHand.length === 0 ? (
        // Container defines size
        <div className="h-[85%] aspect-[2/3]">
                            <Card_1["default"] card={{ id: 'player-back', name: 'Back', image: '/images/spells/back.jpg', type: 'spell', cost: 0, effect: '', element: 'neutral' }} showBack isDisabled/>
                        </div>) : (currentPlayerHand.slice(0, maxVisibleCards).map(function (card, idx) {
            var isDisabled = !isMyTurn || phase !== 'action';
            return (
            // Container defines size with hover effect - REMOVED hover:scale-110 and cursor-pointer
            <div key={card.id + idx + '-player'} className={"h-[85%] aspect-[2/3] transition-all ".concat(selectedKnowledgeId === card.id ? 'ring-2 ring-yellow-400 scale-105' : '')} onClick={!isDisabled ? function () { return onHandCardClick(card.id); } : undefined}>
                                    <Card_1["default"] card={card} isSelected={selectedKnowledgeId === card.id} isDisabled={isDisabled} // Pass isDisabled to Card
            />
                                </div>);
        }))}
                    {currentPlayerHand.length > maxVisibleCards && (<span className="text-xs text-white bg-black/50 px-2 py-1 rounded-full">+{currentPlayerHand.length - maxVisibleCards}</span>)}
                </div>
            </div>
        </div>);
};
exports["default"] = HandsColumn;
