import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import {
  AlertTriangle,
  ArrowRight,
  FolderOpen,
  History,
  Radio,
  RefreshCw,
  Scale
} from 'lucide-react';
import { Complaint } from '../types/complaint';
import { CommitteeChallenge } from '../types/committee';
import { AuditEvent } from '../types/audit';
import { ApiService } from '../services/api';
import { ComplaintTable } from '../components/complaints/ComplaintTable';
import { ReflectReformCard } from '../components/ui/ReflectReformCard';
import { Section } from '../components/ui/Section';
import { Notice } from '../components/ui/Notice';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton';
import { AuditStatusChip } from '../components/audit/AuditStatusChip';
import { NavPage } from '../components/layout/nav';
import { useAuth } from '../hooks/useAuth';
import { ROLE_LABEL } from '../lib/people';
import { SEVERITY_ORDER, isOpen, relativeTime } from '../lib/format';
import { CaseProgressCalendarModal } from '../components/case/CaseProgressCalendarModal';

interface DashboardProps {
  onNavigate: (page: NavPage, selectedCaseId?: string) => void;
}

interface WitnessTally {
  pending: number;
  casesWithPending: string[];
  available: boolean;
}

interface NextAction {
  key: string;
  kind: string;
  tone: 'attn' | 'brand' | 'danger' | 'teal';
  title: string;
  detail: string;
  caseId: string;
  onOpen: () => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const { currentUser } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [challenges, setChallenges] = useState<CommitteeChallenge[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [witness, setWitness] = useState<WitnessTally | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCaseForModal, setSelectedCaseForModal] = useState<Complaint | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [hiddenBelow, setHiddenBelow] = useState(0);

  // Count actions scrolled out of view so the panel can say so instead of silently clipping them.
  const measureHidden = () => {
    const el = listRef.current;
    if (!el) return;
    const bottom = el.getBoundingClientRect().bottom;
    const items = Array.from(el.querySelectorAll('li'));
    const next = items.filter((li) => {
      const r = li.getBoundingClientRect();
      return r.top + r.height / 2 > bottom;
    }).length;
    setHiddenBelow((cur) => (cur === next ? cur : next));
  };

  const loadData = async (silent: boolean | unknown = false, isCurrent: () => boolean = () => true) => {
    const isSilent = silent === true;
    if (!isSilent) {
      setLoading(true);
      setComplaints([]);
      setWitness(null);
    }
    setError(null);
    const [cRes, chRes, aRes] = await Promise.all([
      ApiService.getReports(),
      ApiService.getChallenges(),
      ApiService.getAuditEvents()
    ]);
    if (!isCurrent()) return;
    if (!cRes.success) setError(cRes.error || 'Could not load cases.');
    const cases = cRes.data ?? [];
    setComplaints(cases);
    setChallenges(chRes.data ?? []);
    setEvents(aRes.success && aRes.data ? aRes.data : []);
    if (!isSilent) setLoading(false);

    // Witness responses still pending, summed over open cases this role can see.
    const open = cases.filter((c) => isOpen(c.status));
    const summaries = await Promise.all(open.map((c) => ApiService.getWitnessQuorumSummary(c.id)));
    if (!isCurrent()) return;
    const ok = summaries.filter((s) => s.success && s.data);
    setWitness({
      pending: ok.reduce((n, s) => n + (s.data?.pending ?? 0), 0),
      casesWithPending: ok.filter((s) => (s.data?.pending ?? 0) > 0).map((s) => s.data!.complaintId),
      available: ok.length > 0 || open.length === 0
    });
  };

  useAutoRefresh((isCurrent, initial) => loadData(!initial, isCurrent), [currentUser.id]);

  useEffect(() => {
    measureHidden();
    window.addEventListener('resize', measureHidden);
    return () => window.removeEventListener('resize', measureHidden);
  });

  const open = complaints.filter((c) => isOpen(c.status));
  const urgent = open.filter((c) => c.severity === 'critical' || c.severity === 'high');
  const pendingChallenges = challenges.filter((c) => c.status === 'pending_independent_review');
  const resolvedCount = complaints.filter((c) => c.status === 'resolved' || c.status === 'archived').length;
  const priority = [...open]
    .sort(
      (a, b) =>
        SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    )
    .slice(0, 5);

  const canAdjudicate = currentUser.role === 'independent_reviewer' || currentUser.role === 'administrator';

  // Next actions come only from live state: pending challenges, new reports, critical cases, witness responses.
  const actions: NextAction[] = [
    ...pendingChallenges.map<NextAction>((ch) => ({
      key: `ch-${ch.id}`,
      kind: 'Challenge',
      tone: 'attn',
      title: canAdjudicate
        ? `Decide challenge to ${ch.challengedMemberName}`
        : `Challenge to ${ch.challengedMemberName} awaits review`,
      detail: ch.complaintTitle,
      caseId: ch.complaintId,
      onOpen: () => onNavigate('committee')
    })),
    ...open
      .filter((c) => c.status === 'submitted')
      .map<NextAction>((c) => ({
        key: `new-${c.id}`,
        kind: 'New report',
        tone: 'brand',
        title: 'Triage new report',
        detail: c.title,
        caseId: c.id,
        onOpen: () => onNavigate('report_details', c.id)
      })),
    ...open
      .filter((c) => c.severity === 'critical' && c.status !== 'submitted')
      .map<NextAction>((c) => ({
        key: `crit-${c.id}`,
        kind: 'Critical',
        tone: 'danger',
        title: c.title,
        detail: c.requiredNextAction,
        caseId: c.id,
        onOpen: () => onNavigate('report_details', c.id)
      })),
    ...(witness?.casesWithPending ?? []).map<NextAction>((id) => ({
      key: `w-${id}`,
      kind: 'Witnesses',
      tone: 'brand',
      title: 'Witness replies outstanding',
      detail: complaints.find((c) => c.id === id)?.title ?? 'Voluntary invitations awaiting a reply',
      caseId: id,
      onOpen: () => onNavigate('witness')
    }))
  ];

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="space-y-5">
      {error && (
        <Notice
          tone="danger"
          role="alert"
          title="Cases could not be loaded"
          action={
            <button className="btn btn-secondary btn-sm" onClick={() => void loadData()}>
              <RefreshCw />
              Retry
            </button>
          }
        >
          {error}
        </Notice>
      )}

      {/* Row 1: hero band + next actions (stacked below xl; hero sizes to its content) */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <section
          aria-labelledby="overview-title"
          className="relative overflow-hidden rounded-[var(--radius-card)] bg-brand-600 p-5 text-white shadow-[var(--shadow-raised)] sm:p-7 xl:col-span-8"
        >
          <HeroPattern />
          <div className="relative">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 id="overview-title" className="text-[1.75rem] font-bold tracking-tight sm:text-[2rem]">
                  Overview
                </h1>
                <p className="mt-0.5 text-sm text-brand-100">{today}</p>
              </div>
              <p className="text-sm text-brand-100">
                {currentUser.name} · <span className="font-semibold text-white">{ROLE_LABEL[currentUser.role]}</span>
              </p>
            </div>

            {!loading && (
              <p className="mt-5 max-w-xl text-[0.9375rem] leading-snug text-brand-100">
                {actions.length === 0 ? (
                  'Nothing needs your action right now.'
                ) : (
                  <>
                    Start with{' '}
                    <button onClick={actions[0].onOpen} className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
                      {actions[0].title.replace(/^./, (ch) => ch.toLowerCase())}
                    </button>
                    {actions.length > 1 && <> and {actions.length - 1} more item{actions.length > 2 ? 's' : ''} in Next actions.</>}
                  </>
                )}
              </p>
            )}

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <HeroStat
                label="Open cases"
                value={loading ? null : open.length}
                note={loading ? '' : `${complaints.length} accessible to you`}
                icon={<FolderOpen />}
                onClick={() => onNavigate('reports')}
              />
              <HeroStat
                label="Critical or high"
                value={loading ? null : urgent.length}
                note="triage severity, not findings"
                icon={<AlertTriangle />}
                emphasis={urgent.length > 0}
                onClick={() => onNavigate('reports')}
              />
              <HeroStat
                label="Challenges to decide"
                value={loading ? null : pendingChallenges.length}
                note="awaiting independent review"
                icon={<Scale />}
                emphasis={pendingChallenges.length > 0}
                onClick={() => onNavigate('committee')}
              />
              <HeroStat
                label="Witness replies pending"
                value={witness === null ? null : witness.available ? witness.pending : '—'}
                note={witness && !witness.available ? 'not visible to your role' : 'voluntary invitations'}
                icon={<Radio />}
                onClick={() => onNavigate('witness')}
              />
            </div>
          </div>
        </section>

        {/* At xl the panel takes the hero's height (row height comes from the hero) and its list scrolls. */}
        <div className="relative xl:col-span-4">
          <section
            aria-labelledby="actions-title"
            className="card flex flex-col p-5 sm:p-6 xl:absolute xl:inset-0"
          >
            <div className="flex items-baseline justify-between gap-2 border-b border-line pb-2.5">
              <h2 id="actions-title" className="text-base font-semibold text-ink">
                Next actions
                {!loading && <span className="ml-2 font-medium text-muted tabular">{actions.length}</span>}
              </h2>
              <span className="text-xs text-muted">In priority order</span>
            </div>
            <div
              ref={listRef}
              onScroll={measureHidden}
              className="-mx-5 min-h-0 flex-1 overflow-y-auto sm:-mx-6"
              tabIndex={0}
              aria-label="Next actions list"
            >
              {loading ? (
                <div className="space-y-4 px-5 pt-4 sm:px-6">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-3 w-20" />
                      <Skeleton className="h-4 w-4/5" />
                    </div>
                  ))}
                </div>
              ) : actions.length === 0 ? (
                <div className="px-5 pt-6 sm:px-6">
                  <p className="text-sm font-semibold text-ink">Nothing needs your action</p>
                  <p className="mt-1 max-w-[18rem] text-xs text-muted">
                    New reports, challenges and witness replies will appear here.
                  </p>
                </div>
              ) : (
                <ol className="divide-y divide-line">
                  {actions.map((a) => (
                    <li key={a.key}>
                      <button
                        onClick={a.onOpen}
                        className="group block w-full px-5 py-2.5 text-left transition-colors hover:bg-sunken focus-visible:bg-sunken sm:px-6"
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={`text-[0.6875rem] font-semibold ${KIND_TONE[a.tone]}`}>{a.kind}</span>
                          <span className="case-id text-[0.6875rem] font-medium text-muted">{a.caseId}</span>
                        </span>
                        <span className="mt-0.5 block text-[0.8125rem] font-semibold leading-snug text-ink group-hover:text-brand-700">
                          {a.title}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted">{a.detail}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            {hiddenBelow > 0 && (
              <button
                onClick={() => listRef.current?.scrollBy({ top: listRef.current.clientHeight * 0.8, behavior: 'smooth' })}
                className="-mx-5 -mb-2 border-t border-line px-5 pt-2.5 text-left text-xs font-semibold text-brand-700 hover:underline sm:-mx-6 sm:px-6"
              >
                {hiddenBelow} more below
              </button>
            )}
          </section>
        </div>
      </div>

      {/* Row 2: priority queue (full width) with calendar modal on case selection */}
      <div className="grid grid-cols-1 gap-5">
        <Section
          className="w-full"
          title="Priority queue"
          description="Open cases you can access, highest triage severity first. Select any case to view its progress calendar and milestones."
          action={
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('reports')}>
              All complaints
              <ArrowRight />
            </button>
          }
        >
          {loading ? (
            <SkeletonRows rows={4} label="Loading cases" />
          ) : priority.length === 0 ? (
            <EmptyState
              compact
              icon={<FolderOpen />}
              title="No open cases"
              description={
                complaints.length === 0
                  ? 'No cases are assigned to your role yet.'
                  : 'Every case you can access has been resolved.'
              }
            />
          ) : (
            <ComplaintTable
              compact
              complaints={priority}
              onSelectComplaint={(c) => setSelectedCaseForModal(c)}
            />
          )}
        </Section>
      </div>

      {/* Case-specific Progress Calendar & Milestones Modal */}
      <CaseProgressCalendarModal
        complaint={selectedCaseForModal}
        isOpen={selectedCaseForModal !== null}
        onClose={() => setSelectedCaseForModal(null)}
        onNavigateToDossier={(caseId) => onNavigate('report_details', caseId)}
        onNavigateToComplaints={() => onNavigate('reports')}
      />

      {/* Row 3: recent activity + Reflect & Reform */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Section
          className="lg:col-span-8"
          icon={<History />}
          title="Recent activity"
          description="Latest Silent Audit entries for cases you can access, with the verifier's status."
        >
          {loading ? (
            <SkeletonRows rows={4} label="Loading activity" />
          ) : events.length === 0 ? (
            <EmptyState compact icon={<History />} title="No recorded activity" description="Audit entries appear as cases move through the process." />
          ) : (
            <ol className="stagger divide-y divide-line/70">
              {[...events]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 7)
                .map((e) => (
                  <li key={e.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.8125rem] font-medium text-ink">{e.details}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {e.actorRef} ·{' '}
                        <button className="case-id text-brand-700 hover:underline" onClick={() => onNavigate('report_details', e.complaintId)}>
                          {e.complaintId}
                        </button>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <AuditStatusChip status={e.verificationStatus} />
                      <time dateTime={e.timestamp} className="w-16 text-right text-xs text-muted tabular">
                        {relativeTime(e.timestamp)}
                      </time>
                    </div>
                  </li>
                ))}
            </ol>
          )}
        </Section>

        <div className="lg:col-span-4">
          <ReflectReformCard />
        </div>
      </div>
    </div>
  );
}

function HeroPattern() {
  // Quiet concentric arcs echoing the shield mark; decorative only.
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-[26rem] w-[26rem] text-white/[0.07]" viewBox="0 0 400 400" fill="none">
      {[60, 100, 140, 180].map((r) => (
        <circle key={r} cx="200" cy="200" r={r} stroke="currentColor" strokeWidth="26" />
      ))}
    </svg>
  );
}

function HeroStat({
  label,
  value,
  note,
  icon,
  emphasis = false,
  onClick
}: {
  label: string;
  value: number | string | null;
  note: string;
  icon: ReactNode;
  emphasis?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-2xl bg-white p-3.5 text-left text-ink shadow-[0_6px_16px_-10px_rgb(25_22_41/0.5)] transition-transform duration-200 hover:-translate-y-0.5 sm:p-4"
    >
      <span className="flex items-center gap-2 text-xs font-semibold text-muted">
        <span
          className={`flex h-7 w-7 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${
            emphasis ? 'bg-attn-50 text-attn-600' : 'bg-brand-50 text-brand-600'
          }`}
        >
          {icon}
        </span>
        <span className="leading-tight">{label}</span>
      </span>
      <span className="mt-3 block text-[1.75rem] font-bold leading-none tracking-tight tabular">
        {value === null ? <span aria-label="Loading" className="skeleton inline-block h-7 w-10 align-middle" /> : value}
      </span>
      <span className="mt-1.5 block text-[0.6875rem] leading-snug text-muted">{note}</span>
    </button>
  );
}

const KIND_TONE: Record<NextAction['tone'], string> = {
  attn: 'text-attn-600',
  brand: 'text-brand-600',
  danger: 'text-danger-600',
  teal: 'text-teal-700'
};
