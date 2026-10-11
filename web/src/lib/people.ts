import { DEMO_USERS, UserRole } from '../types/auth';

/** Display name for a staff id from the shared demo directory (the backend uses the same ids). */
export function staffName(id: string): string {
  return DEMO_USERS.find((u) => u.id === id)?.name ?? id;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  hr_reviewer: 'HR Reviewer',
  assigned_investigator: 'Investigator',
  committee_member: 'Committee Member',
  independent_reviewer: 'Independent Reviewer',
  administrator: 'Administrator'
};

export function initials(name: string): string {
  return name
    .replace(/^Dr\.\s*/, '')
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}
