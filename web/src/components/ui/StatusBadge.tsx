import { Clock, Search, Users, Inbox, CheckCircle2, Archive, Radio, RefreshCw } from 'lucide-react';
import { ComplaintStatus } from '../../types/complaint';
import { STATUS_LABEL } from '../../lib/format';

interface StatusBadgeProps {
  status: ComplaintStatus;
  className?: string;
}

/** Consistent prominent status badge across all dashboard tables, cards and dossier views */
export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const label = STATUS_LABEL[status] ?? status;

  switch (status) {
    case 'under_challenge':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#ffedd5] px-3 py-1 text-xs font-semibold text-[#9a3412] ring-1 ring-[#fdba74] ${className}`}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-[#ea580c]" />
          {label}
        </span>
      );

    case 'investigation_active':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#e0e7ff] px-3 py-1 text-xs font-semibold text-[#3730a3] ring-1 ring-[#a5b4fc] ${className}`}
        >
          <Search className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-[#4f46e5]" />
          {label}
        </span>
      );

    case 'committee_assigned':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#f3e8ff] px-3 py-1 text-xs font-semibold text-[#581c87] ring-1 ring-[#d8b4fe] ${className}`}
        >
          <Users className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-[#7e22ce]" />
          {label}
        </span>
      );

    case 'witness_quorum_active':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-300 ${className}`}
        >
          <Radio className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-teal-600" />
          {label}
        </span>
      );

    case 'reassignment_pending':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 ring-1 ring-amber-300 ${className}`}
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-amber-700" />
          {label}
        </span>
      );

    case 'resolved':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-300 ${className}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-emerald-600" />
          {label}
        </span>
      );

    case 'archived':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 ${className}`}
        >
          <Archive className="h-3.5 w-3.5 shrink-0 text-slate-500" />
          {label}
        </span>
      );

    case 'submitted':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-800 ring-1 ring-slate-300 ${className}`}
        >
          <Inbox className="h-3.5 w-3.5 shrink-0 text-slate-600" />
          {label}
        </span>
      );
  }
}

