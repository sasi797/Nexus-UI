import { useCallback, useEffect, useRef, useState } from 'react';

const MUTE_KEY = 'bts:alert-muted';

function playChime() {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.connect(g);
    g.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.22);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.4, now + 0.01);
    g.gain.setValueAtTime(0.4, now + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc.start(now);
    osc.stop(now + 0.8);
  } catch {
    // Web Audio unavailable
  }
}

export function useAlertSound(unreadIds: string[]) {
  const [isMuted, setIsMuted] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem(MUTE_KEY) === 'true';
  });

  const isMutedRef = useRef(isMuted);
  const prevIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const current = new Set(unreadIds);

    if (prevIdsRef.current === null) {
      // First data load — record baseline, no sound
      prevIdsRef.current = current;
      return;
    }

    const hasNew = unreadIds.some(id => !prevIdsRef.current!.has(id));
    prevIdsRef.current = current;

    if (hasNew && !isMutedRef.current) {
      playChime();
    }
  }, [unreadIds.join(',')]); // stable dep: only re-runs when ID list actually changes

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const next = !prev;
      localStorage.setItem(MUTE_KEY, String(next));
      return next;
    });
  }, []);

  return { isMuted, toggleMute };
}
