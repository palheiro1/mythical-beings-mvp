import { useState, useEffect, useRef } from 'react';

interface UseTurnTimerProps {
  isMyTurn: boolean;
  phase: 'knowledge' | 'action' | 'end' | null; // Include null for initial state
  turnDurationSeconds: number;
  onTimerEnd: () => void;
  gameTurn: number; // Add gameTurn to reset timer on new turn
  currentPlayerIndex: number | null; // Add currentPlayerIndex to reset timer on player change
}

export function useTurnTimer({
  isMyTurn,
  phase,
  turnDurationSeconds,
  onTimerEnd,
  gameTurn,
  currentPlayerIndex
}: UseTurnTimerProps): number {
  const [remainingTime, setRemainingTime] = useState(turnDurationSeconds);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onTimerEndRef = useRef(onTimerEnd); // Use ref to avoid effect dependency issues

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

    // Start timer only if it's my turn and in the action phase
    if (isMyTurn && phase === 'action') {
      console.log(`[useTurnTimer] Starting timer for turn ${gameTurn}, player ${currentPlayerIndex}. Duration: ${turnDurationSeconds}s`);
      // Reset timer to full duration at the start of the actionable turn
      setRemainingTime(turnDurationSeconds);

      clearTimerInterval(); // Clear any previous interval just in case

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
  }, [isMyTurn, phase, turnDurationSeconds, gameTurn, currentPlayerIndex]); // Rerun effect if turn/phase/player changes

  return remainingTime;
}
