import { useEffect, useRef } from 'react';

const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

const SYNC_CHANNEL = 'incognito_cross_tab_sync';
const STORAGE_KEY = 'incognito_dashboard_mutation_ts';
let broadcastChannel: BroadcastChannel | undefined;

if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  try {
    broadcastChannel = new BroadcastChannel(SYNC_CHANNEL);
    broadcastChannel.onmessage = (event) => {
      if (event.data === 'refresh') {
        refreshDashboard(false);
      }
    };
  } catch {
    /* Fallback to storage event */
  }
}

/** Refresh visible views together; mutations and returning to the tab refresh immediately across all browser tabs. */
export function refreshDashboard(broadcast = true) {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
  listeners.forEach((refresh) => refresh());
  if (broadcast) {
    if (broadcastChannel) {
      try {
        broadcastChannel.postMessage('refresh');
      } catch {
        /* ignore */
      }
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    }
  }
}

function handleStorageEvent(e: StorageEvent) {
  if (e.key === STORAGE_KEY) {
    refreshDashboard(false);
  }
}

// One named handler each, so removeEventListener removes exactly what addEventListener added.
const refreshLocal = () => refreshDashboard(false);

function subscribe(refresh: () => void) {
  listeners.add(refresh);
  if (!timer) {
    timer = setInterval(refreshLocal, 3000);
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', refreshLocal);
      window.addEventListener('storage', handleStorageEvent);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', refreshLocal);
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
        window.removeEventListener('focus', refreshLocal);
        window.removeEventListener('storage', handleStorageEvent);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', refreshLocal);
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
