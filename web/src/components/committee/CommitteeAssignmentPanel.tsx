import { useState } from 'react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { useAuth } from '../../hooks/useAuth';
import { CommitteeMemberRecord } from '../../types/committee';
import { ApiService } from '../../services/api';
import { Users, AlertTriangle, CheckCircle, ShieldAlert, ShieldCheck } from 'lucide-react';

export function CommitteeAssignmentPanel() {
  const { currentUser } = useAuth();
  const [pool, setPool] = useState<CommitteeMemberRecord[]>([]);

  useAutoRefresh(async (isCurrent) => {
    const res = await ApiService.getCommitteePool();
    if (isCurrent()) setPool(res.success ? res.data ?? [] : []);
  }, [currentUser.id]);

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm">
      <div className="flex items-center justify-between pb-4 border-b border-stone-100 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-[#5B3FA3]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#191725]">
              Eligible Committee & Reviewer Pool
            </h3>
            <p className="text-xs text-[#777487]">
              Pre-vetted adjudicators with automated conflict-of-interest screening
            </p>
          </div>
        </div>

        <span className="text-xs px-3 py-1 bg-purple-50 text-[#5B3FA3] font-bold rounded-full border border-purple-200">
          {pool.length} Evaluated Candidates
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {pool.map((member) => {
          const isHighConflict = member.conflictRiskLevel === 'high';

          return (
            <div
              key={member.id}
              className={`p-4 rounded-2xl border transition-all ${
                isHighConflict
                  ? 'bg-red-50/40 border-red-200'
                  : 'bg-[#FAF7F5] border-stone-200/80 hover:border-[#5B3FA3]/40'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-xs font-bold text-[#191725]">{member.name}</h4>
                  <p className="text-[11px] text-[#777487]">{member.roleTitle}</p>
                  <p className="text-[10px] text-stone-500 font-mono mt-0.5">{member.department}</p>
                </div>

                {isHighConflict ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                    <ShieldAlert className="w-3 h-3" />
                    Conflict Flagged
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <ShieldCheck className="w-3 h-3" />
                    Eligible
                  </span>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-stone-200/60 flex items-center justify-between text-[11px]">
                <span className="text-[#777487]">
                  Active Case Load: <strong>{member.currentWorkload} cases</strong>
                </span>

                {isHighConflict ? (
                  <span className="text-red-700 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Ineligible for INC-892
                  </span>
                ) : (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    Available for Case Assignment
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
