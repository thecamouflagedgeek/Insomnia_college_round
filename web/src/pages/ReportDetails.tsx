import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, Check, FileText, Lock, Scale } from 'lucide-react';
import { Complaint } from '../types/complaint';
import { CommitteeChallenge } from '../types/committee';
import { ApiService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Section } from '../components/ui/Section';
import { Notice } from '../components/ui/Notice';
import { Skeleton, SkeletonRows } from '../components/ui/Skeleton';
import { Avatar } from '../components/ui/Avatar';
import { EvidenceIntegrityPanel } from '../components/complaints/EvidenceIntegrityPanel';
import { WitnessQuorumPanel } from '../components/investigation/WitnessQuorumPanel';
import { CaseOutcomePanel, RelatedCasesPanel } from '../components/case/CaseActionsPanel';
import { AuditTimeline } from '../components/audit/AuditTimeline';
import { AccessDeniedBanner } from '../components/ui/AccessDeniedBanner';
import { NavPage } from '../components/layout/nav';
import { DEMO_USERS } from '../types/auth';
import { staffName } from '../lib/people';
import { categoryLabel, formatDateTime, shortHash } from '../lib/format';

interface ReportDetailsProps {
  complaintId: string;
  onBack: () => void;
  onNavigate: (page: NavPage, caseId?: string) => void;
}

const STAGES = [
  { label: 'Submitted', statuses: ['submitted'] },
  { label: 'Committee', statuses: ['committee_assigned', 'under_challenge', 'reassignment_pending'] },
  { label: 'Investigation', statuses: ['investigation_active', 'witness_quorum_active'] },
  { label: 'Resolved', statuses: ['resolved', 'archived'] }
];

export function ReportDetails({ complaintId, onBack, onNavigate }: ReportDetailsProps) {
  const { currentUser } = useAuth();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [challenge, setChallenge] = useState<CommitteeChallenge | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCase = async () => {
    setLoading(true);
    setAccessError(null);
    const res = await ApiService.getReport(complaintId);
    if (res.success && res.data) {
      setComplaint(res.data);
      const ch = await ApiService.getChallenges();
      setChallenge(
        ch.data?.find((c) => c.complaintId === complaintId && c.status === 'pending_independent_review') ?? null
      );
    } else {
      setComplaint(null);
      setAccessError(res.error || `You are not authorised to view case ${complaintId}.`);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (complaintId) fetchCase();
    else setLoading(false);
  }, [complaintId, currentUser.id]);

  const back = (
    <button className="btn btn-ghost btn-sm -ml-2" onClick={onBack}>
      <ArrowLeft />
      Complaints queue
    </button>
  );

  if (!complaintId) {
    return (
      <div className="space-y-4">
        {back}
        <Notice tone="neutral">No case selected. Open one from the complaints queue.</Notice>
      </div>
    );
  }

  if (loading && !complaint) {
    return (
      <div className="space-y-5">
        {back}
        <div className="card card-pad space-y-4" role="status" aria-label="Loading case">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-2.5 w-full" />
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="card card-pad lg:col-span-8"><SkeletonRows rows={5} /></div>
          <div className="card card-pad lg:col-span-4"><SkeletonRows rows={3} /></div>
        </div>
      </div>
    );
  }

  if (accessError) {
    return <AccessDeniedBanner caseId={complaintId} errorMessage={accessError} onBack={onBack} onRetry={fetchCase} />;
  }

  if (!complaint) return null;

  const stageIndex = STAGES.findIndex((s) => s.statuses.includes(complaint.status));
  const revokedHere = complaint.revokedMemberIds;

  return (
    <div className="space-y-5">
      {back}

      {/* Case header */}
      <section className="card card-pad" aria-labelledby="case-title">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="case-id rounded-lg bg-brand-50 px-2 py-1 text-brand-700">{complaint.id}</span>
              <span className="font-mono text-xs text-muted" title="Case-specific reporter token; not linkable to a person">
                Reporter {complaint.anonymousToken}
              </span>
            </div>
            <h1 id="case-title" className="mt-2 text-2xl font-bold tracking-tight text-ink text-balance">{complaint.title}</h1>
            <p className="mt-1 text-sm text-muted">
              {categoryLabel(complaint.category, complaint.categoryLabel)} · filed {formatDateTime(complaint.submittedAt)} · {complaint.departmentScope}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 lg:justify-end">
            <SeverityBadge severity={complaint.severity} />
            <StatusBadge status={complaint.status} />
          </div>
        </div>

        {/* Stage track */}
        <ol className="mt-6 grid grid-cols-4 gap-1.5" aria-label="Case stage">
          {STAGES.map((s, i) => {
            const done = i < stageIndex;
            const current = i === stageIndex;
            const challenged = current && complaint.status === 'under_challenge';
            return (
              <li key={s.label} aria-current={current ? 'step' : undefined}>
                <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                  <div
                    className={`bar-grow h-full rounded-full ${
                      challenged ? 'bg-attn-500' : done ? 'bg-brand-300' : current ? 'bg-brand-600' : 'bg-transparent'
                    }`}
                    style={{ animationDelay: `${i * 80}ms` }}
                  />
                </div>
                <p className={`mt-2 flex items-center gap-1 text-xs ${current ? 'font-semibold text-ink' : 'text-muted'}`}>
                  {done && <Check className="h-3.5 w-3.5 text-brand-500" />}
                  {challenged && <AlertTriangle className="h-3.5 w-3.5 text-attn-500" />}
                  <span className="truncate">{s.label}</span>
                </p>
              </li>
            );
          })}
        </ol>

        <p className="mt-4 rounded-xl bg-sunken px-3.5 py-2.5 text-[0.8125rem] text-ink-soft">
          <span className="font-semibold text-ink">Next: </span>
          {complaint.requiredNextAction}
        </p>
      </section>

      {complaint.status === 'under_challenge' && (
        <Notice
          tone="warning"
          title="Committee challenge pending"
          action={
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('committee')}>
              <Scale />
              Open challenge
            </button>
          }
        >
          {challenge
            ? `The reporter challenged ${challenge.challengedMemberName}. An independent reviewer must decide before findings proceed.`
            : 'The reporter challenged a committee member. An independent reviewer must decide before findings proceed.'}
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-5 lg:col-span-8">
          <Section icon={<FileText />} title="Report" description="The reporter's own words, as submitted.">
            <p className="max-w-[72ch] whitespace-pre-wrap text-sm leading-relaxed text-ink">{complaint.summary}</p>
            {((complaint.severitySignals?.length ?? 0) > 0 || (complaint.integrityFlags?.length ?? 0) > 0) && (
              <div className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
                {(complaint.severitySignals?.length ?? 0) > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-ink-soft">Severity signals</h3>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {complaint.severitySignals!.map((s) => (
                        <li key={s} className="chip bg-sunken text-ink-soft">{s}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(complaint.integrityFlags?.length ?? 0) > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold text-ink-soft">Integrity flags</h3>
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {complaint.integrityFlags!.map((f) => (
                        <li key={f} className="chip bg-warn-50 text-warn-700">{f.replace(/_/g, ' ')}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p className="text-xs text-muted sm:col-span-2">Automated cues for human review, not conclusions.</p>
              </div>
            )}
          </Section>

          <EvidenceIntegrityPanel evidence={complaint.evidence} complaintId={complaint.id} />
          <WitnessQuorumPanel complaintId={complaint.id} />
          <AuditTimeline complaintId={complaint.id} />
        </div>

        <div className="space-y-5 lg:col-span-4">
          <Section
            title="Committee"
            action={
              <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('committee')}>
                Manage
              </button>
            }
          >
            {complaint.committeeMemberIds.length === 0 && revokedHere.length === 0 ? (
              <p className="text-[0.8125rem] text-muted">No committee seated yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {complaint.committeeMemberIds.map((id) => {
                  const u = DEMO_USERS.find((d) => d.id === id);
                  return (
                    <li key={id} className="flex items-center gap-3">
                      <Avatar src={u?.avatar} name={staffName(id)} size={32} />
                      <div className="min-w-0">
                        <p className="truncate text-[0.8125rem] font-semibold text-ink">{staffName(id)}</p>
                        <p className="truncate text-xs text-muted">{u?.title ?? 'Committee member'}</p>
                      </div>
                    </li>
                  );
                })}
                {revokedHere.map((id) => (
                  <li key={`rev-${id}`} className="flex items-center gap-3 opacity-80">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-50 text-danger-600">
                      <Lock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[0.8125rem] font-semibold text-ink line-through decoration-danger-500/60">{staffName(id)}</p>
                      <p className="text-xs text-danger-700">Removed by upheld challenge</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {complaint.assignedInvestigatorId && (
              <p className="mt-4 border-t border-line pt-3 text-xs text-muted">
                Investigator: <span className="font-semibold text-ink">{staffName(complaint.assignedInvestigatorId)}</span>
              </p>
            )}
          </Section>

          <CaseOutcomePanel complaint={complaint} onChanged={fetchCase} />
          <RelatedCasesPanel complaintId={complaint.id} onOpenCase={(id) => onNavigate('report_details', id)} />

          <Section title="Anonymity proof">
            <dl className="space-y-2.5 text-xs">
              <div>
                <dt className="text-muted">Report nullifier</dt>
                <dd className="mt-0.5 truncate font-mono text-ink" title={complaint.zkpNullifierHash}>
                  {shortHash(complaint.zkpNullifierHash, 14, 8) || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Proof transaction</dt>
                <dd className="mt-0.5 truncate font-mono text-ink" title={complaint.blockchainSealTx}>
                  {shortHash(complaint.blockchainSealTx, 14, 8) || '—'}
                </dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-muted">
              The nullifier stops duplicate reports without revealing who filed this one.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
