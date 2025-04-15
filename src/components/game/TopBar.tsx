import React from 'react';

interface TopBarProps {
    gameId: string | undefined;
    turn: number;
    phase: 'knowledge' | 'action' | 'end';
    currentPlayerPower: number;
    opponentPlayerPower: number;
    actionsRemaining: number;
    marketCount: number;
    selectedKnowledgeId: string | null;
    onCancelSelection: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
    gameId,
    turn,
    phase,
    currentPlayerPower,
    opponentPlayerPower,
    actionsRemaining,
    marketCount,
    selectedKnowledgeId,
    onCancelSelection
}) => {
    const phaseIcons = {
        knowledge: '🧠',
        action: '⚔️',
        end: '🏁'
    };

    return (
        // Reverted background to dark gradient, ensure text is light
        <div className="flex-shrink-0 px-6 py-3 bg-gradient-to-b from-black/90 via-black/70 to-black/80 text-gray-100 text-sm shadow-md w-full">
            {/* Inner container for centering content */}
            <div className="w-full max-w-screen-xl mx-auto flex justify-between items-center">
                {/* Left Side: Game Info */}
                <div className="flex items-center gap-4">
                    {/* Use light text colors */}
                    <span className="font-bold text-xl text-purple-300 drop-shadow-sm">Game: {gameId || '???'}</span>
                    <span className="flex items-center gap-1" title="Turn Number">
                        <span className="text-lg">⏳</span>
                        <span className="font-semibold">{turn}</span>
                    </span>
                    <span className="flex items-center gap-1" title="Current Phase">
                        <span className="text-lg">{phaseIcons[phase]}</span>
                        <span className="uppercase font-semibold text-yellow-300">{phase}</span>
                    </span>
                </div>

                {/* Right Side: Player Stats & Actions */}
                <div className="flex items-center gap-4">
                     {/* Use light text colors */}
                     <span className="flex items-center gap-1 text-green-400" title="Your Power">
                        <span className="text-lg">💪</span>
                        <span className="font-semibold">{currentPlayerPower}</span>
                     </span>
                     <span className="flex items-center gap-1 text-red-400" title="Opponent's Power">
                        <span className="text-lg">👻</span>
                        <span className="font-semibold">{opponentPlayerPower}</span>
                     </span>
                     <span className="flex items-center gap-1 text-yellow-400" title="Actions Remaining">
                        <span className="text-lg">⚡</span>
                        <span className="font-semibold">{actionsRemaining}/2</span>
                     </span>
                     <span className="flex items-center gap-1 text-blue-400" title="Cards in Market">
                        <span className="text-lg">🛒</span>
                        <span className="font-semibold">{marketCount}</span>
                     </span>
                    {selectedKnowledgeId && (
                        <button
                            onClick={onCancelSelection}
                            // Keep button style, text is already dark on yellow bg
                            className="px-3 py-1 rounded-md bg-yellow-600 hover:bg-yellow-500 text-black text-xs font-bold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
                            title="Cancel Selection"
                        >
                            Oops! Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TopBar;