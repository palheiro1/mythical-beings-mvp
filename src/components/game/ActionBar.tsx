import React from 'react';

interface ActionBarProps {
  isMyTurn: boolean;
  phase: string;
  winner: string | null;
  actionsTaken: number;
  actionsPerTurn: number;
  turnTimer?: number; // Optional timer
  isSpectator: boolean;
  playerUsername?: string; // Optional: For winner message
  opponentUsername?: string; // Optional: For winner message
}

const ActionBar: React.FC<ActionBarProps> = ({
  isMyTurn,
  phase,
  winner,
  actionsTaken,
  actionsPerTurn,
  isSpectator,
  playerUsername,
  opponentUsername,
}) => {

  const validActionsTaken = typeof actionsTaken === 'number' ? actionsTaken : 0;
  const validActionsPerTurn = typeof actionsPerTurn === 'number' && actionsPerTurn > 0 ? actionsPerTurn : 2;
  const actionsLeft = Math.max(0, validActionsPerTurn - validActionsTaken);

  console.log('[ActionBar] Rendering. Props:', { isMyTurn, phase, winner, actionsTaken, actionsPerTurn, isSpectator });

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
        return `Your Turn: Action Phase (${actionsText}/${turnText} actions left)`;
      case 'loading':
          return "Loading...";
      case 'end':
          return "Game Ended";
      default:
        return `Your Turn: ${phase}`;
    }
  };

  return (
    <div className="flex items-center justify-center p-3 bg-gray-800/90 text-white h-16 border-t border-gray-700">
      <div className="text-center">
        <span className="text-lg font-semibold">{getPhaseMessage()}</span>
      </div>
    </div>
  );
};

export default ActionBar;