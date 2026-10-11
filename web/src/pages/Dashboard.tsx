import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  FileSearch,
  FolderOpen,
  Gavel,
  History,
  Radio,
  RefreshCw,
  Scale,
  Siren
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
import { SEVERITY_ORDER, STATUS_LABEL, isOpen, relativeTime } from '../lib/format';

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
  icon: ReactNode;
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

  const loadData = async () => {
    setLoading(true);
    setError(null);
    const [cRes, chRes, aRes] = await Promise.all([
      ApiService.getReports(),
      ApiService.getChallenges(),
      ApiService.getAuditEvents()
    ]);
    if (!cRes.success) setError(cRes.error || 'Could not load cases.');
    const cases = cRes.data ?? [];
    setComplaints(cases);
    setChallenges(chRes.data ?? []);
    setEvents(aRes.success && aRes.data ? aRes.data : []);
    setLoading(false);

    // Witness responses still pending, summed over open cases this role can see.
    const open = cases.filter((c) => isOpen(c.status));
    const summaries = await Promise.all(open.map((c) => ApiService.getWitnessQuorumSummary(c.id)));
    const ok = summaries.filter((s) => s.success && s.data);
    setWitness({
      pending: ok.reduce((n, s) => n + (s.data?.pending ?? 0), 0),
      casesWithPending: ok.filter((s) => (s.data?.pending ?? 0) > 0).map((s) => s.data!.complaintId),
      available: ok.length > 0 || open.length === 0
    });
  };

  useEffect(() => {
    setWitness(null);
    loadData();
  }, [currentUser.id]);

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
      icon: <Scale />,
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
        icon: <FileSearch />,
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
        icon: <Siren />,
        tone: 'danger',
        title: `Critical: ${c.title}`,
        detail: c.requiredNextAction,
        caseId: c.id,
        onOpen: () => onNavigate('report_details', c.id)
      })),
    ...(witness?.casesWithPending ?? []).map<NextAction>((id) => ({
      key: `w-${id}`,
      icon: <Radio />,
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
            <button className="btn btn-secondary btn-sm" onClick={loadData}>
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
        <section aria-labelledby="actions-title" className="flex flex-col rounded-[var(--radius-card)] bg-night p-5 text-white shadow-[var(--shadow-raised)] sm:p-6 xl:absolute xl:inset-0">
          <div className="flex items-center justify-between gap-2">
            <h2 id="actions-title" className="text-base font-semibold">Next actions</h2>
            {!loading && (
              <span className="chip bg-white/10 text-white tabular">
                {actions.length} {actions.length === 1 ? 'item' : 'items'}
              </span>
            )}
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-y-auto" tabIndex={0} aria-label="Next actions list">
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-12 animate-pulse rounded-xl bg-white/5" />
                ))}
              </div>
            ) : actions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center py-8 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-500/20 text-teal-100">
                  <Gavel className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold">Nothing needs your action</p>
                <p className="mt-1 max-w-[16rem] text-xs text-white/60">
                  New reports, challenges and witness replies will appear here.
                </p>
              </div>
            ) : (
              <ul className="stagger space-y-0.5">
                {actions.map((a) => (
                  <li key={a.key}>
                    <button
                      onClick={a.onOpen}
                      className="group flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/[0.07]"
                    >
                      <ActionIcon tone={a.tone}>{a.icon}</ActionIcon>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[0.8125rem] font-semibold leading-snug">{a.title}</span>
                        <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-xs leading-snug text-white/70">
                          <span>{a.detail}</span>
                          <span className="font-mono text-[0.6875rem] text-white/45">{a.caseId}</span>
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
        </div>
      </div>

      {/* Row 2: priority queue + case progress */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Section
          className="lg:col-span-8"
          title="Priority queue"
          description="Open cases you can access, highest triage severity first."
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
            <ComplaintTable compact complaints={priority} onSelectComplaint={(c) => onNavigate('report_details', c.id)} />
          )}
        </Section>

        <Section className="lg:col-span-4" title="Case progress" description="Where accessible cases sit in the process.">
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-3 w-full" />
              <SkeletonRows rows={3} />
            </div>
          ) : (
            <StageBreakdown complaints={complaints} resolved={resolvedCount} />
          )}
        </Section>
      </div>

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

function ActionIcon({ tone, children }: { tone: NextAction['tone']; children: ReactNode }) {
  const cls = {
    attn: 'bg-attn-500/20 text-attn-100',
    brand: 'bg-brand-500/30 text-brand-100',
    danger: 'bg-danger-500/25 text-danger-100',
    teal: 'bg-teal-500/20 text-teal-100'
  }[tone];
  return <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg [&>svg]:h-4 [&>svg]:w-4 ${cls}`}>{children}</span>;
}

const STAGES: Array<{ key: Complaint['status'][]; label: string; color: string }> = [
  { key: ['submitted'], label: STATUS_LABEL.submitted, color: 'bg-brand-200' },
  { key: ['committee_assigned', 'reassignment_pending'], label: 'Committee', color: 'bg-brand-300' },
  { key: ['under_challenge'], label: STATUS_LABEL.under_challenge, color: 'bg-attn-500' },
  { key: ['investigation_active', 'witness_quorum_active'], label: 'Investigating', color: 'bg-brand-600' },
  { key: ['resolved', 'archived'], label: 'Resolved', color: 'bg-teal-500' }
];

function StageBreakdown({ complaints, resolved }: { complaints: Complaint[]; resolved: number }) {
  const total = complaints.length;
  if (total === 0) {
    return <EmptyState compact title="No cases yet" description="Progress appears once cases are assigned to your role." />;
  }
  const rows = STAGES.map((s) => ({ ...s, count: complaints.filter((c) => s.key.includes(c.status)).length }));
  return (
    <div>
      <p className="text-ink">
        <span className="text-[1.75rem] font-bold tracking-tight tabular">{resolved}</span>
        <span className="text-sm text-muted"> of {total} resolved</span>
      </p>
      <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label={`${resolved} of ${total} cases resolved`}>
        {rows
          .filter((r) => r.count > 0)
          .map((r) => (
            <span key={r.label} className={`bar-grow ${r.color}`} style={{ width: `${(r.count / total) * 100}%` }} />
          ))}
      </div>
      <ul className="mt-5 space-y-3">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-3 text-[0.8125rem]">
            <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-sm ${r.color}`} />
            <span className="flex-1 text-ink-soft">{r.label}</span>
            <span className="w-6 text-right font-semibold text-ink tabular">{r.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
