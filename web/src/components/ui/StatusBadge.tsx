import { Clock, Search, Users, Inbox, CheckCircle2, Archive, Radio, RefreshCw } from 'lucide-react';
import { ComplaintStatus } from '../../types/complaint';
import { STATUS_LABEL } from '../../lib/format';

interface StatusBadgeProps {
  status: ComplaintStatus;
  className?: string;
}

/** Consistent prominent solid-color status badges across all dashboard tables, cards and dossier views */
export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const label = STATUS_LABEL[status] ?? status;

  switch (status) {
    case 'under_challenge':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#ea580c] px-3 py-1 text-xs font-semibold text-white shadow-[0_0_10px_rgba(234,88,12,0.4)] ring-1 ring-orange-400/40 ${className}`}
        >
          <Clock className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'investigation_active':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#4338ca] px-3 py-1 text-xs font-semibold text-white shadow-[0_0_12px_rgba(67,56,202,0.5)] ring-1 ring-indigo-400/40 ${className}`}
        >
          <Search className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'committee_assigned':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#6b21a8] px-3 py-1 text-xs font-semibold text-white shadow-[0_0_10px_rgba(107,33,168,0.4)] ring-1 ring-purple-400/40 ${className}`}
        >
          <Users className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'witness_quorum_active':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#0f766e] px-3 py-1 text-xs font-semibold text-white shadow-[0_0_10px_rgba(15,118,110,0.35)] ring-1 ring-teal-400/40 ${className}`}
        >
          <Radio className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'reassignment_pending':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#d97706] px-3 py-1 text-xs font-semibold text-white shadow-[0_0_10px_rgba(217,119,6,0.4)] ring-1 ring-amber-400/40 ${className}`}
        >
          <RefreshCw className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'resolved':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#059669] px-3 py-1 text-xs font-semibold text-white shadow-[0_0_10px_rgba(5,150,105,0.35)] ring-1 ring-emerald-400/40 ${className}`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 stroke-[2.2] text-white" />
          {label}
        </span>
      );

    case 'archived':
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#475569] px-3 py-1 text-xs font-semibold text-white ring-1 ring-slate-400/40 ${className}`}
        >
          <Archive className="h-3.5 w-3.5 shrink-0 text-white" />
          {label}
        </span>
      );

    case 'submitted':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full bg-[#64748b] px-3 py-1 text-xs font-semibold text-white shadow-[0_0_10px_rgba(100,116,139,0.3)] ring-1 ring-slate-400/40 ${className}`}
        >
          <Inbox className="h-3.5 w-3.5 shrink-0 text-white" />
          {label}
        </span>
      );
  }
}

