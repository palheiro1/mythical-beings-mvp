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
        <div className="flex-shrink-0 flex justify-between items-center px-8 py-12 bg-white text-gray-900 text-xl font-semibold shadow-lg">
            {/* Left Side: Actions */}
            <div className="flex gap-6">
                {isMyTurn && phase === 'action' && winner === null && (
                    <button
                        onClick={onEndTurn}
                        disabled={!canEndTurn}
                        className={`px-8 py-4 rounded-lg text-2xl font-bold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5
                            ${!canEndTurn ?
                                'bg-gray-200 text-gray-400 cursor-not-allowed' :
                                'bg-red-600 hover:bg-red-500 text-white'}`}
                        title={!canEndTurn ? "Need to take 2 actions first!" : "End your turn"}
                    >
                        End Turn {!canEndTurn && `(${actionsTaken}/2)`}
                    </button>
                )}
                {!isMyTurn && winner === null && (
                    <span className="text-xl text-gray-400 italic">Waiting for opponent...</span>
                 )}
            </div>
            <div className={`text-3xl ${turnIndicatorClass.replace('text-lg', 'text-3xl')}`}>
                {turnIndicatorText}
            </div>
        </div>
    );
};

export default ActionBar;