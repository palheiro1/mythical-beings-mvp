import { useState, useEffect, useRef } from 'react';

interface UseTurnTimerProps {
  isMyTurn: boolean;
  phase: 'knowledge' | 'action' | 'end' | null; // Include null for initial state
  turnDurationSeconds: number;
  onTimerEnd: () => void;
  gameTurn: number; // Add gameTurn to reset timer on new turn
  currentPlayerIndex: number | null; // Add currentPlayerIndex to reset timer on player change
  paused?: boolean;
}

export function useTurnTimer({
  isMyTurn,
  phase,
  turnDurationSeconds,
  onTimerEnd,
  gameTurn,
  currentPlayerIndex,
  paused = false
}: UseTurnTimerProps): number {
  const [remainingTime, setRemainingTime] = useState(turnDurationSeconds);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimerEndRef = useRef(onTimerEnd); // Use ref to avoid effect dependency issues
  const contextRef = useRef('');

  // Keep the callback ref up-to-date
  useEffect(() => {
    onTimerEndRef.current = onTimerEnd;
  }, [onTimerEnd]);

  useEffect(() => {
    // Function to clear existing interval
    const clearTimerInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    const context = `${gameTurn}:${currentPlayerIndex}:${isMyTurn}:${phase}:${turnDurationSeconds}`;
    if (context !== contextRef.current) {
      contextRef.current = context;
      setRemainingTime(turnDurationSeconds);
    }
    clearTimerInterval();
    // Orientation pauses keep the remaining time and the current match intact.
    if (paused) return clearTimerInterval;

    // Start timer only if it's my turn and in the action phase
    if (isMyTurn && phase === 'action') {
      console.log(`[useTurnTimer] Starting timer for turn ${gameTurn}, player ${currentPlayerIndex}. Duration: ${turnDurationSeconds}s`);
      intervalRef.current = setInterval(() => {
        setRemainingTime((prevTime) => {
          if (prevTime <= 1) {
            clearTimerInterval(); // Clear interval when time runs out
            console.log(`[useTurnTimer] Timer ended for turn ${gameTurn}, player ${currentPlayerIndex}. Calling onTimerEnd.`);
            onTimerEndRef.current(); // Call the latest end turn function
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    } else {
      // If not my turn or not action phase, clear interval and reset display time
      clearTimerInterval();
      setRemainingTime(turnDurationSeconds); // Reset display time
      // console.log(`[useTurnTimer] Timer stopped/reset. isMyTurn: ${isMyTurn}, phase: ${phase}`);
    }

    // Cleanup function to clear interval on unmount or when dependencies change
    return () => {
      clearTimerInterval();
      // console.log(`[useTurnTimer] Cleanup effect. Interval cleared.`);
    };
  }, [isMyTurn, phase, turnDurationSeconds, gameTurn, currentPlayerIndex, paused]);

  return remainingTime;
}
