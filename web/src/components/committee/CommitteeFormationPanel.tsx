import React, { useState, useEffect } from 'react';
import { Users, CheckCircle2, AlertCircle, ShieldCheck, ChevronRight, UserCheck } from 'lucide-react';
import { Complaint } from '../../types/complaint';
import { CommitteeMemberRecord } from '../../types/committee';
import { ApiService } from '../../services/api';
import { SeverityBadge } from '../ui/SeverityBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { categoryLabel } from '../../lib/format';

interface CommitteeFormationPanelProps {
  onCommitteeAssigned?: (complaintId: string) => void;
}

export function CommitteeFormationPanel({ onCommitteeAssigned }: CommitteeFormationPanelProps) {
  const [cases, setCases] = useState<Complaint[]>([]);
  const [poolMembers, setPoolMembers] = useState<CommitteeMemberRecord[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');
  const [member1, setMember1] = useState<string>('');
  const [member2, setMember2] = useState<string>('');
  const [member3, setMember3] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    const [casesRes, poolRes] = await Promise.all([
      ApiService.getReports(),
      ApiService.getCommitteePool()
    ]);
    const caseList = casesRes.data || [];
    setCases(caseList);
    const members = poolRes.data || [];
    setPoolMembers(members);

    if (caseList.length > 0 && !selectedCaseId) {
      setSelectedCaseId(caseList[0].id);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeCase = cases.find((c) => c.id === selectedCaseId);

  // When active case changes, pre-select or reset members
  useEffect(() => {
    if (activeCase) {
      const assigned = activeCase.committeeMemberIds || [];
      setMember1(assigned[0] || (poolMembers[0]?.id ?? ''));
      setMember2(assigned[1] || (poolMembers[1]?.id ?? ''));
      setMember3(assigned[2] || (poolMembers[2]?.id ?? ''));
      setError(null);
      setSuccessNotice(null);
    }
  }, [selectedCaseId, poolMembers]);

  // Real-time duplicate check
  const duplicateError = (() => {
    if (!member1 || !member2 || !member3) return null;
    if (member1 === member2 || member1 === member3 || member2 === member3) {
      return 'Duplicate members selected: Each of the 3 committee seats must be filled by a distinct person.';
    }
    return null;
  })();

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) {
      setError('Please select a report/case first.');
      return;
    }
    if (!member1 || !member2 || !member3) {
      setError('Please choose all three committee members.');
      return;
    }
    if (duplicateError) {
      setError(duplicateError);
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessNotice(null);

    const res = await ApiService.assignCommittee(selectedCaseId, [member1, member2, member3]);
    setSubmitting(false);

    if (res.success && res.data) {
      const m1Name = poolMembers.find((m) => m.id === member1)?.name || member1;
      const m2Name = poolMembers.find((m) => m.id === member2)?.name || member2;
      const m3Name = poolMembers.find((m) => m.id === member3)?.name || member3;
      setSuccessNotice(
        `✓ Committee successfully formed and assigned to case ${selectedCaseId}. Official notifications dispatched to ${m1Name}, ${m2Name}, and ${m3Name}.`
      );
      // Refresh local case list
      const updatedCases = cases.map((c) => (c.id === selectedCaseId ? res.data! : c));
      setCases(updatedCases);
      onCommitteeAssigned?.(selectedCaseId);
    } else {
      setError(res.error || 'Failed to assign committee members. Please retry.');
    }
  };

  const eligibleCandidates = poolMembers.filter((m) => m.assignmentStatus !== 'recused_conflict');

  return (
    <div className="card card-pad space-y-5">
      <div className="flex items-center gap-2.5 border-b border-line pb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-ink">Form Case Committee</h2>
          <p className="text-xs text-muted">
            Select a case and designate three distinct committee members to oversee inquiry.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs text-muted">Loading cases and eligible candidates…</div>
      ) : (
        <div className="space-y-5">
          {/* 1. Case Selection */}
          <div>
            <label htmlFor="case-selector" className="mb-1.5 block text-xs font-semibold text-ink-soft">
              Select Case / Report
            </label>
            <select
              id="case-selector"
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="field w-full font-medium"
            >
              {cases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.title} ({c.status.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </div>

          {/* Active Case Summary Card */}
          {activeCase && (
            <div className="rounded-2xl border border-line bg-sunken/60 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="case-id text-brand-700">{activeCase.id}</span>
                  <span className="text-xs text-muted font-medium">
                    {categoryLabel(activeCase.category, activeCase.categoryLabel)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={activeCase.severity} />
                  <StatusBadge status={activeCase.status} />
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-ink">{activeCase.title}</h4>
                <p className="mt-1 text-xs text-ink-soft line-clamp-2">{activeCase.summary}</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted pt-1 border-t border-line/60">
                <ShieldCheck className="h-3.5 w-3.5 text-brand-600" />
                <span>
                  Currently seated: {activeCase.committeeMemberIds?.length || 0} member
                  {(activeCase.committeeMemberIds?.length || 0) === 1 ? '' : 's'}
                </span>
                {activeCase.committeeMemberIds?.length > 0 && (
                  <span className="font-medium text-ink-soft">
                    (
                    {activeCase.committeeMemberIds
                      .map((id) => poolMembers.find((m) => m.id === id)?.name || id)
                      .join(', ')}
                    )
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 2. Exactly Three Dropdown Selectors */}
          <form onSubmit={handleAssign} className="space-y-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
              Committee Member Selectors (3 required)
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {/* Member 1 */}
              <div className="space-y-1.5">
                <label htmlFor="member-1-select" className="text-xs font-semibold text-ink">
                  1. Committee Member (Lead / Presiding)
                </label>
                <select
                  id="member-1-select"
                  value={member1}
                  onChange={(e) => {
                    setMember1(e.target.value);
                    setError(null);
                  }}
                  className={`field w-full text-xs font-medium ${
                    member1 && (member1 === member2 || member1 === member3)
                      ? 'border-danger-500 bg-danger-50/20'
                      : ''
                  }`}
                >
                  <option value="">Choose Member 1…</option>
                  {eligibleCandidates.map((m) => (
                    <option key={`m1-${m.id}`} value={m.id}>
                      {m.name} · {m.department}
                    </option>
                  ))}
                </select>
              </div>

              {/* Member 2 */}
              <div className="space-y-1.5">
                <label htmlFor="member-2-select" className="text-xs font-semibold text-ink">
                  2. Committee Member (Specialist / Ops)
                </label>
                <select
                  id="member-2-select"
                  value={member2}
                  onChange={(e) => {
                    setMember2(e.target.value);
                    setError(null);
                  }}
                  className={`field w-full text-xs font-medium ${
                    member2 && (member2 === member1 || member2 === member3)
                      ? 'border-danger-500 bg-danger-50/20'
                      : ''
                  }`}
                >
                  <option value="">Choose Member 2…</option>
                  {eligibleCandidates.map((m) => (
                    <option key={`m2-${m.id}`} value={m.id}>
                      {m.name} · {m.department}
                    </option>
                  ))}
                </select>
              </div>

              {/* Member 3 */}
              <div className="space-y-1.5">
                <label htmlFor="member-3-select" className="text-xs font-semibold text-ink">
                  3. Committee Member (Neutral / External)
                </label>
                <select
                  id="member-3-select"
                  value={member3}
                  onChange={(e) => {
                    setMember3(e.target.value);
                    setError(null);
                  }}
                  className={`field w-full text-xs font-medium ${
                    member3 && (member3 === member1 || member3 === member2)
                      ? 'border-danger-500 bg-danger-50/20'
                      : ''
                  }`}
                >
                  <option value="">Choose Member 3…</option>
                  {eligibleCandidates.map((m) => (
                    <option key={`m3-${m.id}`} value={m.id}>
                      {m.name} · {m.department}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error alerts */}
            {(duplicateError || error) && (
              <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger-100 bg-danger-50 px-3.5 py-2.5 text-xs font-medium text-danger-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{duplicateError || error}</span>
              </div>
            )}

            {/* Success notification */}
            {successNotice && (
              <div role="status" className="flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3.5 py-2.5 text-xs font-medium text-teal-800">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" />
                <span>{successNotice}</span>
              </div>
            )}

            <div className="flex items-center justify-end pt-2">
              <button
                type="submit"
                disabled={submitting || Boolean(duplicateError) || !member1 || !member2 || !member3}
                className="btn btn-primary shadow-sm"
              >
                <UserCheck className="h-4 w-4" />
                <span>{submitting ? 'Assigning Committee…' : 'Form & Assign Committee'}</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
