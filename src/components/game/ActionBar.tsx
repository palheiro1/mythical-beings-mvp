import React from 'react';

interface ActionBarProps {
  isMyTurn: boolean;
  phase: string;
  winner: string | null;
  actionsTaken: number;
  actionsPerTurn: number; // Ensure this is passed down
  onEndTurn?: () => void; // Make optional if spectator or not turn
  turnTimer: number; // Example prop
  isSpectator: boolean;
}

const ActionBar: React.FC<ActionBarProps> = ({
  isMyTurn,
  phase,
  winner,
  actionsTaken,
  actionsPerTurn, // Destructure actionsPerTurn
  onEndTurn,
  turnTimer,
  isSpectator,
}) => {

  // Calculate actions left, ensuring values are numbers
  const validActionsTaken = typeof actionsTaken === 'number' ? actionsTaken : 0;
  const validActionsPerTurn = typeof actionsPerTurn === 'number' ? actionsPerTurn : 3; // Default to 3 if invalid
  const actionsLeft = validActionsPerTurn - validActionsTaken;

  console.log('[ActionBar] Rendering. Props:', { isMyTurn, phase, winner, actionsTaken, actionsPerTurn, isSpectator }); // Log props including actionsPerTurn

  const getPhaseMessage = () => {
    if (winner) return `Game Over! Winner: ${winner}`; // Simplified winner message
    if (isSpectator) return "Spectating";
    if (!isMyTurn) return "Opponent's Turn";

    switch (phase) {
      case 'knowledge':
        return "Your Turn: Knowledge Phase";
      case 'action':
        // Use the calculated actionsLeft
        const actionsText = isNaN(actionsLeft) ? '...' : actionsLeft; // Display '...' if NaN persists
        return `Your Turn: Action Phase (${actionsText} actions left)`;
      case 'upkeep':
        return "Your Turn: Upkeep Phase";
      default:
        return `Your Turn: ${phase}`;
    }
  };

  const canEndTurn = isMyTurn && onEndTurn && !winner; // && phase !== 'knowledge'; // Allow ending turn anytime?

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/90 text-white h-16 border-t border-gray-700">
      <div className="flex items-center space-x-4">
        {/* Placeholder for potential future elements like timers or logs */}
        {/* <span className="text-lg font-mono">⏳ {turnTimer}s</span> */}
      </div>

      <div className="text-center">
        <span className="text-lg font-semibold">{getPhaseMessage()}</span>
      </div>

      <div className="flex items-center space-x-4">
        <button
          onClick={onEndTurn}
          disabled={!canEndTurn}
          className={`px-6 py-2 rounded font-semibold transition-colors duration-200 ${
            canEndTurn
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-600 text-gray-400 cursor-not-allowed'
          }`}
        >
          End Turn
        </button>
      </div>
    </div>
  );
};

export default ActionBar;