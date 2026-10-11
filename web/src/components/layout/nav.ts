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
