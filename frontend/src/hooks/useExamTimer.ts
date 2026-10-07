import { useCallback, useEffect, useRef, useState } from 'react';

interface UseExamTimerOptions {
  durationMin: number;
  onExpire?: () => void;
  autoStart?: boolean;
}

export function useExamTimer({ durationMin, onExpire, autoStart = true }: UseExamTimerOptions) {
  const [remaining, setRemaining] = useState(durationMin * 60);
  const [running, setRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!running) return;

    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          setRunning(false);
          if (intervalRef.current) clearInterval(intervalRef.current);
          onExpireRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const start = useCallback(() => setRunning(true), []);
  const pause = useCallback(() => setRunning(false), []);
  const reset = useCallback(
    (seconds?: number) => {
      setRemaining(seconds ?? durationMin * 60);
      setRunning(false);
    },
    [durationMin],
  );

  const formatTime = useCallback((s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }, []);

  const isDanger = remaining <= 60;
  const isWarning = remaining <= 300 && remaining > 60;

  return {
    remaining,
    running,
    start,
    pause,
    reset,
    formatted: formatTime(remaining),
    isDanger,
    isWarning,
  };
}