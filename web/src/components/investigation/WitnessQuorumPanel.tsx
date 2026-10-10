import { useState, useEffect } from 'react';
import { WitnessInvitation, WitnessQuorumSummary } from '../../types/witness';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import {
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  ShieldCheck,
  Send,
  AlertCircle,
  Lock,
  UserCheck
} from 'lucide-react';

interface WitnessQuorumPanelProps {
  complaintId: string;
}

export function WitnessQuorumPanel({ complaintId }: WitnessQuorumPanelProps) {
  const { currentUser } = useAuth();
  const [invitations, setInvitations] = useState<WitnessInvitation[]>([]);
  const [summary, setSummary] = useState<WitnessQuorumSummary | null>(null);
  const [newAlias, setNewAlias] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAssignedInvestigator =
    currentUser.role === 'assigned_investigator' || currentUser.role === 'administrator';

  const loadData = async () => {
    const [invRes, sumRes] = await Promise.all([
      ApiService.getWitnessInvitations(complaintId),
      ApiService.getWitnessQuorumSummary(complaintId)
    ]);
    if (invRes.data) setInvitations(invRes.data);
    if (sumRes.data) setSummary(sumRes.data);
  };

  useEffect(() => {
    loadData();
  }, [complaintId, currentUser.id]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlias.trim()) return;

    setIsSubmitting(true);
    await ApiService.inviteWitness(complaintId, newAlias);
    setNewAlias('');
    setIsSubmitting(false);
    await loadData();
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-stone-100 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-[#5B3FA3]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-[#191725]">Witness Quorum Engine</h3>
              {summary?.quorumMet && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                  Voluntary Quorum Reached (2+ Corroborating Statements)
                </span>
              )}
            </div>
            <p className="text-xs text-[#777487]">
              Case {complaintId} • Blinded voluntary corroboration without identity compromise
            </p>
          </div>
        </div>

        {/* Investigator Privilege Badge */}
        <div>
          {isAssignedInvestigator ? (
            <span className="px-3 py-1 bg-purple-100 text-[#5B3FA3] text-xs font-bold rounded-full flex items-center gap-1.5 border border-purple-200">
              <UserCheck className="w-3.5 h-3.5" />
              Investigator Full Privilege
            </span>
          ) : (
            <span className="px-3 py-1 bg-stone-100 text-stone-700 text-xs font-bold rounded-full flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Redacted (Investigator-Only Detail)
            </span>
          )}
        </div>
      </div>

      {/* Quorum Stats Bar */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-4 bg-[#FAF7F5] rounded-2xl border border-stone-200/70">
            <span className="text-[11px] font-medium text-[#777487]">Invitations Issued</span>
            <p className="text-2xl font-bold text-[#191725] mt-1">{summary.totalInvited}</p>
          </div>
          <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200">
            <span className="text-[11px] font-medium text-emerald-800">Accepted</span>
            <p className="text-2xl font-bold text-emerald-900 mt-1">
              {isAssignedInvestigator ? summary.accepted : '***'}
            </p>
          </div>
          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200">
            <span className="text-[11px] font-medium text-amber-800">Statements Recorded</span>
            <p className="text-2xl font-bold text-amber-900 mt-1">{summary.statementsSubmitted}</p>
          </div>
          <div className="p-4 bg-purple-50/60 rounded-2xl border border-purple-200">
            <span className="text-[11px] font-medium text-[#5B3FA3]">Pending Responses</span>
            <p className="text-2xl font-bold text-[#5B3FA3] mt-1">
              {isAssignedInvestigator ? summary.pending : '***'}
            </p>
          </div>
        </div>
      )}

      {/* Witness Roster */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-[#191725] uppercase tracking-wider">
          Invited Witness Participation Log
        </h4>

        {invitations.map((w) => (
          <div
            key={w.id}
            className="p-4 rounded-2xl bg-[#FAF7F5] border border-stone-200/70 flex items-center justify-between text-xs"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-[#5B3FA3]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-[#191725]">{w.anonymousAlias}</p>
                <p className="text-[10px] text-[#777487]">
                  Invited: {new Date(w.invitedAt).toLocaleDateString()}
                  {w.respondedAt && ` • Responded: ${new Date(w.respondedAt).toLocaleDateString()}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {w.statementProvided && (
                <span className="px-2 py-0.5 rounded-full bg-purple-100 text-[#5B3FA3] text-[10px] font-bold border border-purple-200">
                  {w.statementLengthWords} Words Sealed
                </span>
              )}

              {w.status === 'accepted' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  <CheckCircle2 className="w-3 h-3" />
                  Participation Confirmed
                </span>
              ) : w.status === 'declined' ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">
                  <XCircle className="w-3 h-3" />
                  Declined Voluntarily
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-stone-200 text-stone-700 text-[11px] font-bold">
                  <Clock className="w-3 h-3" />
                  Awaiting Response
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Invite Form (Investigator Only) */}
      {isAssignedInvestigator ? (
        <form onSubmit={handleInvite} className="pt-2 border-t border-stone-100">
          <label className="block text-xs font-bold text-[#191725] mb-2">
            Issue Confidential Voluntary Invitation
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value)}
              placeholder="e.g. Witness Epsilon (Procurement Lead / Colleague)"
              className="flex-1 bg-[#FAF7F5] border border-stone-200 rounded-2xl px-4 py-2.5 text-xs text-[#191725] focus:outline-none focus:border-[#5B3FA3]"
            />
            <button
              type="submit"
              disabled={isSubmitting || !newAlias.trim()}
              className="px-5 py-2.5 bg-[#5B3FA3] hover:bg-[#493184] text-white text-xs font-bold rounded-2xl transition-all shadow-sm flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5 text-[#FFD08A]" />
              <span>Issue Invite</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="p-3 bg-stone-100 rounded-2xl text-[11px] text-[#777487] flex items-center gap-2">
          <Lock className="w-4 h-4 text-stone-500" />
          <span>
            Only the assigned investigator (Elena Rostova) can issue new witness invitations.
          </span>
        </div>
      )}

      {/* Ethical Principle Banner */}
      <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-2xl text-[11px] text-purple-900 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-[#5B3FA3] shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Procedural Safeguard: </span>
          Witness participation is strictly voluntary and protected under Whistleblower Non-Retaliation Policy.
          Witness presence or non-response is never considered proof of allegation validity.
        </div>
      </div>
    </div>
  );
}
