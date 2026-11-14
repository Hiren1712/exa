import { useCallback, useEffect, useRef, useState } from 'react';

interface UseExamTimerOptions {
  durationMin: number;
  onExpire?: () => void;
  autoStart?: boolean;
}

export function useExamTimer({ durationMin, onExpire, autoStart = true }: UseExamTimerOptions) {
  const initialSeconds = durationMin * 60;
  const [remaining, setRemaining] = useState(initialSeconds);
  const [running, setRunning] = useState(autoStart);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onExpireRef = useRef(onExpire);
  const durationRef = useRef(durationMin);
  const remainingRef = useRef(initialSeconds);
  const deadlineRef = useRef<number | null>(autoStart ? Date.now() + initialSeconds * 1000 : null);
  const expiredRef = useRef(false);
  durationRef.current = durationMin;

  useEffect(() => {
    onExpireRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!running) return;

    const updateRemaining = () => {
      if (deadlineRef.current === null) return;
      const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      remainingRef.current = next;
      setRemaining(next);
      if (next === 0 && !expiredRef.current) {
        expiredRef.current = true;
        deadlineRef.current = null;
        setRunning(false);
        onExpireRef.current?.();
      }
    };

    updateRemaining();
    if (deadlineRef.current !== null) {
      intervalRef.current = setInterval(updateRemaining, 1000);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running]);

  const start = useCallback(() => {
    deadlineRef.current = Date.now() + remainingRef.current * 1000;
    expiredRef.current = false;
    setRunning(true);
  }, []);
  const pause = useCallback(() => {
    if (deadlineRef.current !== null) {
      const next = Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      remainingRef.current = next;
      setRemaining(next);
      deadlineRef.current = null;
    }
    setRunning(false);
  }, []);
  const reset = useCallback(
    (seconds?: number) => {
      const next = Math.max(0, seconds ?? durationRef.current * 60);
      remainingRef.current = next;
      deadlineRef.current = null;
      expiredRef.current = false;
      setRemaining(next);
      setRunning(false);
    },
    [],
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