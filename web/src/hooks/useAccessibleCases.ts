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
    setLoading(true);
    ApiService.getReports().then((res) => {
      const list = res.data || [];
      setCases(list);
      setSelectedCaseId((cur) => (list.some((c) => c.id === cur) ? cur : list[0]?.id || ''));
      setLoading(false);
    });
  }, [currentUser.id]);

  return { cases, selectedCaseId, setSelectedCaseId, loading };
}
