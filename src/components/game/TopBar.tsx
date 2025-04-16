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
        <div className="flex-shrink-0 px-8 py-12 bg-white text-gray-900 text-xl font-semibold shadow-md w-full">
            {/* Inner container for centering content */}
            <div className="w-full max-w-screen-xl mx-auto flex justify-between items-center">
                {/* Left Side: Game Info */}
                <div className="flex items-center gap-10">
                    <span className="font-bold text-4xl text-purple-700 drop-shadow-sm">Game: {gameId || '???'}</span>
                    <span className="flex items-center gap-3" title="Turn Number">
                        <span className="text-4xl">⏳</span>
                        <span className="font-semibold text-2xl">{turn}</span>
                    </span>
                    <span className="flex items-center gap-3" title="Current Phase">
                        <span className="text-4xl">{phaseIcons[phase]}</span>
                        <span className="uppercase font-bold text-2xl text-yellow-600">{phase}</span>
                    </span>
                </div>
                <div className="flex items-center gap-10">
                    <span className="flex items-center gap-3 text-green-700" title="Your Power">
                        <span className="text-4xl">💪</span>
                        <span className="font-semibold text-2xl">{currentPlayerPower}</span>
                    </span>
                    <span className="flex items-center gap-3 text-red-700" title="Opponent's Power">
                        <span className="text-4xl">👻</span>
                        <span className="font-semibold text-2xl">{opponentPlayerPower}</span>
                    </span>
                    <span className="flex items-center gap-3 text-yellow-700" title="Actions Remaining">
                        <span className="text-4xl">⚡</span>
                        <span className="font-semibold text-2xl">{actionsRemaining}/2</span>
                    </span>
                    <span className="flex items-center gap-3 text-blue-700" title="Cards in Market">
                        <span className="text-4xl">🛒</span>
                        <span className="font-semibold text-2xl">{marketCount}</span>
                    </span>
                    {selectedKnowledgeId && (
                        <button
                            onClick={onCancelSelection}
                            className="px-6 py-4 rounded-md bg-yellow-400 hover:bg-yellow-300 text-black text-xl font-bold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
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