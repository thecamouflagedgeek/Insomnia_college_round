import { useState, useEffect } from 'react';
import {
  CommitteePoolId,
  COMMITTEE_POOLS,
  CommitteeMemberRecord,
  CommitteeChallenge
} from '../types/committee';
import { ApiService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { ChallengeReviewPanel } from '../components/committee/ChallengeReviewPanel';
import {
  Users,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Lock,
  Layers,
  ChevronDown,
  Info,
  Clock,
  Sparkles
} from 'lucide-react';

interface CommitteeManagementProps {
  initialPoolId?: CommitteePoolId;
}

export function CommitteeManagement({ initialPoolId = 'whistleblowing_ethics' }: CommitteeManagementProps) {
  const { currentUser, switchUser } = useAuth();
  const [selectedPoolId, setSelectedPoolId] = useState<CommitteePoolId>(initialPoolId);
  const [members, setMembers] = useState<CommitteeMemberRecord[]>([]);
  const [challenges, setChallenges] = useState<CommitteeChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedChallengeToReview, setSelectedChallengeToReview] = useState<CommitteeChallenge | null>(null);
  const [reassignModalMember, setReassignModalMember] = useState<CommitteeMemberRecord | null>(null);

  const selectedPoolInfo =
    COMMITTEE_POOLS.find((p) => p.id === selectedPoolId) || COMMITTEE_POOLS[0];

  const loadPoolData = async () => {
    setLoading(true);
    const [membersRes, challengesRes] = await Promise.all([
      ApiService.getCommitteePool(selectedPoolId),
      ApiService.getChallenges(selectedPoolId)
    ]);

    if (membersRes.data) setMembers(membersRes.data);
    if (challengesRes.data) {
      setChallenges(challengesRes.data);
      // Auto-select challenge if available and none selected
      const pending = challengesRes.data.find((c) => c.status === 'pending_independent_review');
      setSelectedChallengeToReview(pending || challengesRes.data[0] || null);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadPoolData();
  }, [selectedPoolId, currentUser.id]);

  const pendingChallenges = challenges.filter(
    (c) => c.status === 'pending_independent_review'
  );

  const isIndependentReviewer =
    currentUser.role === 'independent_reviewer' || currentUser.role === 'administrator';
  const isHRReviewer =
    currentUser.role === 'hr_reviewer' || currentUser.role === 'administrator';

  const getStatusBadge = (status: CommitteeMemberRecord['assignmentStatus']) => {
    switch (status) {
      case 'active_assigned':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-100 text-[#5B3FA3] text-[10px] font-bold border border-purple-200">
            <UserCheck className="w-3 h-3" />
            Active Assignment
          </span>
        );
      case 'challenged':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            Conflict Challenged
          </span>
        );
      case 'recused_conflict':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-900 text-[10px] font-bold border border-red-300">
            <UserX className="w-3 h-3 text-red-600" />
            Recused & Revoked
          </span>
        );
      case 'available':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Available / Eligible
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#191725]">Committee Management</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-[#5B3FA3] font-bold">
              Integrated Pool & Challenge Workspace
            </span>
          </div>
          <p className="text-xs text-[#777487] mt-1">
            Oversee statutory committee pools, verify conflict eligibility, and adjudicate independent challenges
          </p>
        </div>

        {/* Demo Persona Assistance */}
        {!isIndependentReviewer && pendingChallenges.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#777487]">Adjudication Demo:</span>
            <button
              onClick={() => switchUser('usr_aris')}
              className="px-3 py-1.5 bg-[#5B3FA3] hover:bg-[#493184] text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center gap-1.5"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#FFD08A]" />
              <span>Switch to Dr. Aris Thorne</span>
            </button>
          </div>
        )}
      </div>

      {/* A. Committee Pool Selector Bar */}
      <div className="bg-white rounded-3xl p-5 border border-stone-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-[#5B3FA3] shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-[#777487] uppercase tracking-wider block">
              Active Committee Pool
            </label>
            <div className="relative inline-block mt-0.5">
              <select
                value={selectedPoolId}
                onChange={(e) => setSelectedPoolId(e.target.value as CommitteePoolId)}
                className="appearance-none bg-[#FAF7F5] border border-stone-200/90 hover:border-[#5B3FA3] text-sm font-bold text-[#191725] rounded-2xl pl-3.5 pr-9 py-2 focus:outline-none focus:border-[#5B3FA3] cursor-pointer transition-colors shadow-inner"
              >
                {COMMITTEE_POOLS.map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-[#777487] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        <div className="md:text-right border-t md:border-t-0 pt-3 md:pt-0 border-stone-100">
          <p className="text-xs font-semibold text-[#191725]">{selectedPoolInfo.statutoryMandate}</p>
          <p className="text-[11px] text-[#777487] max-w-md mt-0.5 leading-snug">
            {selectedPoolInfo.description}
          </p>
        </div>
      </div>

      {/* C. Pending Challenge Notice Banner (When challenges are pending in this pool) */}
      {pendingChallenges.length > 0 ? (
        <div className="bg-amber-50/90 border border-amber-300 rounded-3xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-950">
                  Action Required: {pendingChallenges.length} committee challenge{pendingChallenges.length > 1 ? 's' : ''} pending independent review in {selectedPoolInfo.name}
                </span>
                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                  Case Ref: {pendingChallenges[0].complaintId}
                </span>
              </div>
              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                Challenged appointee: <strong>{pendingChallenges[0].challengedMemberName}</strong>. 
                Procedural neutrality requires independent adjudication before investigation findings can proceed.
              </p>
            </div>
          </div>

          <a
            href="#challenge-workflow-section"
            className="px-4 py-2.5 bg-[#5B3FA3] hover:bg-[#493184] text-white text-xs font-bold rounded-2xl transition-all shadow-sm shrink-0 text-center"
          >
            Jump to Adjudication ↓
          </a>
        </div>
      ) : (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-3xl p-4 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Clean Pool Status:</strong> No pending conflict challenges in the{' '}
              <strong>{selectedPoolInfo.name}</strong> pool. All appointee disclosures are verified.
            </span>
          </div>
          <span className="text-[10px] font-mono font-bold text-emerald-700 bg-emerald-100 px-2.5 py-1 rounded-full">
            Integrity Cleared
          </span>
        </div>
      )}

      {/* B. Committee Assignment Section */}
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-stone-100 gap-2">
          <div>
            <h2 className="text-base font-bold text-[#191725]">
              {selectedPoolInfo.name} — Committee Roster
            </h2>
            <p className="text-xs text-[#777487]">
              Pre-vetted adjudicators • Workload distribution • Supervisory conflict declarations
            </p>
          </div>

          <span className="text-xs px-3 py-1 bg-purple-50 text-[#5B3FA3] font-bold rounded-full border border-purple-200 self-start sm:self-auto">
            {members.length} Evaluated Members
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-[#777487]">
            Loading committee roster for {selectedPoolInfo.name}...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map((member) => {
              const isChallenged = member.assignmentStatus === 'challenged';
              const isRecused = member.assignmentStatus === 'recused_conflict';

              return (
                <div
                  key={member.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isChallenged
                      ? 'bg-amber-50/50 border-amber-300 shadow-sm'
                      : isRecused
                      ? 'bg-red-50/40 border-red-200 opacity-75'
                      : 'bg-[#FAF7F5] border-stone-200/80 hover:border-[#5B3FA3]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-[#191725]">{member.name}</h3>
                        {member.conflictRiskLevel === 'high' ? (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                            <ShieldAlert className="w-2.5 h-2.5" />
                            High Conflict Risk
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Cleared
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-[#777487] mt-0.5">{member.roleTitle}</p>
                      <p className="text-[10px] text-stone-500 font-mono">{member.department}</p>
                    </div>

                    <div>{getStatusBadge(member.assignmentStatus)}</div>
                  </div>

                  {/* Case Assignments & Actions */}
                  <div className="mt-3 pt-3 border-t border-stone-200/60 flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[#777487] text-[11px]">Assigned Cases: </span>
                      {member.assignedCaseIds.length > 0 ? (
                        <span className="font-mono font-bold text-[#5B3FA3]">
                          {member.assignedCaseIds.join(', ')}
                        </span>
                      ) : (
                        <span className="text-[#777487] italic text-[11px]">None (Pool Reserve)</span>
                      )}
                    </div>

                    {/* Action Button */}
                    <div>
                      {isChallenged ? (
                        <button
                          onClick={() => {
                            const ch = challenges.find((c) => c.challengedMemberId === member.id);
                            if (ch) setSelectedChallengeToReview(ch);
                          }}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-bold rounded-xl transition-all shadow-sm flex items-center gap-1"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          <span>Review Challenge</span>
                        </button>
                      ) : isRecused ? (
                        <span className="text-[11px] font-bold text-red-700 flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Ineligible for Case INC-892
                        </span>
                      ) : (
                        <button
                          onClick={() => setReassignModalMember(member)}
                          disabled={!isHRReviewer || !member.isEligible}
                          className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-[11px] font-semibold rounded-xl transition-colors disabled:opacity-50"
                        >
                          {isHRReviewer ? 'Assign to Docket' : 'View Disclosure'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* D. Challenges Associated With Selected Pool & Review Workflow Section */}
      <div id="challenge-workflow-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-[#191725]">
              Conflict Challenges — {selectedPoolInfo.name}
            </h2>
            <p className="text-xs text-[#777487]">
              Employee objections against appointee bias • Independent review required under § 4.2
            </p>
          </div>
        </div>

        {challenges.length === 0 ? (
          /* Empty state when pool has no challenges */
          <div className="p-10 bg-white rounded-3xl border border-stone-100 shadow-sm text-center">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center text-[#5B3FA3] mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-[#191725]">
              No Active Challenges in {selectedPoolInfo.name} Pool
            </h3>
            <p className="text-xs text-[#777487] max-w-md mx-auto mt-1 leading-relaxed">
              No employee conflict-of-interest challenges have been filed for appointments in this pool.
              All active dockets are proceeding under validated procedural clearance.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {challenges.map((challenge) => (
              <ChallengeReviewPanel
                key={challenge.id}
                challenge={challenge}
                onDecisionApplied={loadPoolData}
              />
            ))}
          </div>
        )}
      </div>

      {/* Assignment Modal (for HR Reviewer) */}
      {reassignModalMember && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-stone-100 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-[#5B3FA3]">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#191725]">Assign Committee Member</h3>
                <p className="text-xs text-[#777487]">{reassignModalMember.name}</p>
              </div>
            </div>

            <div className="p-3 bg-[#FAF7F5] rounded-2xl border border-stone-200/70 text-xs space-y-1">
              <p>Role: <strong>{reassignModalMember.roleTitle}</strong></p>
              <p>Pool: <strong>{selectedPoolInfo.name}</strong></p>
              <p>Conflict Risk Assessment: <strong className="text-emerald-700">Cleared (No direct reporting line)</strong></p>
            </div>

            <p className="text-xs text-[#191725]">
              Assign <strong>{reassignModalMember.name}</strong> to Case <strong>INC-512</strong> (Vendor Procurement Integrity)?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setReassignModalMember(null)}
                className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  alert(`Assigned ${reassignModalMember.name} to Case INC-512 with verified conflict clearance.`);
                  setReassignModalMember(null);
                  loadPoolData();
                }}
                className="px-5 py-2 bg-[#5B3FA3] hover:bg-[#493184] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                Confirm Assignment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
