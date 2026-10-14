import { useEffect, useState } from 'react';
import { useAutoRefresh, refreshDashboard } from '../../hooks/useAutoRefresh';
import { CheckCircle2, FileDown, Gavel, RefreshCw } from 'lucide-react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Complaint } from '../../types/complaint';
import { RelatedCases, ResolutionOutcome } from '../../types/intelligence';
import { Section } from '../ui/Section';
import { Notice } from '../ui/Notice';
import { SkeletonRows } from '../ui/Skeleton';
import { formatDateTime } from '../../lib/format';

const OUTCOMES: Array<{ value: ResolutionOutcome; label: string }> = [
  { value: 'substantiated', label: 'Substantiated' },
  { value: 'partially_substantiated', label: 'Partially substantiated' },
  { value: 'not_substantiated', label: 'Not substantiated' },
  { value: 'resolved_informally', label: 'Resolved informally' }
];

interface CaseOutcomePanelProps {
  complaint: Complaint;
  onChanged: () => void;
}

/** Resolution with reform actions (Reflect & Reform) and the Legal Evidence Package export. */
export function CaseOutcomePanel({ complaint, onChanged }: CaseOutcomePanelProps) {
  const { currentUser } = useAuth();
  const [outcome, setOutcome] = useState<ResolutionOutcome>('substantiated');
  const [summary, setSummary] = useState('');
  const [actions, setActions] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<'export' | 'resolve' | null>(null);

  const canExport = ['assigned_investigator', 'hr_reviewer', 'independent_reviewer', 'administrator'].includes(currentUser.role);
  const canResolve = ['assigned_investigator', 'hr_reviewer', 'administrator'].includes(currentUser.role);

  useEffect(() => setMessage(null), [complaint.id, currentUser.id]);

  const exportPackage = async () => {
    setBusy('export');
    const res = await ApiService.downloadEvidencePackage(complaint.id);
    setBusy(null);
    setMessage(
      res.success
        ? { ok: true, text: `Evidence package ${res.data?.exportId} downloaded. The export is recorded in the Silent Audit.` }
        : { ok: false, text: res.error || 'Export failed' }
    );
  };

  const resolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy('resolve');
    const res = await ApiService.resolveCase(
      complaint.id,
      outcome,
      summary.trim(),
      actions.split(',').map((a) => a.trim()).filter(Boolean)
    );
    setBusy(null);
    if (res.success) {
      setMessage({ ok: true, text: 'Resolution recorded. The reporter can now give anonymous feedback.' });
      onChanged();
      refreshDashboard();
    } else {
      setMessage({ ok: false, text: res.error || 'Could not record the resolution' });
    }
  };

  const summaryTooShort = summary.trim().length < 15;

  return (
    <Section
      title="Outcome"
      description="Record the resolution and export the legal record."
    >
      <div className="space-y-4">
        {message && (
          <Notice tone={message.ok ? 'success' : 'danger'} role={message.ok ? 'status' : 'alert'}>
            {message.text}
          </Notice>
        )}

        {complaint.resolution ? (
          <div className="rounded-2xl bg-teal-50 p-4 text-[0.8125rem] text-teal-700">
            <p className="flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              {OUTCOMES.find((o) => o.value === complaint.resolution!.outcome)?.label ?? complaint.resolution.outcome}
            </p>
            <p className="mt-1.5 text-ink-soft">{complaint.resolution.summary}</p>
            {complaint.resolution.actions.length > 0 && (
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {complaint.resolution.actions.map((a) => (
                  <li key={a} className="chip bg-surface text-teal-700 ring-1 ring-teal-100">{a}</li>
                ))}
              </ul>
            )}
            <p className="mt-2.5 text-xs text-muted">Recorded {formatDateTime(complaint.resolution.at)}</p>
          </div>
        ) : canResolve && ApiService.isLive() ? (
          <form onSubmit={resolve} className="space-y-3">
            <label className="block">
              <span className="label">Outcome</span>
              <select className="field" value={outcome} onChange={(e) => setOutcome(e.target.value as ResolutionOutcome)}>
                {OUTCOMES.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">Findings summary</span>
              <textarea
                className="field min-h-[5.5rem] resize-y"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="Visible to staff only. The reporter sees the outcome and reform actions."
                aria-describedby="summary-hint"
              />
              <span id="summary-hint" className="mt-1 block text-xs text-muted">At least 15 characters.</span>
            </label>
            <label className="block">
              <span className="label">Reform actions</span>
              <input
                className="field"
                value={actions}
                onChange={(e) => setActions(e.target.value)}
                placeholder="Comma-separated, e.g. Manager coaching, Team norms workshop"
              />
            </label>
            <button type="submit" className="btn btn-primary w-full" disabled={busy !== null || summaryTooShort}>
              {busy === 'resolve' ? <RefreshCw className="animate-spin" /> : <Gavel />}
              {busy === 'resolve' ? 'Recording…' : 'Record resolution'}
            </button>
          </form>
        ) : (
          <p className="rounded-xl bg-sunken px-3 py-2.5 text-[0.8125rem] text-muted">
            {canResolve ? 'Recording a resolution needs the live backend.' : 'No resolution recorded yet. Your role cannot record one.'}
          </p>
        )}

        {canExport && (
          <div className="border-t border-line pt-4">
            <button className="btn btn-secondary w-full" onClick={exportPackage} disabled={busy !== null}>
              {busy === 'export' ? <RefreshCw className="animate-spin" /> : <FileDown />}
              {busy === 'export' ? 'Preparing PDF…' : 'Legal evidence package (PDF)'}
            </button>
            <p className="mt-1.5 text-center text-xs text-muted">Includes the audit trail so a third party can re-verify it.</p>
          </div>
        )}
      </div>
    </Section>
  );
}

/** Incident correlation + repeat-allegation cues for this case. Cues for review, never findings. */
export function RelatedCasesPanel({ complaintId, onOpenCase }: { complaintId: string; onOpenCase: (id: string) => void }) {
  const { currentUser } = useAuth();
  const [related, setRelated] = useState<RelatedCases | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'unavailable'>('loading');

  useAutoRefresh(async (isCurrent, initial) => {
    if (initial) { setState('loading'); setRelated(null); }
    const res = await ApiService.getRelatedCases(complaintId);
    if (!isCurrent()) return;
    setRelated(res.success ? res.data ?? null : null);
    setState(res.success ? 'ok' : 'unavailable');
  }, [complaintId, currentUser.id]);

  const similar = related?.similar ?? [];
  const repeatIds = related?.repeat.case_ids ?? [];

  return (
    <Section title="Related cases" description="Review cues only. Similar wording or a shared subject is not a finding.">
      {state === 'loading' ? (
        <SkeletonRows rows={2} label="Loading related cases" />
      ) : state === 'unavailable' ? (
        <p className="text-[0.8125rem] text-muted">Related-case analysis runs on the live backend.</p>
      ) : repeatIds.length === 0 && similar.length === 0 ? (
        <p className="text-[0.8125rem] text-muted">No shared subject or similar reports among cases you can access.</p>
      ) : (
        <ul className="space-y-1.5">
          {Array.from(new Set([...repeatIds, ...similar.map((x) => x.case_id)])).map((id) => {
            const sim = similar.find((x) => x.case_id === id);
            return (
              <li key={id}>
                <button
                  onClick={() => onOpenCase(id)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2 text-left transition-colors hover:border-brand-200 hover:bg-brand-50"
                >
                  <span className="case-id text-brand-700">{id}</span>
                  <span className="flex flex-wrap gap-1">
                    {repeatIds.includes(id) && <span className="chip bg-attn-50 text-attn-700">Same subject</span>}
                    {sim && <span className="chip bg-brand-50 text-brand-700 tabular">Similarity {sim.score.toFixed(2)}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
