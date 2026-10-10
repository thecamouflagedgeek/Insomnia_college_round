import { ComplaintStatus } from '../../types/complaint';

interface StatusBadgeProps {
  status: ComplaintStatus;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const configs: Record<ComplaintStatus, { label: string; bg: string; text: string }> = {
    submitted: {
      label: 'Submitted',
      bg: 'bg-stone-100',
      text: 'text-stone-700'
    },
    committee_assigned: {
      label: 'Committee Constituted',
      bg: 'bg-purple-50 text-purple-800 border border-purple-200',
      text: 'text-purple-800'
    },
    under_challenge: {
      label: 'Conflict Challenged ⚠️',
      bg: 'bg-amber-100 text-amber-900 border border-amber-300 font-bold',
      text: 'text-amber-900'
    },
    reassignment_pending: {
      label: 'Reassignment Pending',
      bg: 'bg-orange-50 text-orange-800 border border-orange-200',
      text: 'text-orange-800'
    },
    investigation_active: {
      label: 'Investigation In Progress',
      bg: 'bg-blue-50 text-blue-800 border border-blue-200',
      text: 'text-blue-800'
    },
    witness_quorum_active: {
      label: 'Witness Quorum Live',
      bg: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
      text: 'text-emerald-800'
    },
    resolved: {
      label: 'Formally Concluded',
      bg: 'bg-teal-50 text-teal-800 border border-teal-200',
      text: 'text-teal-800'
    },
    archived: {
      label: 'Sealed & Archived',
      bg: 'bg-stone-100 text-stone-600',
      text: 'text-stone-600'
    }
  };

  const config = configs[status] || { label: status, bg: 'bg-stone-100', text: 'text-stone-700' };

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}
    >
      {config.label}
    </span>
  );
}
