import { useState } from 'react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { ChevronDown, History, RefreshCw } from 'lucide-react';
import { AuditEvent } from '../../types/audit';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Section } from '../ui/Section';
import { SkeletonRows } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { Notice } from '../ui/Notice';
import { AuditStatusChip } from './AuditStatusChip';
import { formatDateTime, shortHash } from '../../lib/format';

const COLLAPSED = 5;

/** The case's Silent Audit trail, oldest first, with each entry's status from the backend verifier. */
export function AuditTimeline({ complaintId }: { complaintId: string }) {
  const { currentUser } = useAuth();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = async (silent = false, isCurrent = () => true) => {
    if (!silent) { setEvents(null); setExpanded(false); }
    const res = await ApiService.getAuditEvents(complaintId);
    if (!isCurrent()) return;
    setError(null);
    if (res.success && res.data) setEvents(res.data);
    else { setEvents([]); setError(res.error || 'Audit trail unavailable'); }
  };

  useAutoRefresh((isCurrent, initial) => load(!initial, isCurrent), [complaintId, currentUser.id]);

  const ordered = events ? [...events].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) : [];
  const shown = expanded ? ordered : ordered.slice(-COLLAPSED);
  const hidden = ordered.length - shown.length;

  return (
    <Section
      icon={<History />}
      title="Silent Audit trail"
      description="Append-only, hash-chained record of every action on this case."
      action={
        <button className="icon-btn h-8 w-8" onClick={() => void load()} aria-label="Refresh audit trail" title="Refresh">
          <RefreshCw className={`h-4 w-4 ${events === null && !error ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      {error ? (
        <Notice tone="danger" role="alert">{error}</Notice>
      ) : events === null ? (
        <SkeletonRows rows={3} label="Loading audit trail" />
      ) : ordered.length === 0 ? (
        <EmptyState compact icon={<History />} title="No audit entries" description="Entries appear as soon as the case is acted on." />
      ) : (
        <>
          {hidden > 0 && (
            <button className="btn btn-ghost btn-sm mb-2" onClick={() => setExpanded(true)}>
              <ChevronDown />
              Show {hidden} earlier {hidden === 1 ? 'entry' : 'entries'}
            </button>
          )}
          <ol className="relative">
            {shown.map((e, i) => (
              <li key={e.id} className="relative flex gap-3.5 pb-4 last:pb-0 animate-enter">
                {i < shown.length - 1 && <span aria-hidden="true" className="absolute left-[7px] top-5 bottom-0 w-px bg-line" />}
                <span
                  aria-hidden="true"
                  className={`relative mt-1 h-[15px] w-[15px] shrink-0 rounded-full border-[3px] border-surface ring-1 ${
                    e.verificationStatus === 'verified_commitment'
                      ? 'bg-teal-500 ring-teal-100'
                      : e.verificationStatus === 'verification_failed'
                        ? 'bg-danger-500 ring-danger-100'
                        : 'bg-warn-600 ring-warn-100'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <p className="text-[0.8125rem] font-medium text-ink">{e.details}</p>
                    <AuditStatusChip status={e.verificationStatus} />
                  </div>
                  <p className="mt-0.5 text-xs text-muted">
                    {e.actorRef} · <time dateTime={e.timestamp}>{formatDateTime(e.timestamp)}</time>
                  </p>
                  {(e.sha256Proof || e.blockNumber > 0) && (
                    <p className="mt-1 truncate font-mono text-[0.6875rem] text-muted" title={e.sha256Proof}>
                      {e.sha256Proof && <>commit {shortHash(e.sha256Proof, 10, 6)}</>}
                      {e.blockNumber > 0 && <> · block {e.blockNumber}</>}
                      {e.txHash && <> · tx {shortHash(e.txHash, 8, 6)}</>}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </Section>
  );
}
