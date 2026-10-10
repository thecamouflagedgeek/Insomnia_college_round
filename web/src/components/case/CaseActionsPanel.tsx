import { useEffect, useState } from 'react';
import { FileDown, GitCompareArrows, Gavel, CheckCircle2, AlertCircle } from 'lucide-react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Complaint } from '../../types/complaint';
import { RelatedCases, ResolutionOutcome } from '../../types/intelligence';

const OUTCOMES: Array<{ value: ResolutionOutcome; label: string }> = [
  { value: 'substantiated', label: 'Substantiated' },
  { value: 'partially_substantiated', label: 'Partially substantiated' },
  { value: 'not_substantiated', label: 'Not substantiated' },
  { value: 'resolved_informally', label: 'Resolved informally' }
];

interface CaseActionsPanelProps {
  complaint: Complaint;
  onChanged: () => void;
  onOpenCase: (caseId: string) => void;
}

/** Legal Evidence Package, related cases (M3 correlation + repeat allegations) and resolution with reform actions. */
export function CaseActionsPanel({ complaint, onChanged, onOpenCase }: CaseActionsPanelProps) {
  const { currentUser } = useAuth();
  const [related, setRelated] = useState<RelatedCases | null>(null);
  const [outcome, setOutcome] = useState<ResolutionOutcome>('substantiated');
  const [summary, setSummary] = useState('');
  const [actions, setActions] = useState('');
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const canExport = ['assigned_investigator', 'hr_reviewer', 'independent_reviewer', 'administrator'].includes(currentUser.role);
  const canResolve = ['assigned_investigator', 'hr_reviewer', 'administrator'].includes(currentUser.role);

  useEffect(() => {
    ApiService.getRelatedCases(complaint.id).then((res) => setRelated(res.success ? res.data ?? null : null));
  }, [complaint.id, currentUser.id]);

  const exportPackage = async () => {
    setBusy(true);
    const res = await ApiService.downloadEvidencePackage(complaint.id);
    setBusy(false);
    setMessage(
      res.success
        ? { ok: true, text: `Evidence package ${res.data?.exportId} downloaded and recorded in the Silent Audit.` }
        : { ok: false, text: res.error || 'Export failed' }
    );
  };

  const resolve = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = await ApiService.resolveCase(
      complaint.id,
      outcome,
      summary.trim(),
      actions.split(',').map((a) => a.trim()).filter(Boolean)
    );
    setBusy(false);
    if (res.success) {
      setMessage({ ok: true, text: 'Resolution recorded and sealed. The reporter can now give anonymous feedback.' });
      onChanged();
    } else {
      setMessage({ ok: false, text: res.error || 'Could not record the resolution' });
    }
  };

  const similar = related?.similar ?? [];
  const repeatIds = related?.repeat.case_ids ?? [];

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-base font-bold text-[#191725]">Case outcome & legal record</h3>
        {canExport && (
          <button
            onClick={exportPackage}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#5B3FA3] hover:bg-[#493184] text-white text-xs font-bold rounded-2xl disabled:opacity-50"
          >
            <FileDown className="w-4 h-4" />
            Legal Evidence Package (PDF)
          </button>
        )}
      </div>

      {message && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-center gap-2 border ${
            message.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {message.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {message.text}
        </div>
      )}

      {related && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#191725]">
            <GitCompareArrows className="w-4 h-4 text-[#5B3FA3]" /> Related cases (review cues, not findings)
          </div>
          {repeatIds.length === 0 && similar.length === 0 ? (
            <p className="text-xs text-[#777487]">No repeat subject or similar reports among cases you can access.</p>
          ) : (
            <div className="flex flex-wrap gap-2 text-xs">
              {repeatIds.map((id) => (
                <button key={`r-${id}`} onClick={() => onOpenCase(id)}
                  className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-mono font-bold">
                  {id} · same subject
                </button>
              ))}
              {similar.map((s) => (
                <button key={`s-${s.case_id}`} onClick={() => onOpenCase(s.case_id)}
                  className="px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200 text-[#5B3FA3] font-mono font-bold">
                  {s.case_id} · similarity {s.score.toFixed(2)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {complaint.resolution ? (
        <div className="p-4 bg-[#FAF7F5] rounded-2xl border border-stone-200 text-xs space-y-1">
          <div className="font-bold text-[#191725] flex items-center gap-2">
            <Gavel className="w-4 h-4 text-[#5B3FA3]" />
            Resolved: {complaint.resolution.outcome.replace(/_/g, ' ')}
          </div>
          <p className="text-[#191725]">{complaint.resolution.summary}</p>
          {complaint.resolution.actions.length > 0 && (
            <p className="text-[#777487]">Reform actions: {complaint.resolution.actions.join(' · ')}</p>
          )}
        </div>
      ) : canResolve && ApiService.isLive() ? (
        <form onSubmit={resolve} className="space-y-3 pt-2 border-t border-stone-100">
          <label className="block text-xs font-bold text-[#191725]">Record resolution (Reflect & Reform)</label>
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as ResolutionOutcome)}
            className="w-full bg-[#FAF7F5] border border-stone-200 rounded-2xl px-3 py-2 text-xs"
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Findings summary (HR-only; the reporter sees the outcome and reform actions)"
            className="w-full bg-[#FAF7F5] border border-stone-200 rounded-2xl px-3 py-2 text-xs min-h-[70px]"
          />
          <input
            value={actions}
            onChange={(e) => setActions(e.target.value)}
            placeholder="Reform actions, comma-separated (e.g. Manager coaching, Team norms workshop)"
            className="w-full bg-[#FAF7F5] border border-stone-200 rounded-2xl px-3 py-2 text-xs"
          />
          <button
            type="submit"
            disabled={busy || summary.trim().length < 15}
            className="px-4 py-2 bg-[#191725] text-white text-xs font-bold rounded-2xl disabled:opacity-40"
          >
            Record resolution
          </button>
        </form>
      ) : null}
    </div>
  );
}
