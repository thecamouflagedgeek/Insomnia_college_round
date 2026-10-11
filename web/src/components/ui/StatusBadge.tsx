import { Clock, Search, Users, Inbox, CheckCircle2, Archive, Radio, RefreshCw } from 'lucide-react';
import { ComplaintStatus } from '../../types/complaint';
import { STATUS_LABEL } from '../../lib/format';

interface StatusBadgeProps {
  status: ComplaintStatus;
  className?: string;
}

/** Restrained, professional status badges across all dashboard tables, cards and dossier views */
export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const label = STATUS_LABEL[status] ?? status;

  switch (status) {
    case 'under_challenge':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#c2410c] px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-orange-900/20 ${className}`}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'investigation_active':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#3730a3] px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-indigo-900/20 ${className}`}
        >
          <Search className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'committee_assigned':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#581c87] px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-purple-900/20 ${className}`}
        >
          <Users className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'witness_quorum_active':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#0f766e] px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-teal-900/20 ${className}`}
        >
          <Radio className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'reassignment_pending':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#b45309] px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-amber-900/20 ${className}`}
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'resolved':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#047857] px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-emerald-900/20 ${className}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'archived':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#475569] px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-slate-800/20 ${className}`}
        >
          <Archive className="h-3.5 w-3.5 shrink-0 text-white" />
          {label}
        </span>
      );

    case 'submitted':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#475569] px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-slate-800/20 ${className}`}
        >
          <Inbox className="h-3.5 w-3.5 shrink-0 text-white" />
          {label}
        </span>
      );
  }
}

