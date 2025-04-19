import React from 'react';

interface ActionBarProps {
    isMyTurn: boolean;
    phase: 'knowledge' | 'action' | 'end';
    winner: string | null;
    actionsTaken: number;
    onEndTurn: () => void;
    turnTimer: number; // Added prop for the timer value
    actionsPerTurn: number; // Added prop for max actions
}

const ActionBar: React.FC<ActionBarProps> = ({
    isMyTurn,
    phase,
    winner,
    actionsTaken,
    onEndTurn,
    turnTimer, // Destructure new prop
    actionsPerTurn // Destructure new prop
}) => {
    // Use actionsPerTurn constant passed from GameScreen
    const canEndTurn = actionsTaken >= actionsPerTurn;

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

    // Timer display logic
    const timerDisplay = isMyTurn && phase === 'action' && winner === null ? (
        <span className={`text-2xl font-mono ml-6 px-3 py-1 rounded ${turnTimer <= 10 ? 'text-red-500 animate-pulse' : 'text-blue-600'}`}>
            ⏳ {turnTimer}s
        </span>
    ) : null;


    return (
        <div className="flex-shrink-0 flex justify-between items-center px-8 py-12 bg-white text-gray-900 text-xl font-semibold shadow-lg">
            {/* Left Side: Actions and Timer */}
            <div className="flex items-center gap-6">
                {isMyTurn && phase === 'action' && winner === null && (
                    <button
                        onClick={onEndTurn}
                        disabled={!canEndTurn}
                        className={`px-8 py-4 rounded-lg text-2xl font-bold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5
                            ${!canEndTurn ?
                                'bg-gray-200 text-gray-400 cursor-not-allowed' :
                                'bg-red-600 hover:bg-red-500 text-white'}`}
                        // Use actionsPerTurn in the title and button text
                        title={!canEndTurn ? `Need to take ${actionsPerTurn} actions first!` : "End your turn"}
                    >
                        End Turn {!canEndTurn && `(${actionsTaken}/${actionsPerTurn})`}
                    </button>
                )}
                {!isMyTurn && winner === null && (
                    <span className="text-xl text-gray-400 italic">Waiting for opponent...</span>
                 )}
                 {/* Display Timer Here */}
                 {timerDisplay}
            </div>
            {/* Right Side: Turn Indicator */}
            <div className={`text-3xl ${turnIndicatorClass.replace('text-lg', 'text-3xl')}`}>\n                {turnIndicatorText}\n            </div>
        </div>
    );
};

export default ActionBar;