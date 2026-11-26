import { useEffect, useRef, useState } from 'react';
import { subscribeToSpectators } from '../services/spectatorService.js';

/** Realtime only wakes a read. Retain the last board on transient failures. */
export function useSpectatorFeed<T>(topic: string, read: () => Promise<T>, finished?: (data: T) => boolean, key = topic) {
  const [state, setState] = useState<{ key: string; data?: T; error: boolean }>({ key, error: false });
  const request = useRef<() => void>(() => {});
  useEffect(() => {
    let live = true, busy = false, dirty = false, done = false;
    let lastRead = 0;
    let next: number | undefined;
    const fetchData = async () => {
      next = undefined;
      if (!live || done || document.hidden) return;
      busy = true;
      lastRead = performance.now();
      try {
        const data = await read();
        if (live) {
          done = finished?.(data) === true;
          setState({ key, data, error: false });
        }
      } catch {
        if (live) setState(old => ({ key, data: old.key === key ? old.data : undefined, error: true }));
      } finally {
        busy = false;
        if (dirty) { dirty = false; refresh(); }
      }
    };
    function refresh() {
      if (!live || done || document.hidden) return;
      if (busy) { dirty = true; return; }
      if (next !== undefined) return;
      next = window.setTimeout(() => void fetchData(), Math.max(0, 250 - (performance.now() - lastRead)));
    }
    request.current = refresh;
    refresh();
    const unsubscribe = subscribeToSpectators(topic, refresh);
    const interval = window.setInterval(refresh, 5000);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      live = false;
      window.clearTimeout(next);
      window.clearInterval(interval);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      unsubscribe();
    };
  }, [topic, read, finished, key]);
  return { data: state.key === key ? state.data : undefined, error: state.key === key && state.error, refresh: () => request.current() };
}
