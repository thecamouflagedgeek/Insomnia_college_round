import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useState } from 'react';
import { CheckCircle2, Clock, Copy, Check, Lock, RefreshCw, Send, UserRound, Users, XCircle } from 'lucide-react';
import { WitnessInvitation, WitnessQuorumSummary } from '../../types/witness';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Section } from '../ui/Section';
import { Notice } from '../ui/Notice';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonRows } from '../ui/Skeleton';
import { formatDate } from '../../lib/format';
import { ShareIncidentDetailsCard } from './ShareIncidentDetailsCard';

interface WitnessQuorumPanelProps {
  complaintId: string;
}

const STATUS: Record<WitnessInvitation['status'], { label: string; cls: string; icon: React.ReactNode }> = {
  accepted: { label: 'Participating', cls: 'bg-teal-50 text-teal-700', icon: <CheckCircle2 className="h-3 w-3" /> },
  declined: { label: 'Declined', cls: 'bg-sunken text-muted', icon: <XCircle className="h-3 w-3" /> },
  pending: { label: 'Awaiting reply', cls: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200', icon: <Clock className="h-3 w-3" /> }
};

export function WitnessQuorumPanel({ complaintId }: WitnessQuorumPanelProps) {
  const { currentUser } = useAuth();
  const [invitations, setInvitations] = useState<WitnessInvitation[] | null>(null);
  const [summary, setSummary] = useState<WitnessQuorumSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newAlias, setNewAlias] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<{ alias: string; code: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const isAssignedInvestigator = currentUser.role === 'assigned_investigator' || currentUser.role === 'administrator';

  const loadData = async (isCurrent = () => true) => {
    setError(null);
    const [invRes, sumRes] = await Promise.all([
      ApiService.getWitnessInvitations(complaintId),
      ApiService.getWitnessQuorumSummary(complaintId)
    ]);
    if (!isCurrent()) return;
    if (invRes.success && invRes.data) setInvitations(invRes.data);
    else {
      setInvitations([]);
      setError(invRes.error || 'Witness records unavailable');
    }
    setSummary(sumRes.success && sumRes.data ? sumRes.data : null);
  };

  useAutoRefresh((isCurrent, initial) => {
    if (initial) { setIssuedCode(null); setInviteError(null); setInvitations(null); setSummary(null); setNewAlias(''); }
    return loadData(isCurrent);
  }, [complaintId, currentUser.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlias.trim()) return;
    setIsSubmitting(true);
    setInviteError(null);
    const res = await ApiService.inviteWitness(complaintId, newAlias);
    if (res.success && res.data) {
      if (res.data.witnessCode) setIssuedCode({ alias: res.data.anonymousAlias, code: res.data.witnessCode });
      setNewAlias('');
    } else {
      setInviteError(res.error || 'The invitation could not be issued');
    }
    setIsSubmitting(false);
    await loadData();
  };

  const copyCode = async () => {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(issuedCode.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the code stays selectable */
    }
  };

  const stats = summary
    ? [
        { label: 'Invited', value: summary.totalInvited },
        { label: 'Participating', value: isAssignedInvestigator ? summary.accepted : null },
        { label: 'Statements', value: summary.statementsSubmitted },
        { label: 'Awaiting reply', value: isAssignedInvestigator ? summary.pending : null }
      ]
    : null;

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted">Give each witness their private code to enter in the employee app. Responses update automatically. Push notifications and statement collection are not connected; participation is not proof of misconduct.</p>
      <Section
        icon={<Users />}
        title="Witness quorum"
        description="Voluntary witness participation. Not responding is never treated as evidence either way."
        action={
          summary?.quorumMet ? (
            <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Participation quorum reached
            </span>
          ) : !isAssignedInvestigator ? (
            <span className="chip bg-sunken text-muted" title="Participation details are visible to the assigned investigator only">
              <Lock className="h-3.5 w-3.5" />
              Partly redacted
            </span>
          ) : null
        }
      >
      <div className="space-y-5">
        {stats && (
          <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="rounded-2xl bg-sunken px-4 py-3">
                <dt className="text-xs font-medium text-muted">{s.label}</dt>
                <dd className="mt-1 text-2xl font-bold text-ink tabular">
                  {s.value === null ? (
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted" title="Visible to the assigned investigator only">
                      <Lock className="h-3.5 w-3.5" />
                      Hidden
                    </span>
                  ) : (
                    s.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div>
          <h3 className="mb-2 text-xs font-semibold text-ink-soft">Invitations</h3>
          {invitations === null ? (
            <SkeletonRows rows={2} label="Loading invitations" />
          ) : error ? (
            <Notice tone="locked">{error}</Notice>
          ) : invitations.length === 0 ? (
            <EmptyState compact icon={<UserRound />} title="No witnesses invited" description="Invitations issued by the assigned investigator appear here." />
          ) : (
            <ul className="stagger divide-y divide-line/70 rounded-2xl border border-line">
              {invitations.map((w) => {
                const st = STATUS[w.status] ?? STATUS.pending;
                return (
                  <li key={w.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[0.8125rem] font-semibold text-ink">{w.anonymousAlias}</p>
                        <p className="text-xs text-muted">
                          Invited {formatDate(w.invitedAt)}
                          {w.respondedAt && ` · replied ${formatDate(w.respondedAt)}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pl-11 sm:pl-0">
                      {w.statementProvided && (
                        <span className="chip bg-brand-50 text-brand-700 tabular">
                          Statement{w.statementLengthWords ? ` · ${w.statementLengthWords} words` : ''}
                        </span>
                      )}
                      <span className={`chip ${st.cls}`}>
                        {st.icon}
                        {st.label}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {isAssignedInvestigator ? (
          <form onSubmit={handleInvite} className="border-t border-line pt-4">
            <label htmlFor={`alias-${complaintId}`} className="label">Invite a witness</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={`alias-${complaintId}`}
                className="field flex-1"
                value={newAlias}
                onChange={(e) => setNewAlias(e.target.value)}
                maxLength={80}
                placeholder="Alias only, e.g. Witness Epsilon (colleague)"
              />
              <button type="submit" className="btn btn-primary" disabled={isSubmitting || !newAlias.trim()}>
                {isSubmitting ? <RefreshCw className="animate-spin" /> : <Send />}
                {isSubmitting ? 'Issuing…' : 'Issue invite'}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-muted">Use an alias. Never type a witness's real name here.</p>
            {inviteError && <Notice tone="danger" role="alert" className="mt-3">{inviteError}</Notice>}
            {issuedCode && (
              <div role="status" className="mt-3 animate-enter rounded-2xl border border-teal-100 bg-teal-50 p-4 text-[0.8125rem] text-teal-700">
                <p className="font-semibold">Witness code for {issuedCode.alias}</p>
                <div className="mt-2 flex items-center gap-2">
                  <code className="select-all rounded-lg bg-surface px-3 py-1.5 font-mono text-sm font-semibold text-ink ring-1 ring-teal-100">
                    {issuedCode.code}
                  </code>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={copyCode}>
                    {copied ? <Check /> : <Copy />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="mt-2 text-xs text-ink-soft">Shown once. Give it to the witness privately; they enter it in the INCOGNITO app.</p>
              </div>
            )}
          </form>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl border border-purple-200 bg-[#fbf9fe] p-3 text-xs text-purple-900">
            <Lock className="h-4 w-4 shrink-0 text-purple-700" />
            <span>Only the assigned investigator can issue witness invitations.</span>
          </div>
        )}
      </div>
    </Section>

    {/* Share Incident Details card */}
    <ShareIncidentDetailsCard complaintId={complaintId} onSubmitted={loadData} />
    </div>
  );
}
