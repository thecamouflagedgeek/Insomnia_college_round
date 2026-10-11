import { ChevronRight, Lock } from 'lucide-react';
import { Complaint } from '../../types/complaint';
import { SeverityBadge } from '../ui/SeverityBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { useAuth } from '../../hooks/useAuth';
import { categoryLabel, formatDate } from '../../lib/format';

interface ComplaintTableProps {
  complaints: Complaint[];
  onSelectComplaint: (complaint: Complaint) => void;
  /** Fewer columns, for the Overview. */
  compact?: boolean;
}

export function ComplaintTable({ complaints, onSelectComplaint, compact = false }: ComplaintTableProps) {
  const { currentUser } = useAuth();

  return (
    <>
      {/* Table from md up */}
      <div className={`hidden overflow-x-auto ${compact ? 'xl:block' : 'md:block'}`}>
        <table className="w-full border-collapse text-left text-[0.8125rem]">
          <thead>
            <tr className="border-b border-line text-xs font-semibold text-muted">
              <th scope="col" className="py-2.5 pl-1 pr-4 font-semibold">Case</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Severity</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Status</th>
              {!compact && <th scope="col" className="px-4 py-2.5 font-semibold">Reporter token</th>}
              <th scope="col" className="px-4 py-2.5 font-semibold">Next action</th>
              <th scope="col" className="px-4 py-2.5 font-semibold">Filed</th>
              <th scope="col" className="w-10 py-2.5"><span className="sr-only">Open</span></th>
            </tr>
          </thead>
          <tbody>
            {complaints.map((item) => {
              const revoked = item.revokedMemberIds.includes(currentUser.id);
              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectComplaint(item)}
                  className="group cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-brand-50/60"
                >
                  <td className="max-w-[22rem] py-3 pl-1 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="case-id text-brand-700">{item.id}</span>
                      {revoked && (
                        <span className="chip bg-danger-50 text-danger-700">
                          <Lock />
                          Access revoked
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate font-semibold text-ink" title={item.title}>{item.title}</p>
                    <p className="truncate text-xs text-muted">{categoryLabel(item.category, item.categoryLabel)}</p>
                  </td>
                  <td className="px-4 py-3"><SeverityBadge severity={item.severity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                  {!compact && (
                    <td className="px-4 py-3 font-mono text-xs text-muted">{item.anonymousToken}</td>
                  )}
                  <td className="max-w-[16rem] px-4 py-3 text-ink-soft">
                    <span className="line-clamp-2">{item.requiredNextAction}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted tabular">{formatDate(item.submittedAt)}</td>
                  <td className="py-3 pr-1 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectComplaint(item);
                      }}
                      aria-label={`Open case ${item.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors group-hover:bg-brand-600 group-hover:text-white"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Stacked list on small screens */}
      <ul className={`stagger ${compact ? 'grid gap-2 md:grid-cols-2 xl:hidden' : 'space-y-2 md:hidden'}`}>
        {complaints.map((item) => {
          const revoked = item.revokedMemberIds.includes(currentUser.id);
          return (
            <li key={item.id}>
              <button
                onClick={() => onSelectComplaint(item)}
                className="w-full rounded-2xl border border-line bg-surface p-3.5 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/50"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="case-id text-brand-700">{item.id}</span>
                  <span className="text-xs text-muted tabular">{formatDate(item.submittedAt)}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-ink">{item.title}</p>
                <p className="text-xs text-muted">{categoryLabel(item.category, item.categoryLabel)}</p>
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <SeverityBadge severity={item.severity} />
                  <StatusBadge status={item.status} />
                  {revoked && (
                    <span className="chip bg-danger-50 text-danger-700">
                      <Lock />
                      Access revoked
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs text-ink-soft">{item.requiredNextAction}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}
