export type UserRole = 
  | 'hr_reviewer' 
  | 'assigned_investigator' 
  | 'committee_member' 
  | 'independent_reviewer' 
  | 'administrator';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  department: string;
  avatar: string;
  assignedCaseIds: string[];
  conflictedCaseIds: string[];
}

export const DEMO_USERS: User[] = [
  {
    id: 'usr_sarah',
    name: 'Sarah Jenkins',
    email: 's.jenkins@incognito.org',
    role: 'hr_reviewer',
    title: 'Senior HR Operations & Compliance Lead',
    department: 'People & Culture',
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
    assignedCaseIds: ['INC-892', 'INC-741', 'INC-650', 'INC-512'],
    conflictedCaseIds: []
  },
  {
    id: 'usr_elena',
    name: 'Elena Rostova',
    email: 'e.rostova@incognito.org',
    role: 'assigned_investigator',
    title: 'Lead Workplace Misconduct Investigator',
    department: 'Independent Ethics Unit',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
    assignedCaseIds: ['INC-892', 'INC-741', 'INC-650', 'INC-512'],
    conflictedCaseIds: []
  },
  {
    id: 'usr_marcus',
    name: 'Marcus Vance',
    email: 'm.vance@incognito.org',
    role: 'committee_member',
    title: 'VP of Engineering Operations',
    department: 'Engineering Operations',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    assignedCaseIds: ['INC-892'], // Challenged by employee for supervisory conflict!
    conflictedCaseIds: ['INC-892']
  },
  {
    id: 'usr_priya',
    name: 'Priya Sundaram',
    email: 'p.sundaram@incognito.org',
    role: 'committee_member',
    title: 'Senior Director of People Relations',
    department: 'People Relations',
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    assignedCaseIds: [], // Seated as the replacement when a challenge is upheld
    conflictedCaseIds: []
  },
  {
    id: 'usr_aris',
    name: 'Dr. Aris Thorne',
    email: 'a.thorne@ombuds-independent.org',
    role: 'independent_reviewer',
    title: 'Independent Ombudsperson & Challenge Adjudicator',
    department: 'External Oversight Panel',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    assignedCaseIds: [],
    conflictedCaseIds: []
  },
  {
    id: 'usr_david',
    name: 'David Kim',
    email: 'd.kim@incognito.org',
    role: 'committee_member',
    title: 'Associate General Counsel (Labor)',
    department: 'Legal Counsel',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    assignedCaseIds: ['INC-741', 'INC-650'],
    conflictedCaseIds: []
  }
];

/** Accounts with access to the HR & Investigation dashboard to demonstrate patterns and witness quorum */
export const DASHBOARD_ACCOUNTS: User[] = [
  DEMO_USERS[0], // Sarah Jenkins (HR Reviewer - Pattern Intelligence & Triage)
  DEMO_USERS[1]  // Elena Rostova (Lead Investigator - Witness Quorum & Evidence)
];
