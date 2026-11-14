import { useCallback, useEffect, useRef, useState } from 'react';

interface ProctorStats {
  tabSwitches: number;
  copyAttempts: number;
  fullscreenExits: number;
}

interface UseProctorOptions {
  enabled: boolean;
  sessionId: number | null;
  onViolation?: (type: 'TAB_SWITCH' | 'COPY' | 'FULLSCREEN_EXIT', total: number) => void;
}

export function useProctor({ enabled, sessionId, onViolation }: UseProctorOptions) {
  const [stats, setStats] = useState<ProctorStats>({
    tabSwitches: 0,
    copyAttempts: 0,
    fullscreenExits: 0,
  });

  const statsRef = useRef(stats);
  const onViolationRef = useRef(onViolation);
  const intentionalFullscreenExit = useRef(false);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    onViolationRef.current = onViolation;
  }, [onViolation]);

  useEffect(() => {
    const emptyStats = { tabSwitches: 0, copyAttempts: 0, fullscreenExits: 0 };
    statsRef.current = emptyStats;
    setStats(emptyStats);
  }, [sessionId]);

  const recordViolation = useCallback((type: 'TAB_SWITCH' | 'COPY' | 'FULLSCREEN_EXIT') => {
    const current = statsRef.current;
    let next: ProctorStats;
    let total: number;
    if (type === 'TAB_SWITCH') {
      total = current.tabSwitches + 1;
      next = { ...current, tabSwitches: total };
    } else if (type === 'COPY') {
      total = current.copyAttempts + 1;
      next = { ...current, copyAttempts: total };
    } else {
      total = current.fullscreenExits + 1;
      next = { ...current, fullscreenExits: total };
    }
    statsRef.current = next;
    setStats(next);
    onViolationRef.current?.(type, total);
  }, []);

  // Tab switch detection
  useEffect(() => {
    if (!enabled || sessionId === null) return;

    const handleVisibility = () => {
      if (document.hidden) {
        recordViolation('TAB_SWITCH');
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled, recordViolation, sessionId]);

  // Copy/paste block
  useEffect(() => {
    if (!enabled || sessionId === null) return;

    const handleCopy = (e: Event) => {
      e.preventDefault();
      recordViolation('COPY');
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCopy);
    document.addEventListener('paste', handleCopy);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCopy);
      document.removeEventListener('paste', handleCopy);
    };
  }, [enabled, recordViolation, sessionId]);

  // Request fullscreen
  const requestFullscreen = useCallback(async () => {
    await document.documentElement.requestFullscreen();
  }, []);

  const exitFullscreen = useCallback(async () => {
    try {
      if (document.fullscreenElement) {
        intentionalFullscreenExit.current = true;
        await document.exitFullscreen();
      }
    } catch {
      intentionalFullscreenExit.current = false;
    }
  }, []);

  // Fullscreen exit detection
  useEffect(() => {
    if (!enabled || sessionId === null) return;

    const handleFsChange = () => {
      if (intentionalFullscreenExit.current) {
        intentionalFullscreenExit.current = false;
        return;
      }
      if (!document.fullscreenElement && enabled) {
        recordViolation('FULLSCREEN_EXIT');
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [enabled, recordViolation, sessionId]);

  return {
    stats,
    requestFullscreen,
    exitFullscreen,
  };
}