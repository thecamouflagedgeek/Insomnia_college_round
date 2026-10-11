import { useEffect, useEffectEvent } from 'react';

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

/** Refresh visible views together; mutations and returning to the tab refresh immediately. */
export function refreshDashboard() {
  if (document.visibilityState === 'hidden') return;
  listeners.forEach((refresh) => refresh());
}

function subscribe(refresh: () => void) {
  listeners.add(refresh);
  if (!timer) {
    timer = setInterval(refreshDashboard, 3000);
    window.addEventListener('focus', refreshDashboard);
    document.addEventListener('visibilitychange', refreshDashboard);
  }
  return () => {
    listeners.delete(refresh);
    if (!listeners.size) {
      clearInterval(timer);
      timer = undefined;
      window.removeEventListener('focus', refreshDashboard);
      document.removeEventListener('visibilitychange', refreshDashboard);
    }
  };
}

/** No overlapping requests; ignore old responses after a case/role change or unmount. */
export function useAutoRefresh(
  load: (isCurrent: () => boolean, initial: boolean) => Promise<void> | void,
  dependencies: readonly string[],
) {
  const onRefresh = useEffectEvent(load);
  const scope = JSON.stringify(dependencies);
  useEffect(() => {
    let active = true, running = false, initial = true, queued = false;
    const refresh = async () => {
      if (!active || document.visibilityState === 'hidden') return;
      if (running) { queued = true; return; }
      running = true;
      try { await onRefresh(() => active, initial); }
      catch { /* Views handle API failures; never log response bodies. */ }
      finally {
        running = false;
        initial = false;
        if (queued && active) { queued = false; void refresh(); }
      }
    };
    const unsubscribe = subscribe(() => { void refresh(); });
    void refresh();
    return () => { active = false; unsubscribe(); };
  }, [scope]);
}
