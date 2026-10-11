import { useEffect, useState } from 'react';
import { ApiService, checkBackendHealth } from '../services/api';

export type BackendStatus = 'checking' | 'live' | 'demo';

/** Whether pages are reading the live backend or the in-browser demo data (forced mock, or backend unreachable). */
export function useBackendStatus(): BackendStatus {
  const [status, setStatus] = useState<BackendStatus>(ApiService.isForceMock() ? 'demo' : 'checking');

  useEffect(() => {
    if (ApiService.isForceMock()) return;
    let cancelled = false;
    const probe = () =>
      checkBackendHealth(ApiService.getBaseUrl()).then((ok) => {
        if (!cancelled) setStatus(ok ? 'live' : 'demo');
      });
    probe();
    const id = window.setInterval(probe, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return status;
}
