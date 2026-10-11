import { FolderOpen } from 'lucide-react';
import { InvestigationInbox } from '../components/investigation/InvestigationInbox';
import { useAccessibleCases } from '../hooks/useAccessibleCases';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { CaseSelect } from '../components/ui/CaseSelect';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { relativeTime } from '../lib/format';

export function InvestigationInboxPage() {
  const { cases, selectedCaseId, setSelectedCaseId, loading } = useAccessibleCases();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Investigation Inbox"
        description="Messages with anonymous reporters, one channel per case. New replies appear automatically."
      />

      {/* Case picker on small screens */}
      <div className="lg:hidden">
        <CaseSelect cases={cases} value={selectedCaseId} onChange={setSelectedCaseId} loading={loading} label="Channel" />
      </div>

      {!loading && cases.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FolderOpen />} title="No channels for your role" description="A channel opens for each case you are assigned to." />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <nav aria-label="Case channels" className="card hidden self-start p-2 lg:col-span-4 lg:block xl:col-span-3">
            <p className="px-3 pb-1 pt-2 text-xs font-semibold text-muted">Channels</p>
            {loading ? (
              <div className="p-3"><SkeletonRows rows={4} label="Loading channels" /></div>
            ) : (
              <ul className="max-h-[560px] space-y-0.5 overflow-y-auto">
                {cases.map((c) => {
                  const active = c.id === selectedCaseId;
                  return (
                    <li key={c.id}>
                      <button
                        onClick={() => setSelectedCaseId(c.id)}
                        aria-current={active ? 'true' : undefined}
                        className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${active ? 'bg-brand-50' : 'hover:bg-sunken'}`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className={`case-id ${active ? 'text-brand-700' : 'text-ink-soft'}`}>{c.id}</span>
                          <span className="text-[0.6875rem] text-muted">{relativeTime(c.submittedAt)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-[0.8125rem] font-medium text-ink">{c.title}</span>
                        <span className="mt-1.5 block"><SeverityBadge severity={c.severity} /></span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </nav>
          <div className="lg:col-span-8 xl:col-span-9">
            {selectedCaseId ? (
              <InvestigationInbox complaintId={selectedCaseId} />
            ) : (
              <div className="card card-pad"><SkeletonRows rows={4} label="Loading channel" /></div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
