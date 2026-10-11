import { useEffect, useState } from 'react';
import { ApiService } from '../services/api';
import { Complaint } from '../types/complaint';
import { useAuth } from './useAuth';

/** Cases the current staff member may open (the backend decides), plus a selection kept valid across persona switches. */
export function useAccessibleCases() {
  const { currentUser } = useAuth();
  const [cases, setCases] = useState<Complaint[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchCases = (silent = false) => {
      if (!silent) setLoading(true);
      ApiService.getReports().then((res) => {
        if (!active) return;
        const list = res.data || [];
        setCases(list);
        setSelectedCaseId((cur) => (list.some((c) => c.id === cur) ? cur : list[0]?.id || ''));
        if (!silent) setLoading(false);
      });
    };

    fetchCases();
    const timer = setInterval(() => fetchCases(true), 5000);
    const handleFocus = () => fetchCases(true);
    window.addEventListener('focus', handleFocus);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', handleFocus);
    };
  }, [currentUser.id]);

  return { cases, selectedCaseId, setSelectedCaseId, loading };
}
