import { useEffect, useRef, useState } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { AlertTriangle, CheckCircle2, Info, RefreshCw, Scale, UserX, Users } from 'lucide-react';
import { CommitteePoolId, COMMITTEE_POOLS, CommitteeMemberRecord, CommitteeChallenge } from '../types/committee';
import { ApiService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { DEMO_USERS } from '../types/auth';
import { ChallengeReviewPanel } from '../components/committee/ChallengeReviewPanel';
import { PageHeader } from '../components/ui/PageHeader';
import { Section } from '../components/ui/Section';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';
import { CommitteeFormationPanel } from '../components/committee/CommitteeFormationPanel';

interface CommitteeManagementProps {
  initialPoolId?: CommitteePoolId;
  onOpenCase?: (caseId: string) => void;
}

const MEMBER_STATUS: Record<CommitteeMemberRecord['assignmentStatus'], { label: string; cls: string }> = {
  active_assigned: { label: 'Seated', cls: 'bg-brand-50 text-brand-700' },
  available: { label: 'Available', cls: 'bg-teal-50 text-teal-700' },
  challenged: { label: 'Challenged', cls: 'bg-attn-50 text-attn-700' },
  recused_conflict: { label: 'Removed', cls: 'bg-danger-50 text-danger-700' }
};

const RISK: Record<CommitteeMemberRecord['conflictRiskLevel'], { label: string; cls: string } | null> = {
  none: null,
  low: null,
  moderate: { label: 'Moderate conflict risk', cls: 'bg-warn-50 text-warn-700' },
  high: { label: 'High conflict risk', cls: 'bg-danger-50 text-danger-700' }
};

export function CommitteeManagement({ initialPoolId, onOpenCase }: CommitteeManagementProps) {
  const { currentUser } = useAuth();
  const [selectedPoolId, setSelectedPoolId] = useState<CommitteePoolId | null>(initialPoolId ?? null);
  const [allChallenges, setAllChallenges] = useState<CommitteeChallenge[]>([]);
  const [members, setMembers] = useState<CommitteeMemberRecord[]>([]);
  const [challenges, setChallenges] = useState<CommitteeChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const challengesRef = useRef<HTMLDivElement>(null);

  // Open on the pool that holds a pending challenge, so a live challenge is never hidden behind the default pool.
  const loadAllChallenges = async (isCurrent = () => true) => {
    const res = await ApiService.getChallenges();
    if (!isCurrent()) return;
    const list = res.data ?? [];
    setAllChallenges(list);
    setSelectedPoolId(
      (cur) => cur ?? list.find((c) => c.status === 'pending_independent_review')?.poolId ?? 'whistleblowing_ethics'
    );
  };

  const loadPoolData = async (poolId: CommitteePoolId, silent = false, isCurrent = () => true) => {
    if (!silent) setLoading(true);
    const [membersRes, challengesRes] = await Promise.all([
      ApiService.getCommitteePool(poolId),
      ApiService.getChallenges(poolId)
    ]);
    if (!isCurrent()) return;
    setMembers(membersRes.data ?? []);
    setChallenges(challengesRes.data ?? []);
    if (!silent) setLoading(false);
  };

  useAutoRefresh((isCurrent) => loadAllChallenges(isCurrent), [currentUser.id]);
  useAutoRefresh((isCurrent, initial) => {
    if (selectedPoolId) return loadPoolData(selectedPoolId, !initial, isCurrent);
  }, [selectedPoolId ?? '', currentUser.id]);

  const refresh = () => {
    loadAllChallenges();
    if (selectedPoolId) loadPoolData(selectedPoolId);
  };

  const pool = COMMITTEE_POOLS.find((p) => p.id === selectedPoolId) ?? COMMITTEE_POOLS[0];
  const pendingByPool = (id: CommitteePoolId) =>
    allChallenges.filter((c) => c.poolId === id && c.status === 'pending_independent_review').length;
  const pendingHere = challenges.filter((c) => c.status === 'pending_independent_review');
  const ordered = [...challenges].sort(
    (a, b) =>
      Number(b.status === 'pending_independent_review') - Number(a.status === 'pending_independent_review') ||
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Committee Management"
        description="Who sits on each pool, where conflicts were raised, and the independent decisions on them."
        actions={
          <button className="btn btn-secondary btn-sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {/* Two-Column Primary Layout: Formation on Left, Challenges on Right */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left Column: Committee Formation and Assignment */}
        <div className="space-y-5">
          <CommitteeFormationPanel onCommitteeAssigned={refresh} />
        </div>

        {/* Right Column: User Committee Challenges */}
        <div ref={challengesRef} className="space-y-4">
          <div className="card card-pad space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-brand-600" />
                <div>
                  <h2 className="text-base font-semibold text-ink">User Committee Challenges</h2>
                  <p className="text-xs text-muted">Impartiality objections raised by anonymous reporters.</p>
                </div>
              </div>
              {!loading && (
                <span className="chip bg-surface text-muted ring-1 ring-line tabular">
                  {challenges.length} challenge{challenges.length === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {/* Pool Selector Tabs for Challenges */}
            <div className="-mx-2 overflow-x-auto px-2">
              <div
                role="tablist"
                aria-label="Committee pools"
                className="flex w-max gap-1 rounded-full border border-line bg-surface p-1 shadow-sm"
              >
                {COMMITTEE_POOLS.map((p) => {
                  const active = p.id === selectedPoolId;
                  const pending = pendingByPool(p.id);
                  return (
                    <button
                      key={p.id}
                      role="tab"
                      aria-selected={active}
                      onClick={() => setSelectedPoolId(p.id)}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors duration-200 ${
                        active ? 'bg-brand-600 text-white' : 'text-ink-soft hover:bg-brand-50 hover:text-brand-700'
                      }`}
                    >
                      {p.name}
                      {pending > 0 && (
                        <span
                          className={`flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[0.625rem] font-bold tabular ${
                            active ? 'bg-white text-brand-700' : 'bg-attn-500 text-white'
                          }`}
                          aria-label={`${pending} pending challenge${pending > 1 ? 's' : ''}`}
                        >
                          {pending}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {pendingHere.length > 0 && (
              <div className="flex items-center gap-2.5 rounded-xl border border-attn-200 bg-attn-50 px-3.5 py-2.5 text-xs text-attn-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-attn-600" />
                <span className="flex-1">
                  <strong>{pendingHere.length} challenge{pendingHere.length > 1 ? 's' : ''}</strong> awaiting independent ombudsperson review.
                </span>
              </div>
            )}

            {loading ? (
              <SkeletonRows rows={3} label="Loading challenges" />
            ) : ordered.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 />}
                title={`No challenges in ${pool.name}`}
                description="Reporters can challenge a seated member for a conflict of interest from the mobile app. Challenges in other pools are counted on their tabs."
              />
            ) : (
              <div className="space-y-4">
                {ordered.map((ch) => (
                  <ChallengeReviewPanel key={ch.id} challenge={ch} onDecisionApplied={refresh} />
                ))}
              </div>
            )}

            {!loading && members.some((m) => m.assignmentStatus === 'recused_conflict') && (
              <p className="flex items-center gap-2 border-t border-line/60 pt-3 text-xs text-muted">
                <UserX className="h-3.5 w-3.5" />
                Removed members lose access to that case immediately; the server refuses their requests.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Roster Section below */}
      <Section
        className="w-full"
        icon={<Users />}
        title={`Committee Pool Roster: ${pool.name}`}
        description={`${members.length} member${members.length === 1 ? '' : 's'} vetted in ${pool.name}. ${pool.statutoryMandate}`}
      >
        {loading ? (
          <SkeletonRows rows={2} label="Loading roster" />
        ) : members.length === 0 ? (
          <EmptyState compact icon={<Users />} title="No members in this pool" description="This pool has no vetted members yet." />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {members.map((m) => {
              const st = MEMBER_STATUS[m.assignmentStatus] ?? MEMBER_STATUS.available;
              const risk = RISK[m.conflictRiskLevel];
              const u = DEMO_USERS.find((d) => d.id === m.id);
              return (
                <div
                  key={m.id}
                  className={`rounded-2xl border p-3.5 ${
                    m.assignmentStatus === 'challenged' ? 'border-attn-100 bg-attn-50/40' : 'border-line'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar src={u?.avatar} name={m.name} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <p className="truncate text-[0.8125rem] font-semibold text-ink">{m.name}</p>
                        <span className={`chip ${st.cls}`}>{st.label}</span>
                      </div>
                      <p className="truncate text-xs text-muted">
                        {m.roleTitle} · {m.department}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        {risk && <span className={`chip ${risk.cls}`}>{risk.label}</span>}
                        {m.assignedCaseIds.length > 0 ? (
                          m.assignedCaseIds.map((id) => (
                            <button
                              key={id}
                              onClick={() => onOpenCase?.(id)}
                              disabled={!onOpenCase}
                              className="case-id rounded-md bg-sunken px-1.5 py-0.5 text-brand-700 hover:bg-brand-50"
                            >
                              {id}
                            </button>
                          ))
                        ) : (
                          <span className="text-muted">No cases seated</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-xs text-muted">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          Committees are seated automatically when a report is filed. A seat changes only through an upheld challenge.
        </p>
      </Section>
    </div>
  );
}
