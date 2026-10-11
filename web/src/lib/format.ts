import { ComplaintCategory, ComplaintStatus, SeverityLevel } from '../types/complaint';

export const CATEGORY_LABEL: Record<ComplaintCategory, string> = {
  bullying_authority_abuse: 'Bullying & authority abuse',
  sexual_harassment: 'Sexual harassment',
  discrimination: 'Discrimination',
  whistleblowing_bribery: 'Whistleblowing & bribery',
  workplace_retaliation: 'Workplace retaliation'
};

export function categoryLabel(cat: string, backendLabel?: string): string {
  return CATEGORY_LABEL[cat as ComplaintCategory] ?? backendLabel ?? 'Misconduct';
}

export const SEVERITY_ORDER: Record<SeverityLevel, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export const STATUS_LABEL: Record<ComplaintStatus, string> = {
  submitted: 'Submitted',
  committee_assigned: 'Committee assigned',
  under_challenge: 'Under challenge',
  reassignment_pending: 'Reassignment pending',
  investigation_active: 'Investigating',
  witness_quorum_active: 'Witness quorum open',
  resolved: 'Resolved',
  archived: 'Archived'
};

export const OPEN_STATUSES: ComplaintStatus[] = [
  'submitted',
  'committee_assigned',
  'under_challenge',
  'reassignment_pending',
  'investigation_active',
  'witness_quorum_active'
];

export function isOpen(status: ComplaintStatus): boolean {
  return OPEN_STATUSES.includes(status);
}

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** "3 min ago", "2 h ago", "4 Oct" — for activity feeds. */
export function relativeTime(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  if (Number.isNaN(diff)) return '—';
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 7) return `${days} d ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function shortHash(h: string, head = 10, tail = 6): string {
  if (!h) return '';
  return h.length <= head + tail + 1 ? h : `${h.slice(0, head)}…${h.slice(-tail)}`;
}
