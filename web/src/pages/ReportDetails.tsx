import { useState, useEffect } from 'react';
import { Complaint } from '../types/complaint';
import { ApiService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { EvidenceIntegrityPanel } from '../components/complaints/EvidenceIntegrityPanel';
import { WitnessQuorumPanel } from '../components/investigation/WitnessQuorumPanel';
import { CaseActionsPanel } from '../components/case/CaseActionsPanel';
import { AccessDeniedBanner } from '../components/ui/AccessDeniedBanner';
import { NavPage } from '../components/layout/Sidebar';
import {
  ArrowLeft,
  Shield,
  Clock,
  Building,
  UserCheck,
  AlertTriangle,
  Lock,
  FileCheck,
  ShieldAlert
} from 'lucide-react';

interface ReportDetailsProps {
  complaintId: string;
  onBack: () => void;
  onNavigate: (page: NavPage, caseId?: string) => void;
}

export function ReportDetails({ complaintId, onBack, onNavigate }: ReportDetailsProps) {
  const { currentUser } = useAuth();
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCase = async () => {
    setLoading(true);
    setAccessError(null);
    const res = await ApiService.getReport(complaintId);

    if (res.success && res.data) {
      setComplaint(res.data);
    } else {
      setAccessError(res.error || `HTTP 403 Forbidden: You are not authorized to view Case ${complaintId}.`);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCase();
  }, [complaintId, currentUser.id]);

  if (loading) {
    return (
      <div className="p-16 text-center bg-white rounded-3xl border border-stone-100 text-xs text-[#777487]">
        Verifying backend case authorization and cryptographic seal...
      </div>
    );
  }

  // REAL ACCESS DENIAL DISPLAY: When Marcus Vance is revoked or unauthorized user accesses the case
  if (accessError) {
    return (
      <AccessDeniedBanner
        caseId={complaintId}
        errorMessage={accessError}
        onBack={onBack}
        onRetry={fetchCase}
      />
    );
  }

  if (!complaint) return null;

  return (
    <div className="space-y-6">
      {/* Top Navigation & Status */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF7F5] border border-stone-200 text-xs font-semibold text-[#191725] transition-colors shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Complaints Roster</span>
        </button>

        <div className="flex items-center gap-2">
          <SeverityBadge severity={complaint.severity} />
          <StatusBadge status={complaint.status} />
        </div>
      </div>

      {/* Main Case Dossier Header */}
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-stone-100">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-[#5B3FA3] bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
                Case {complaint.id}
              </span>
              <div className="inline-flex items-center gap-1.5 font-mono text-xs text-[#777487] bg-stone-50 px-2.5 py-1 rounded-lg border border-stone-200">
                <Shield className="w-3.5 h-3.5 text-[#5B3FA3]" />
                <span>Reporter Token: {complaint.anonymousToken}</span>
              </div>
            </div>

            <h1 className="text-lg font-bold text-[#191725] mt-2">{complaint.title}</h1>
          </div>

          {/* Conflict Alert Banner if under challenge */}
          {complaint.status === 'under_challenge' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 flex items-center gap-2 shrink-0">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Active Committee Challenge: </span>
                <span>Marcus Vance challenged for supervisory conflict.</span>
                <button
                  onClick={() => onNavigate('committee')}
                  className="ml-2 font-bold underline text-[#5B3FA3] hover:text-[#493184]"
                >
                  Review in Committee
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Narrative Summary */}
        <div className="p-4 bg-[#FAF7F5] rounded-2xl border border-stone-200/70">
          <span className="text-[11px] font-bold text-[#777487] uppercase tracking-wider block mb-1">
            Grievance Particulars (Identity Masked & Escaped)
          </span>
          <p className="text-xs text-[#191725] leading-relaxed whitespace-pre-wrap">
            {complaint.summary}
          </p>
        </div>

        {/* Metadata Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
          <div className="p-3 bg-white rounded-2xl border border-stone-200/80 flex items-center gap-3">
            <Building className="w-4 h-4 text-[#5B3FA3]" />
            <div>
              <span className="text-[10px] text-[#777487] block">Departmental Scope</span>
              <span className="font-bold text-[#191725]">{complaint.departmentScope}</span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-stone-200/80 flex items-center gap-3">
            <Clock className="w-4 h-4 text-[#5B3FA3]" />
            <div>
              <span className="text-[10px] text-[#777487] block">Submission Timestamp</span>
              <span className="font-bold text-[#191725]">
                {new Date(complaint.submittedAt).toLocaleString()}
              </span>
            </div>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-stone-200/80 flex items-center gap-3">
            <FileCheck className="w-4 h-4 text-emerald-600" />
            <div>
              <span className="text-[10px] text-[#777487] block">Blockchain Seal Reference</span>
              <span className="font-mono text-[11px] text-[#191725] truncate block max-w-[160px]">
                {complaint.blockchainSealTx.slice(0, 16)}...
              </span>
            </div>
          </div>
        </div>

        {/* Committee Assignments Row */}
        <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#5B3FA3]" />
            <span className="font-bold text-[#191725]">Active Committee Members:</span>
            <div className="flex items-center gap-2 flex-wrap">
              {complaint.committeeMemberIds.map((id) => (
                <span
                  key={id}
                  className="px-2.5 py-0.5 rounded-full bg-white border border-purple-200 text-[#5B3FA3] font-bold text-[11px]"
                >
                  {id === 'usr_marcus'
                    ? 'Marcus Vance'
                    : id === 'usr_david'
                    ? 'David Kim'
                    : id === 'usr_priya'
                    ? 'Priya Sundaram (Substituted)'
                    : id}
                </span>
              ))}

              {complaint.revokedMemberIds.length > 0 && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold border border-red-300">
                  <Lock className="w-3 h-3" />
                  Marcus Vance (Revoked by Challenge)
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigate('committee')}
            className="text-[#5B3FA3] font-bold hover:underline self-end sm:self-auto text-xs"
          >
            Manage Committee Pool →
          </button>
        </div>
      </div>

      {/* Outcome, legal export, related cases */}
      <CaseActionsPanel
        complaint={complaint}
        onChanged={fetchCase}
        onOpenCase={(id) => onNavigate('report_details', id)}
      />

      {/* Evidence Integrity Panel */}
      <EvidenceIntegrityPanel evidence={complaint.evidence} complaintId={complaint.id} />

      {/* Witness Quorum Panel */}
      <WitnessQuorumPanel complaintId={complaint.id} />
    </div>
  );
}
