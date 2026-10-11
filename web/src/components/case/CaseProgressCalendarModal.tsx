import { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  ExternalLink,
  FolderOpen,
  RefreshCw,
  Scale,
  Shield,
  UserCheck,
  Users,
  X
} from 'lucide-react';
import { Complaint } from '../../types/complaint';
import { AuditEvent } from '../../types/audit';
import { ApiService } from '../../services/api';
import { SeverityBadge } from '../ui/SeverityBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { formatDate, formatDateTime, shortHash } from '../../lib/format';

interface CaseProgressCalendarModalProps {
  complaint: Complaint | null;
  isOpen: boolean;
  onClose: () => void;
  onNavigateToDossier: (caseId: string) => void;
  onNavigateToComplaints: () => void;
}

interface TimelineMilestone {
  id: string;
  date: string;
  time?: string;
  title: string;
  description: string;
  status: 'completed' | 'in_progress' | 'pending';
  icon: React.ReactNode;
  actor?: string;
  proofHash?: string;
}

export function CaseProgressCalendarModal({
  complaint,
  isOpen,
  onClose,
  onNavigateToDossier,
  onNavigateToComplaints
}: CaseProgressCalendarModalProps) {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Close on Escape & trap focus
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    // Autofocus the close button when opened
    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  // Load case-specific audit trail
  useEffect(() => {
    if (!isOpen || !complaint) return;

    let active = true;
    setLoading(true);
    setError(null);

    ApiService.getAuditEvents(complaint.id).then((res) => {
      if (!active) return;
      if (res.success && res.data) {
        setAuditEvents(res.data);
      } else {
        setAuditEvents([]);
        if (res.error) setError(res.error);
      }
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [isOpen, complaint?.id]);

  if (!isOpen || !complaint) return null;

  // Build real milestones derived from verified case and audit records
  const milestones: TimelineMilestone[] = [];

  // 1. Initial complaint submission milestone
  if (complaint.submittedAt) {
    const subDate = new Date(complaint.submittedAt);
    milestones.push({
      id: 'milestone-submission',
      date: complaint.submittedAt,
      time: subDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      title: 'Complaint Submitted & Sealed',
      description: `Report filed cryptographically with token ${shortHash(complaint.anonymousToken, 8, 4)}. Title and narrative encrypted client-side.`,
      status: 'completed',
      icon: <Shield className="h-4 w-4 text-emerald-600" />,
      actor: 'Anonymous Complainant'
    });
  }

  // 2. Audit events mapped to milestones
  const sortedAudit = [...auditEvents].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  sortedAudit.forEach((event) => {
    const evDate = new Date(event.timestamp);
    const timeStr = evDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let title = 'Procedural Audit Record';
    let icon = <CheckCircle2 className="h-4 w-4 text-teal-600" />;

    const dtLower = event.details.toLowerCase();
    if (dtLower.includes('committee_assigned') || dtLower.includes('committee assigned')) {
      title = 'Committee Formed & Seated';
      icon = <Users className="h-4 w-4 text-purple-600" />;
    } else if (dtLower.includes('challenge')) {
      title = 'Committee Challenge Reviewed';
      icon = <Scale className="h-4 w-4 text-orange-600" />;
    } else if (dtLower.includes('witness')) {
      title = 'Witness Quorum Activity';
      icon = <UserCheck className="h-4 w-4 text-blue-600" />;
    } else if (dtLower.includes('status_changed') || dtLower.includes('resolved')) {
      title = 'Case Resolution Recorded';
      icon = <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
    }

    milestones.push({
      id: `audit-${event.id}`,
      date: event.timestamp,
      time: timeStr,
      title,
      description: event.details,
      status: 'completed',
      icon,
      actor: event.actorRef,
      proofHash: event.sha256Proof
    });
  });

  // 3. Fallback procedural milestones if audit events are not yet logged
  if (milestones.length === 1) {
    if (complaint.committeeMemberIds.length > 0) {
      milestones.push({
        id: 'milestone-committee',
        date: complaint.submittedAt,
        title: 'Committee Assigned',
        description: `${complaint.committeeMemberIds.length} review board members assigned to investigate.`,
        status: 'completed',
        icon: <Users className="h-4 w-4 text-purple-600" />,
        actor: 'HR Board'
      });
    }

    if (complaint.status === 'under_challenge') {
      milestones.push({
        id: 'milestone-challenge',
        date: complaint.submittedAt,
        title: 'Committee Challenge Under Review',
        description: 'Impartiality challenge filed by reporter awaiting independent ombudsperson review.',
        status: 'in_progress',
        icon: <Scale className="h-4 w-4 text-orange-600" />,
        actor: 'Independent Reviewer'
      });
    } else if (complaint.status === 'investigation_active' || complaint.status === 'witness_quorum_active') {
      milestones.push({
        id: 'milestone-investigation',
        date: complaint.submittedAt,
        title: 'Active Investigation & Corroboration',
        description: 'Assigned investigator coordinating witness invitations and evidence review.',
        status: 'in_progress',
        icon: <Clock className="h-4 w-4 text-brand-600" />,
        actor: 'Investigator'
      });
    }
  }

  // 4. Pending / Next Step milestone
  if (complaint.status === 'resolved') {
    if (!milestones.some((m) => m.title.includes('Resolution'))) {
      milestones.push({
        id: 'milestone-resolved',
        date: complaint.submittedAt,
        title: 'Case Resolved & Closed',
        description: complaint.resolution?.outcome || 'Final procedural findings approved and case closed.',
        status: 'completed',
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
        actor: 'Review Board'
      });
    }
  } else {
    milestones.push({
      id: 'milestone-pending',
      date: '',
      title: 'Pending Next Action',
      description: complaint.requiredNextAction || 'Awaiting ongoing procedural inquiry or findings delivery.',
      status: 'pending',
      icon: <Clock className="h-4 w-4 text-muted" />
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="case-progress-title"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm animate-enter"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl rounded-2xl border border-line bg-surface shadow-[var(--shadow-pop)] focus:outline-none"
        tabIndex={-1}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-line p-5 sm:p-6">
          <div className="space-y-1 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="case-id text-sm font-bold text-brand-700">{complaint.id}</span>
              <SeverityBadge severity={complaint.severity} />
              <StatusBadge status={complaint.status} />
            </div>
            <h2 id="case-progress-title" className="text-lg font-bold text-ink">
              {complaint.title}
            </h2>
            <p className="text-xs text-muted">
              Filed {formatDate(complaint.submittedAt)} · Category: {complaint.categoryLabel || complaint.category}
            </p>
          </div>

          <button
            ref={closeBtnRef}
            onClick={onClose}
            aria-label="Close case progress calendar modal"
            className="rounded-lg p-1.5 text-muted hover:bg-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[65vh] overflow-y-auto p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-ink">Case Progress Timeline & Milestones</h3>
            </div>
            {loading && (
              <span className="flex items-center gap-1.5 text-xs text-muted">
                <RefreshCw className="h-3 w-3 animate-spin" />
                Loading audit trail
              </span>
            )}
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-danger-200 bg-danger-50 p-3 text-xs text-danger-700">
              {error}
            </div>
          )}

          {milestones.length === 0 ? (
            <EmptyState
              compact
              icon={<FolderOpen />}
              title="No timeline events recorded"
              description="Milestones will appear as actions are officially recorded in the audit trail."
            />
          ) : (
            <ol className="relative ml-3 space-y-6 border-l border-line/80">
              {milestones.map((m) => {
                const isCompleted = m.status === 'completed';
                const isInProgress = m.status === 'in_progress';

                return (
                  <li key={m.id} className="relative ml-6">
                    {/* Milestone indicator circle */}
                    <span
                      className={`absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface ${
                        isCompleted
                          ? 'bg-teal-50 ring-2 ring-teal-500/30'
                          : isInProgress
                            ? 'bg-brand-50 ring-2 ring-brand-500/30'
                            : 'bg-slate-100 ring-1 ring-slate-200'
                      }`}
                    >
                      {m.icon}
                    </span>

                    {/* Milestone Content */}
                    <div className="rounded-xl border border-line bg-surface p-3.5 shadow-sm transition-colors hover:border-brand-200">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-ink">{m.title}</span>
                        {m.date ? (
                          <time dateTime={m.date} className="text-[0.6875rem] font-medium text-muted tabular">
                            {formatDateTime(m.date)}
                          </time>
                        ) : (
                          <span className="text-[0.6875rem] font-medium text-amber-700">Pending</span>
                        )}
                      </div>

                      <p className="mt-1 text-xs leading-relaxed text-ink-soft">{m.description}</p>

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[0.6875rem] text-muted">
                        {m.actor && <span>Recorded by: <strong className="text-ink">{m.actor}</strong></span>}
                        {m.proofHash && (
                          <span className="font-mono text-muted" title={m.proofHash}>
                            proof {shortHash(m.proofHash, 8, 4)}
                          </span>
                        )}
                        <span
                          className={`rounded px-1.5 py-0.5 font-medium ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-700'
                              : isInProgress
                                ? 'bg-indigo-50 text-indigo-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isCompleted ? 'Completed' : isInProgress ? 'In Progress' : 'Pending Step'}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-sunken/40 px-5 py-3.5 sm:px-6">
          <button
            type="button"
            onClick={onNavigateToComplaints}
            className="text-xs font-semibold text-brand-700 hover:underline"
          >
            ← Back to all complaints
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onNavigateToDossier(complaint.id);
              }}
              className="btn btn-primary btn-sm"
            >
              Open Case Dossier
              <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
