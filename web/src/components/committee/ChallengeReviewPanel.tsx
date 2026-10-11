import { useState } from 'react';
import { CheckCircle2, Lock, RefreshCw, Scale, UserCheck, XCircle } from 'lucide-react';
import { CommitteeChallenge } from '../../types/committee';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { DEMO_USERS } from '../../types/auth';
import { Notice } from '../ui/Notice';
import { formatDateTime, shortHash } from '../../lib/format';
import { staffName } from '../../lib/people';

interface ChallengeReviewPanelProps {
  challenge: CommitteeChallenge;
  onDecisionApplied: () => void;
}

const CONFLICT_LABEL: Record<CommitteeChallenge['conflictCategory'], string> = {
  hierarchy_direct: 'Professional relationship',
  personal_relationship: 'Personal relationship',
  prior_retaliation_involvement: 'Prior involvement',
  departmental_bias: 'Other conflict'
};

const STATUS = {
  pending_independent_review: { label: 'Awaiting independent review', cls: 'bg-attn-50 text-attn-700' },
  approved_access_revoked: { label: 'Upheld · access revoked', cls: 'bg-teal-50 text-teal-700' },
  rejected_assignment_maintained: { label: 'Dismissed · member kept', cls: 'bg-sunken text-ink-soft' }
} as const;

export function ChallengeReviewPanel({ challenge, onDecisionApplied }: ChallengeReviewPanelProps) {
  const { currentUser, switchUser } = useAuth();
  const replacements = DEMO_USERS.filter((u) => u.role === 'committee_member' && u.id !== challenge.challengedMemberId);
  const [rationale, setRationale] = useState('');
  const [replacementId, setReplacementId] = useState(
    replacements.find((u) => u.id === 'usr_priya')?.id ?? replacements[0]?.id ?? ''
  );
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string; upheld?: boolean } | null>(null);

  // A challenged member never sees the particulars of a challenge against them.
  const isChallengedMember = currentUser.id === challenge.challengedMemberId;
  const isIndependentReviewer = currentUser.role === 'independent_reviewer' || currentUser.role === 'administrator';
  const isPending = challenge.status === 'pending_independent_review';
  const status = STATUS[challenge.status];

  if (isChallengedMember) {
    return (
      <article className="card card-pad text-center">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-sunken text-muted">
          <Lock className="h-5 w-5" />
        </span>
        <h3 className="mt-3 text-sm font-semibold text-ink">A challenge concerning you is under review</h3>
        <p className="mx-auto mt-1 max-w-md text-[0.8125rem] text-muted">
          Members cannot see the grounds, the reporter's messages, or the decision workflow for a challenge against
          themselves.
        </p>
      </article>
    );
  }

  const decide = async (decision: 'approve' | 'reject') => {
    setLoading(decision);
    setFeedback(null);
    try {
      const res = await ApiService.decideChallenge(challenge.id, decision, rationale, replacementId);
      if (res.success && res.data) {
        setFeedback({
          success: true,
          message:
            decision === 'approve'
              ? `Challenge upheld. ${challenge.challengedMemberName} no longer has access to ${challenge.complaintId}; ${staffName(replacementId)} takes the seat.`
              : `Challenge dismissed. ${challenge.challengedMemberName} stays on the committee.`,
          upheld: decision === 'approve'
        });
        onDecisionApplied();
      } else {
        setFeedback({ success: false, message: res.error || 'The decision could not be recorded' });
      }
    } catch (err: unknown) {
      setFeedback({ success: false, message: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(null);
    }
  };

  const rationaleShort = rationale.trim().length < 15;

  return (
    <article className="card card-pad animate-enter" aria-labelledby={`ch-${challenge.id}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-attn-50 text-attn-600">
            <Scale className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 id={`ch-${challenge.id}`} className="text-base font-semibold text-ink">
              Challenge to {challenge.challengedMemberName}
            </h3>
            <p className="mt-0.5 text-xs text-muted">
              <span className="case-id text-brand-700">{challenge.complaintId}</span> · {challenge.complaintTitle} · filed{' '}
              {formatDateTime(challenge.submittedAt)}
            </p>
          </div>
        </div>
        <span className={`chip self-start ${status.cls}`}>{status.label}</span>
      </div>

      <div className="mt-4 rounded-2xl bg-sunken p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className="font-semibold text-ink">{challenge.challengedMemberName}</span>
          <span className="text-muted">{challenge.challengedMemberRole}</span>
          <span className="chip bg-surface text-ink-soft ring-1 ring-line">{CONFLICT_LABEL[challenge.conflictCategory]}</span>
        </div>
        <p className="mt-2 text-[0.8125rem] font-semibold text-ink-soft">Grounds given by the reporter</p>
        <p className="mt-1 max-w-[72ch] text-[0.8125rem] leading-relaxed text-ink">{challenge.conflictDetails}</p>
      </div>

      {isPending ? (
        <div className="mt-4 space-y-4">
          {!isIndependentReviewer && (
            <Notice
              tone="locked"
              action={
                <button className="btn btn-secondary btn-sm" onClick={() => switchUser('usr_aris')}>
                  <UserCheck />
                  Switch to Dr. Aris Thorne
                </button>
              }
            >
              Only an independent reviewer can decide. You are viewing as {currentUser.name}.
            </Notice>
          )}

          <fieldset disabled={!isIndependentReviewer || loading !== null} className="space-y-4 disabled:opacity-70">
            <label className="block">
              <span className="label">Rationale</span>
              <textarea
                className="field min-h-[5.5rem] resize-y"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                placeholder="Explain why the conflict does or does not compromise neutrality. Recorded in the Silent Audit."
                aria-describedby={`rat-hint-${challenge.id}`}
              />
              <span id={`rat-hint-${challenge.id}`} className="mt-1 block text-xs text-muted">At least 15 characters.</span>
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <label className="block sm:w-64">
                <span className="label">Replacement if upheld</span>
                <select className="field" value={replacementId} onChange={(e) => setReplacementId(e.target.value)}>
                  {replacements.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button className="btn btn-secondary" onClick={() => decide('reject')} disabled={rationaleShort}>
                  {loading === 'reject' ? <RefreshCw className="animate-spin" /> : <XCircle />}
                  Dismiss challenge
                </button>
                <button className="btn btn-primary" onClick={() => decide('approve')} disabled={rationaleShort}>
                  {loading === 'approve' ? <RefreshCw className="animate-spin" /> : <CheckCircle2 />}
                  Uphold and revoke access
                </button>
              </div>
            </div>
          </fieldset>
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-line p-4 text-[0.8125rem]">
          <p className="font-semibold text-ink">Decision{challenge.decidedAt ? ` · ${formatDateTime(challenge.decidedAt)}` : ''}</p>
          {challenge.decisionRationale && <p className="mt-1 max-w-[72ch] text-ink-soft">{challenge.decisionRationale}</p>}
          {challenge.blockchainVerificationTx && (
            <p className="mt-2 truncate font-mono text-[0.6875rem] text-muted" title={challenge.blockchainVerificationTx}>
              Challenge proof tx {shortHash(challenge.blockchainVerificationTx, 12, 8)}
            </p>
          )}
        </div>
      )}

      {feedback && (
        <Notice tone={feedback.success ? 'success' : 'danger'} role={feedback.success ? 'status' : 'alert'} className="mt-4">
          {feedback.message}
          {feedback.upheld && (
            <span className="mt-1 block text-xs">
              To see enforcement, switch persona to {challenge.challengedMemberName} and open {challenge.complaintId}.
            </span>
          )}
        </Notice>
      )}
    </article>
  );
}
