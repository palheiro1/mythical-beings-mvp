import React from 'react';

interface ActionBarProps {
    isMyTurn: boolean;
    phase: 'knowledge' | 'action' | 'end';
    winner: string | null;
    actionsTaken: number;
    onEndTurn: () => void;
}

const ActionBar: React.FC<ActionBarProps> = ({
    isMyTurn,
    phase,
    winner,
    actionsTaken,
    onEndTurn
}) => {
    const canEndTurn = actionsTaken >= 2;

    let turnIndicatorText = '';
    let turnIndicatorClass = 'text-gray-400';
    if (winner) {
        turnIndicatorText = `🏆 Winner: Player ${winner === 'p1' ? 1 : 2}! 🎉`;
        turnIndicatorClass = 'text-yellow-400 font-bold text-lg animate-pulse';
    } else if (isMyTurn) {
        turnIndicatorText = "✨ Your Turn! ✨";
        turnIndicatorClass = 'text-green-300 font-bold text-lg';
    } else {
        turnIndicatorText = "⏳ Opponent's Turn...";
        turnIndicatorClass = 'text-red-300 font-semibold';
    }


    return (
        <div className="flex-shrink-0 flex justify-between items-center px-6 py-3 bg-gradient-to-t from-black/90 via-black/70 to-black/80 text-gray-100 shadow-lg">
            {/* Left Side: Actions */}
            <div className="flex gap-3">
                {isMyTurn && phase === 'action' && winner === null && (
                    <button
                        onClick={onEndTurn}
                        disabled={!canEndTurn}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5
                            ${!canEndTurn ?
                                'bg-gray-700 text-gray-500 cursor-not-allowed' :
                                'bg-red-700 hover:bg-red-600 text-white'}`}
                        title={!canEndTurn ? "Need to take 2 actions first!" : "End your turn"}
                    >
                        End Turn {!canEndTurn && `(${actionsTaken}/2)`}
                    </button>
                )}
                {!isMyTurn && winner === null && (
                    <span className="text-sm text-gray-500 italic">Waiting for opponent...</span>
                 )}
            </div>

            {/* Right Side: Turn Indicator */}
            <div className={`text-sm ${turnIndicatorClass}`}>
                {turnIndicatorText}
            </div>
        </div>
    );
};

export default ActionBar;