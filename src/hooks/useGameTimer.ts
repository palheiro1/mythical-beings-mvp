import { useEffect, useRef, useCallback, useState } from 'react';

interface UseGameTimerOptions {
  initialTime?: number;
  onTimeUpdate?: (timeLeft: number) => void;
  onTimeExpired?: () => void;
  autoStart?: boolean;
}

export const useGameTimer = ({ 
  initialTime = 30, 
  onTimeUpdate, 
  onTimeExpired,
  autoStart = false
}: UseGameTimerOptions = {}) => {
  const [timeLeft, setTimeLeft] = useState(initialTime);
  const [isActive, setIsActive] = useState(autoStart);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const start = useCallback(() => {
    setIsActive(true);
  }, []);

  const pause = useCallback(() => {
    setIsActive(false);
  }, []);

  const reset = useCallback((newTime?: number) => {
    setIsActive(false);
    const resetTime = newTime !== undefined ? newTime : initialTime;
    setTimeLeft(resetTime);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [initialTime]);

  const addTime = useCallback((seconds: number) => {
    setTimeLeft(current => Math.max(0, current + seconds));
  }, []);

  // Timer effect
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(current => {
          const newTime = current - 1;
          
          if (onTimeUpdate) {
            onTimeUpdate(newTime);
          }

          if (newTime <= 0) {
            setIsActive(false);
            if (onTimeExpired) {
              onTimeExpired();
            }
          }

          return newTime;
        });
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, timeLeft, onTimeUpdate, onTimeExpired]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  return {
    timeLeft,
    isActive,
    start,
    pause,
    reset,
    addTime,
    isExpired: timeLeft <= 0,
    formattedTime: `${Math.floor(timeLeft / 60)}:${(timeLeft % 60).toString().padStart(2, '0')}`
  };
};
