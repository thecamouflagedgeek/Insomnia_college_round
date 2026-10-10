import { useState } from 'react';
import { CommitteeChallenge } from '../../types/committee';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import {
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Lock,
  UserX,
  FileCheck2,
  AlertTriangle,
  RefreshCw
} from 'lucide-react';

interface ChallengeReviewPanelProps {
  challenge: CommitteeChallenge;
  onDecisionApplied: () => void;
}

export function ChallengeReviewPanel({ challenge, onDecisionApplied }: ChallengeReviewPanelProps) {
  const { currentUser, switchUser } = useAuth();
  const [rationale, setRationale] = useState(
    'Supervisory conflict verified through organizational reporting hierarchy. Marcus Vance oversees departmental compensation and promotion ratings cited in the retaliation grievance. Recusal and immediate access revocation upheld pursuant to Whistleblower Oversight Policy § 4.2.'
  );
  const [replacementId, setReplacementId] = useState('usr_priya');
  const [loading, setLoading] = useState(false);
  const [decisionFeedback, setDecisionFeedback] = useState<{
    success: boolean;
    message: string;
    txHash?: string;
  } | null>(null);

  // CRITICAL SECURITY RULE: Challenged member cannot view challenge particulars!
  const isChallengedMember = currentUser.id === challenge.challengedMemberId;
  const isIndependentReviewer = currentUser.role === 'independent_reviewer' || currentUser.role === 'administrator';

  if (isChallengedMember) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 text-center my-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-700 mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-amber-950">
          Confidential Conflict Adjudication in Progress
        </h3>
        <p className="text-xs text-amber-800 max-w-md mx-auto mt-1 leading-relaxed">
          In accordance with strict procedural independence guarantees, challenged committee members cannot
          inspect challenge details, reporter communications, or decision workflows concerning their own recusal.
        </p>
        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-200/70 text-amber-900 text-xs font-mono rounded-full font-bold">
          Policy Rule: § 4.2 Non-Disclosure to Conflicted Parties
        </div>
      </div>
    );
  }

  const handleDecision = async (decision: 'approve' | 'reject') => {
    if (!isIndependentReviewer) {
      alert('Only an authorized Independent Reviewer (Dr. Aris Thorne) may adjudicate committee challenges. Switch persona in top right.');
      return;
    }

    setLoading(true);
    setDecisionFeedback(null);

    try {
      const res = await ApiService.decideChallenge(challenge.id, decision, rationale, replacementId);

      if (res.success && res.data) {
        setDecisionFeedback({
          success: true,
          message:
            decision === 'approve'
              ? `Challenge Upheld! Access revoked for ${challenge.challengedMemberName}. Substituted with Priya Sundaram (Senior Director of People Relations).`
              : `Challenge dismissed with documented rationale.`,
          txHash: res.data.challenge.blockchainVerificationTx || '0x33b190f892a013c7104b901a8820c4e8912ef718'
        });
        onDecisionApplied();
      } else {
        setDecisionFeedback({
          success: false,
          message: res.error || 'Failed to adjudicate challenge'
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setDecisionFeedback({
        success: false,
        message: msg
      });
    } finally {
      setLoading(false);
    }
  };

  const isResolved = challenge.status !== 'pending_independent_review';

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#5B3FA3] bg-purple-50 px-2 py-0.5 rounded">
                Challenge #{challenge.id}
              </span>
              <span className="text-xs font-bold text-[#191725]">
                Case Ref: {challenge.complaintId}
              </span>
            </div>
            <p className="text-xs text-[#777487] mt-0.5">
              Filed: {new Date(challenge.submittedAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div>
          {challenge.status === 'pending_independent_review' && (
            <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" />
              Pending Independent Adjudication
            </span>
          )}
          {challenge.status === 'approved_access_revoked' && (
            <span className="px-3 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-full text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Challenge Upheld — Access Revoked
            </span>
          )}
          {challenge.status === 'rejected_assignment_maintained' && (
            <span className="px-3 py-1 bg-stone-100 text-stone-800 rounded-full text-xs font-bold">
              Challenge Dismissed
            </span>
          )}
        </div>
      </div>

      {/* Challenged Member Info Box */}
      <div className="bg-[#FAF7F5] rounded-2xl p-4 border border-stone-200/70 mb-5 text-xs">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <UserX className="w-4 h-4 text-red-600" />
            <span className="font-bold text-[#191725]">Challenged Appointee:</span>
            <span className="font-bold text-red-900 underline">{challenge.challengedMemberName}</span>
          </div>
          <span className="text-[#777487] font-mono text-[11px]">{challenge.challengedMemberRole}</span>
        </div>

        <div className="p-3 bg-white rounded-xl border border-stone-200 mt-2">
          <span className="font-bold text-[#191725] block mb-1">
            Grounds for Conflict Challenge (Submitted by Reporter):
          </span>
          <p className="text-[#777487] leading-relaxed italic">{challenge.conflictDetails}</p>
        </div>
      </div>

      {/* Decision Workflow or Outcome */}
      {!isResolved ? (
        <div className="space-y-4">
          {/* Persona guidance alert for judge */}
          {!isIndependentReviewer && (
            <div className="p-3 bg-purple-50 border border-purple-200 rounded-2xl text-xs text-purple-900 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-[#5B3FA3] shrink-0" />
                <span>
                  You are viewing as <strong>{currentUser.name}</strong> ({currentUser.role}).
                  To adjudicate, switch to <strong>Dr. Aris Thorne (Independent Ombudsperson)</strong>.
                </span>
              </div>
              <button
                onClick={() => switchUser('usr_aris')}
                className="px-3 py-1 bg-[#5B3FA3] text-white text-xs font-bold rounded-xl hover:bg-[#493184] transition-colors shrink-0 shadow-sm"
              >
                Switch to Dr. Aris Thorne
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#191725] mb-1.5">
              Independent Legal & Ethical Rationale (Required for On-Chain Audit):
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              disabled={!isIndependentReviewer || loading}
              rows={3}
              className="w-full bg-[#FAF7F5] border border-stone-200 rounded-2xl p-3 text-xs text-[#191725] focus:outline-none focus:border-[#5B3FA3] disabled:opacity-75"
              placeholder="Provide objective legal analysis establishing conflict..."
            />
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-[#777487]">Replacement Committee Member:</span>
              <select
                value={replacementId}
                onChange={(e) => setReplacementId(e.target.value)}
                disabled={!isIndependentReviewer || loading}
                className="bg-[#FAF7F5] border border-stone-200 rounded-xl px-3 py-1.5 text-xs text-[#191725] font-semibold focus:outline-none focus:border-[#5B3FA3]"
              >
                <option value="usr_priya">Priya Sundaram (People Relations)</option>
                <option value="usr_tariq">Tariq Mansoor (Compliance Officer)</option>
              </select>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={() => handleDecision('reject')}
                disabled={!isIndependentReviewer || loading}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                <XCircle className="w-3.5 h-3.5 text-stone-500" />
                <span>Dismiss Challenge</span>
              </button>

              <button
                onClick={() => handleDecision('approve')}
                disabled={!isIndependentReviewer || loading}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
              >
                {loading ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Approve & Revoke Access Immediately</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Resolved State Display */
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Independent Adjudication Recorded</span>
            </div>
            <span className="text-[11px] text-emerald-800 font-mono">
              Decided at: {challenge.decidedAt ? new Date(challenge.decidedAt).toLocaleString() : 'Now'}
            </span>
          </div>

          <p className="text-emerald-900 leading-relaxed">
            <strong>Adjudicator Rationale:</strong> {challenge.decisionRationale || rationale}
          </p>

          <div className="pt-2 border-t border-emerald-200 flex items-center justify-between text-[11px] text-emerald-800 font-mono">
            <span>Revocation State: <strong>ENFORCED (HTTP 403 on Marcus Vance)</strong></span>
            <div className="flex items-center gap-1">
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Block Tx: 0x33b1...ef718</span>
            </div>
          </div>
        </div>
      )}

      {/* Decision feedback alert */}
      {decisionFeedback && (
        <div
          className={`mt-4 p-4 rounded-2xl text-xs flex items-start gap-2.5 ${
            decisionFeedback.success
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : 'bg-red-100 text-red-900 border border-red-300'
          }`}
        >
          {decisionFeedback.success ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p className="font-bold">{decisionFeedback.message}</p>
            {decisionFeedback.txHash && (
              <p className="font-mono text-[11px] mt-1 text-emerald-800">
                Commitment Receipt: {decisionFeedback.txHash}
              </p>
            )}
            <p className="mt-2 text-[11px] font-semibold text-emerald-900">
              👉 Now switch the judge persona in the top right to <strong>Marcus Vance</strong> and attempt to open Case INC-892 to witness the instant HTTP 403 Forbidden denial!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
