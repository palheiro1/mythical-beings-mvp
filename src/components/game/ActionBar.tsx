import React from 'react';

interface ActionBarProps {
  isMyTurn: boolean;
  phase: string;
  winner: string | null;
  actionsTaken: number;
  actionsPerTurn: number;
  turnTimer: number; // Changed to required number
  isSpectator: boolean;
  playerUsername?: string; // Optional: For winner message
  opponentUsername?: string; // Optional: For winner message
  onEndTurnClick: () => void; // Add callback for end turn button
}

const ActionBar: React.FC<ActionBarProps> = ({
  isMyTurn,
  phase,
  winner,
  actionsTaken,
  actionsPerTurn,
  turnTimer,
  isSpectator,
  playerUsername,
  opponentUsername,
  onEndTurnClick, // Destructure the new prop
}) => {

  const validActionsTaken = typeof actionsTaken === 'number' ? actionsTaken : 0;
  const validActionsPerTurn = typeof actionsPerTurn === 'number' && actionsPerTurn > 0 ? actionsPerTurn : 2;
  const actionsLeft = Math.max(0, validActionsPerTurn - validActionsTaken);

  console.log('[ActionBar] Rendering. Props:', { isMyTurn, phase, winner, actionsTaken, actionsPerTurn, turnTimer, isSpectator });

  const getPhaseMessage = () => {
    if (winner) {
        const winnerName = winner === playerUsername ? playerUsername : (winner === opponentUsername ? opponentUsername : `Player (${winner.substring(0, 6)})`);
        return `Game Over! Winner: ${winnerName}`;
    }
    if (isSpectator) return "Spectating";
    if (!isMyTurn) return "Opponent's Turn";

    switch (phase) {
      case 'knowledge':
        return "Your Turn: Knowledge Phase";
      case 'action':
        const actionsText = isNaN(actionsLeft) ? '...' : actionsLeft;
        const turnText = isNaN(validActionsPerTurn) ? '...' : validActionsPerTurn;
        // Display timer only during action phase and if it's my turn
        const timerText = isMyTurn ? ` - Time: ${turnTimer}s` : ''; 
        return `Your Turn: Action Phase (${actionsText}/${turnText} actions left${timerText})`;
      case 'loading':
          return "Loading...";
      case 'end':
          return "Game Ended";
      default:
        return `Your Turn: ${phase}`;
    }
  };

  const canEndTurn = isMyTurn && phase === 'action' && !winner;

  return (
    <div className="flex items-center justify-between p-3 bg-gray-800/90 text-white h-16 border-t border-gray-700">
      <div className="flex-1 text-left pl-4"> {/* Placeholder for potential left-side content */}
      </div>
      <div className="flex-1 text-center">
        <span className="text-lg font-semibold">{getPhaseMessage()}</span>
      </div>
      <div className="flex-1 text-right pr-4"> {/* Container for the button */}
        {canEndTurn && (
          <button
            onClick={onEndTurnClick}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white font-semibold transition-colors duration-150"
          >
            End Turn
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionBar;