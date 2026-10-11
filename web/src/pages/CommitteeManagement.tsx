import { useEffect, useRef, useState } from 'react';
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
  const loadAllChallenges = async () => {
    const res = await ApiService.getChallenges();
    const list = res.data ?? [];
    setAllChallenges(list);
    setSelectedPoolId(
      (cur) => cur ?? list.find((c) => c.status === 'pending_independent_review')?.poolId ?? 'whistleblowing_ethics'
    );
  };

  const loadPoolData = async (poolId: CommitteePoolId) => {
    setLoading(true);
    const [membersRes, challengesRes] = await Promise.all([
      ApiService.getCommitteePool(poolId),
      ApiService.getChallenges(poolId)
    ]);
    setMembers(membersRes.data ?? []);
    setChallenges(challengesRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    loadAllChallenges();
  }, [currentUser.id]);

  useEffect(() => {
    if (selectedPoolId) loadPoolData(selectedPoolId);
  }, [selectedPoolId, currentUser.id]);

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

      {/* Pool tabs */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" aria-label="Committee pools" className="flex w-max gap-1 rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-card)]">
          {COMMITTEE_POOLS.map((p) => {
            const active = p.id === selectedPoolId;
            const pending = pendingByPool(p.id);
            return (
              <button
                key={p.id}
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedPoolId(p.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[0.8125rem] font-semibold transition-colors duration-200 ${
                  active ? 'bg-brand-600 text-white' : 'text-ink-soft hover:bg-brand-50 hover:text-brand-700'
                }`}
              >
                {p.name}
                {pending > 0 && (
                  <span
                    className={`flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.625rem] font-bold tabular ${
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

      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <p className="text-sm text-ink-soft">{pool.description}</p>
        <p className="text-xs text-muted">{pool.statutoryMandate}</p>
      </div>

      {pendingHere.length > 0 && (
        <button
          onClick={() => challengesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="flex w-full items-center gap-3 rounded-2xl border border-attn-100 bg-attn-50 px-4 py-3 text-left text-[0.8125rem] text-attn-700 transition-colors hover:border-attn-500/40"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="flex-1">
            <span className="font-semibold">
              {pendingHere.length} challenge{pendingHere.length > 1 ? 's' : ''} awaiting independent review.
            </span>{' '}
            Findings on the case wait for the decision.
          </span>
          <span className="shrink-0 font-semibold">Review ↓</span>
        </button>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <Section
          className="xl:col-span-5"
          icon={<Users />}
          title="Roster"
          description={`${members.length} member${members.length === 1 ? '' : 's'} in ${pool.name}`}
        >
          {loading ? (
            <SkeletonRows rows={3} label="Loading roster" />
          ) : members.length === 0 ? (
            <EmptyState compact icon={<Users />} title="No members in this pool" description="This pool has no vetted members yet." />
          ) : (
            <ul className="stagger space-y-2.5">
              {members.map((m) => {
                const st = MEMBER_STATUS[m.assignmentStatus] ?? MEMBER_STATUS.available;
                const risk = RISK[m.conflictRiskLevel];
                const u = DEMO_USERS.find((d) => d.id === m.id);
                return (
                  <li
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
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-4 flex items-start gap-2 border-t border-line pt-3 text-xs text-muted">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            Committees are seated automatically when a report is filed. A seat changes only through an upheld challenge.
          </p>
        </Section>

        <div ref={challengesRef} className="scroll-mt-24 space-y-4 xl:col-span-7">
          <div className="flex items-center gap-2">
            <Scale className="h-[18px] w-[18px] text-brand-600" />
            <h2 className="text-base font-semibold text-ink">Conflict challenges</h2>
            {!loading && <span className="chip bg-surface text-muted ring-1 ring-line tabular">{challenges.length}</span>}
          </div>
          {loading ? (
            <div className="card card-pad"><SkeletonRows rows={3} label="Loading challenges" /></div>
          ) : ordered.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<CheckCircle2 />}
                title={`No challenges in ${pool.name}`}
                description="Reporters can challenge a seated member for a conflict of interest from the INCOGNITO app. Challenges in other pools are counted on their tabs."
              />
            </div>
          ) : (
            ordered.map((ch) => <ChallengeReviewPanel key={ch.id} challenge={ch} onDecisionApplied={refresh} />)
          )}
          {!loading && members.some((m) => m.assignmentStatus === 'recused_conflict') && (
            <p className="flex items-center gap-2 text-xs text-muted">
              <UserX className="h-3.5 w-3.5" />
              Removed members lose access to that case immediately; the server refuses their requests.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
