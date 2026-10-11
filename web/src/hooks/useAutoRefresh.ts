import { useEffect, useRef } from 'react';

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

/** Refresh visible views together; mutations and returning to the tab refresh immediately. */
export function refreshDashboard() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  listeners.forEach((refresh) => refresh());
}

function subscribe(refresh: () => void) {
  listeners.add(refresh);
  if (!timer) {
    timer = setInterval(refreshDashboard, 3000);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', refreshDashboard);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', refreshDashboard);
    }
  }
  return () => {
    listeners.delete(refresh);
    if (!listeners.size) {
      if (timer) {
        clearInterval(timer);
        timer = undefined;
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', refreshDashboard);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', refreshDashboard);
      }
    }
  };
}

/** No overlapping requests; ignore old responses after a case/role change or unmount. */
export function useAutoRefresh(
  load: (isCurrent: () => boolean, initial: boolean) => Promise<void> | void,
  dependencies: readonly unknown[],
) {
  const loadRef = useRef(load);
  loadRef.current = load;

  const scope = JSON.stringify(dependencies);
  useEffect(() => {
    let active = true;
    let running = false;
    let initial = true;
    let queued = false;

    const refresh = async () => {
      if (!active || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      if (running) {
        queued = true;
        return;
      }
      running = true;
      try {
        await loadRef.current(() => active, initial);
      } catch {
        /* Views handle API failures; never log response bodies. */
      } finally {
        running = false;
        initial = false;
        if (queued && active) {
          queued = false;
          void refresh();
        }
      }
    };

    const unsubscribe = subscribe(() => {
      void refresh();
    });
    void refresh();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [scope]);
}
