import { LayoutDashboard, FolderKanban, Users, Radio, MessageSquare, Layers, LucideIcon } from 'lucide-react';

export type NavPage =
  | 'dashboard'
  | 'reports'
  | 'report_details'
  | 'committee'
  | 'witness'
  | 'inbox'
  | 'repeat_allegations';

export interface NavItem {
  id: NavPage;
  label: string;
  short: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Overview', short: 'Overview', icon: LayoutDashboard },
  { id: 'reports', label: 'Complaints Queue', short: 'Complaints', icon: FolderKanban },
  { id: 'committee', label: 'Committee Management', short: 'Committee', icon: Users },
  { id: 'witness', label: 'Witness Quorum', short: 'Witnesses', icon: Radio },
  { id: 'inbox', label: 'Investigation Inbox', short: 'Inbox', icon: MessageSquare },
  { id: 'repeat_allegations', label: 'Pattern Intelligence', short: 'Patterns', icon: Layers }
];

export const PAGE_TITLE: Record<NavPage, string> = {
  dashboard: 'Overview',
  reports: 'Complaints Queue',
  report_details: 'Case Dossier',
  committee: 'Committee Management',
  witness: 'Witness Quorum',
  inbox: 'Investigation Inbox',
  repeat_allegations: 'Pattern Intelligence'
};

/** The nav item that should read as active for a page (the dossier lives under the queue). */
export function activeNavId(page: NavPage): NavPage {
  return page === 'report_details' ? 'reports' : page;
}

const PAGE_SLUG: Record<Exclude<NavPage, 'report_details'>, string> = {
  dashboard: '',
  reports: 'complaints',
  committee: 'committee',
  witness: 'witnesses',
  inbox: 'inbox',
  repeat_allegations: 'patterns'
};

/** URL hash for a view: #/complaints, #/case/INC-123, … (Overview is the bare #/). */
export function hashFor(page: NavPage, caseId?: string): string {
  if (page === 'report_details') return caseId ? `#/case/${encodeURIComponent(caseId)}` : '#/complaints';
  return `#/${PAGE_SLUG[page]}`;
}

export function pageFromHash(hash: string): { page: NavPage; caseId?: string } {
  const [slug, id] = hash.replace(/^#\/?/, '').split('/');
  if (slug === 'case' && id) return { page: 'report_details', caseId: decodeURIComponent(id) };
  const match = (Object.keys(PAGE_SLUG) as (keyof typeof PAGE_SLUG)[]).find((k) => PAGE_SLUG[k] === (slug ?? ''));
  return { page: match ?? 'dashboard' };
}
