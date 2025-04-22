import React from 'react';
import Button from '../Button'; // Assuming Button component exists

interface ActionBarProps {
  isMyTurn: boolean;
  phase: string;
  winner: string | null;
  actionsTaken: number;
  onEndTurn?: () => void; // Make optional for spectators
  turnTimer: number;
  actionsPerTurn: number;
  isSpectator: boolean; // Added spectator prop
}

const ActionBar: React.FC<ActionBarProps> = ({
  isMyTurn,
  phase,
  winner,
  actionsTaken,
  onEndTurn,
  turnTimer,
  actionsPerTurn,
  isSpectator, // Use spectator prop
}) => {
  // Log props on every render
  console.log('[ActionBar] Rendering. Props:', { isMyTurn, phase, winner, actionsTaken, isSpectator });

  const actionsRemaining = actionsPerTurn - actionsTaken;
  const canAct = isMyTurn && phase === 'action' && winner === null;

  // Determine display message
  let turnMessage = 'Waiting for opponent...';
  if (isSpectator) {
    turnMessage = 'Spectating';
  } else if (winner) {
    turnMessage = winner === 'draw' ? 'Game Over: Draw!' : `Game Over: ${winner} wins!`;
  } else if (isMyTurn) {
    if (phase === 'knowledge') {
      turnMessage = 'Your Turn: Knowledge Phase';
    } else if (phase === 'action') {
      turnMessage = `Your Turn: Action Phase (${actionsRemaining} actions left)`;
    } else {
      turnMessage = `Your Turn: ${phase.toUpperCase()} Phase`;
    }
  }

  return (
    <div className="flex items-center justify-between p-4 bg-gray-800 text-white h-20">
      {/* Left Side: Turn Status & Timer */}
      <div className="flex flex-col items-start">
        <span className="text-lg font-semibold">{turnMessage}</span>
        {canAct && ( // Show timer only if it's the player's action phase
          <span className="text-sm text-gray-400">Time remaining: {turnTimer}s</span>
        )}
      </div>

      {/* Right Side: End Turn Button (only if player and can act) */}
      {!isSpectator && canAct && onEndTurn && (
        <Button
          onClick={onEndTurn}
          disabled={actionsRemaining > 0} // Disable if actions remain (optional, depends on rules)
          className={`px-6 py-3 rounded-md font-semibold transition-colors duration-200 ${
            actionsRemaining > 0
              ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
              : 'bg-red-600 hover:bg-red-700 text-white'
          }`}
        >
          End Turn
        </Button>
      )}
       {/* Show simple message if spectator */}
       {isSpectator && (
         <div className="text-gray-400 italic">Read-only view</div>
       )}
    </div>
  );
};

export default ActionBar;