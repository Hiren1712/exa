import { useCallback, useEffect, useRef, useState } from 'react';

interface ProctorStats {
  tabSwitches: number;
  copyAttempts: number;
  fullscreenExits: number;
}

interface UseProctorOptions {
  enabled: boolean;
  onViolation?: (type: 'TAB_SWITCH' | 'COPY' | 'FULLSCREEN_EXIT', total: number) => void;
}

export function useProctor({ enabled, onViolation }: UseProctorOptions) {
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

  // Tab switch detection
  useEffect(() => {
    if (!enabled) return;

    const handleVisibility = () => {
      if (document.hidden) {
        const next = { ...statsRef.current, tabSwitches: statsRef.current.tabSwitches + 1 };
        setStats(next);
        onViolationRef.current?.('TAB_SWITCH', next.tabSwitches);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [enabled]);

  // Copy/paste block
  useEffect(() => {
    if (!enabled) return;

    const handleCopy = (e: Event) => {
      e.preventDefault();
      const next = { ...statsRef.current, copyAttempts: statsRef.current.copyAttempts + 1 };
      setStats(next);
      onViolationRef.current?.('COPY', next.copyAttempts);
    };

    const handleContextMenu = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCopy);
    document.addEventListener('paste', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCopy);
      document.removeEventListener('paste', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [enabled]);

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
      // ignore
    }
  }, []);

  // Fullscreen exit detection
  useEffect(() => {
    if (!enabled) return;

    const handleFsChange = () => {
      if (intentionalFullscreenExit.current) {
        intentionalFullscreenExit.current = false;
        return;
      }
      if (!document.fullscreenElement && enabled) {
        const next = { ...statsRef.current, fullscreenExits: statsRef.current.fullscreenExits + 1 };
        setStats(next);
        onViolationRef.current?.('FULLSCREEN_EXIT', next.fullscreenExits);
      }
    };

    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, [enabled]);

  return {
    stats,
    requestFullscreen,
    exitFullscreen,
  };
}