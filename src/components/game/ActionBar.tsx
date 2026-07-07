import React from 'react';
import { Clock3, Hourglass, SkipForward } from 'lucide-react';
import { ArenaButton, StatusBadge } from '../ui/index.js';

interface ActionBarProps {
  isMyTurn: boolean;
  phase: string;
  winner: string | null;
  actionsTaken: number;
  actionsPerTurn: number;
  turnTimer: number; // Changed to required number
  isSpectator: boolean;
  winnerLabel?: string | null;
  currentActorLabel?: string | null;
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
  winnerLabel,
  currentActorLabel,
  onEndTurnClick, // Destructure the new prop
}) => {

  const validActionsTaken = typeof actionsTaken === 'number' ? actionsTaken : 0;
  const validActionsPerTurn = typeof actionsPerTurn === 'number' && actionsPerTurn > 0 ? actionsPerTurn : 2;
  const actionsLeft = Math.max(0, validActionsPerTurn - validActionsTaken);

  const getPhaseMessage = () => {
    if (winner) {
        return `Game Over! Winner: ${winnerLabel || 'Player'}`;
    }
    if (isSpectator) return "Spectating";
    if (!isMyTurn) return currentActorLabel ? `${currentActorLabel}'s Turn` : "Opponent's Turn";

    switch (phase) {
      case 'knowledge':
        return "Your Turn: Knowledge Phase";
      case 'action': {
        const actionsText = isNaN(actionsLeft) ? '...' : actionsLeft;
        const turnText = isNaN(validActionsPerTurn) ? '...' : validActionsPerTurn;
        // Display timer only during action phase and if it's my turn
        const timerText = isMyTurn ? ` - Time: ${turnTimer}s` : ''; 
        return `Your Turn: Action Phase (${actionsText}/${turnText} actions left${timerText})`;
      }
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
    <div className="border-t border-white/10 bg-[#050810]/94 px-3 py-3 text-white shadow-[0_-18px_45px_-30px_rgba(0,0,0,0.95)] backdrop-blur-xl">
      <div className="surface-obsidian grid min-h-16 grid-cols-1 items-center gap-3 rounded-xl border px-4 py-3 md:grid-cols-[240px_1fr_260px]">
      <div className="flex items-center gap-2">
        <StatusBadge tone={winner ? 'red' : isMyTurn ? 'violet' : 'muted'}>
          {winner ? 'Game Over' : isMyTurn ? 'Your Turn' : isSpectator ? 'Spectating' : 'Opponent Turn'}
        </StatusBadge>
      </div>
      <div className="text-center">
        <span className="font-display text-lg font-bold text-slate-100">
          {getPhaseMessage()}
        </span>
      </div>
      <div className="flex items-center justify-end gap-3">
        {isMyTurn && phase === 'action' && (
          <div className="hidden min-w-[136px] items-center gap-2 sm:flex">
            <Clock3 className="h-4 w-4 text-cyan-200" aria-hidden />
            <div className="h-2 flex-1 overflow-hidden rounded-md bg-white/10" aria-hidden>
              <div
                className="h-full bg-gradient-to-r from-cyan-300 to-violet-400 transition-all duration-500"
                style={{ width: `${Math.max(0, Math.min(100, (turnTimer / 30) * 100))}%` }}
              />
            </div>
            <span className="w-8 text-right font-mono text-xs text-cyan-100">{turnTimer}s</span>
          </div>
        )}
        {isMyTurn && phase === 'action' && (
          <StatusBadge tone="amber">
            <Hourglass className="h-3.5 w-3.5" aria-hidden />
            {actionsLeft}/{validActionsPerTurn}
          </StatusBadge>
        )}
        {canEndTurn && (
          <ArenaButton
            type="button"
            onClick={onEndTurnClick}
            icon={<SkipForward className="h-4 w-4" aria-hidden />}
          >
            End Turn
          </ArenaButton>
        )}
      </div>
      </div>
    </div>
  );
};

export default ActionBar;
