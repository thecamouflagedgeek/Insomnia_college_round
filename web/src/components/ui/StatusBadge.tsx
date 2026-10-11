import { ComplaintStatus } from '../../types/complaint';
import { STATUS_LABEL } from '../../lib/format';

const CLS: Record<ComplaintStatus, string> = {
  submitted: 'bg-sunken text-ink-soft ring-1 ring-inset ring-line',
  committee_assigned: 'bg-brand-50 text-brand-700',
  under_challenge: 'bg-attn-50 text-attn-700',
  reassignment_pending: 'bg-warn-50 text-warn-700',
  investigation_active: 'bg-brand-100 text-brand-800',
  witness_quorum_active: 'bg-teal-50 text-teal-700',
  resolved: 'bg-teal-100 text-teal-700',
  archived: 'bg-sunken text-muted'
};

export function StatusBadge({ status, className = '' }: { status: ComplaintStatus; className?: string }) {
  return (
    <span className={`chip ${CLS[status] ?? 'bg-sunken text-ink-soft'} ${className}`}>{STATUS_LABEL[status] ?? status}</span>
  );
}
