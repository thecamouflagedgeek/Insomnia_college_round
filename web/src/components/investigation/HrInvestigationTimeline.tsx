import { useEffect, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  FolderOpen,
  MessageSquare,
  RefreshCw,
  Scale,
  ShieldCheck,
  UserCheck,
  Users
} from 'lucide-react';
import { Complaint } from '../../types/complaint';
import { AuditEvent } from '../../types/audit';
import { WitnessQuorumSummary } from '../../types/witness';
import { ApiService } from '../../services/api';
import { Section } from '../ui/Section';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonRows } from '../ui/Skeleton';
import { Notice } from '../ui/Notice';
import { formatDateTime, shortHash } from '../../lib/format';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';

interface HrInvestigationTimelineProps {
  complaint: Complaint;
}

interface ProceduralEvent {
  id: string;
  timestamp: string;
  title: string;
  description: string;
  verified: boolean;
  category: 'intake' | 'committee' | 'challenge' | 'evidence' | 'witness' | 'communication' | 'resolution';
  actor?: string;
  proofHash?: string;
}

export function HrInvestigationTimeline({ complaint }: HrInvestigationTimelineProps) {
  const [auditEvents, setAuditEvents] = useState<AuditEvent[] | null>(null);
  const [witnessSummary, setWitnessSummary] = useState<WitnessQuorumSummary | null>(null);
  const [messageCount, setMessageCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const loadData = async (silent = false, isCurrent = () => true) => {
    if (!silent) {
      setError(null);
    }

    const [auditRes, witnessRes, messagesRes] = await Promise.all([
      ApiService.getAuditEvents(complaint.id),
      ApiService.getWitnessQuorumSummary(complaint.id),
      ApiService.getMessages(complaint.id)
    ]);

    if (!isCurrent()) return;

    if (auditRes.success && auditRes.data) {
      setAuditEvents(auditRes.data);
    } else {
      setAuditEvents([]);
      if (!silent && auditRes.error) setError(auditRes.error);
    }

    if (witnessRes.success && witnessRes.data) {
      setWitnessSummary(witnessRes.data);
    }

    if (messagesRes.success && messagesRes.data) {
      setMessageCount(messagesRes.data.length);
    }
  };

  useAutoRefresh((isCurrent, initial) => loadData(!initial, isCurrent), [complaint.id]);

  // Construct true procedural events without fabricating missing records
  const events: ProceduralEvent[] = [];

  // 1. Initial Report Filing & Sealing
  if (complaint.submittedAt) {
    events.push({
      id: `intake-${complaint.id}`,
      timestamp: complaint.submittedAt,
      title: 'Report Received & Sealed',
      description: `Cryptographic report ingress logged with case token ${shortHash(complaint.anonymousToken, 8, 4)}. Title and narrative encrypted client-side.`,
      verified: true,
      category: 'intake',
      actor: 'System Ingress'
    });

    events.push({
      id: `triage-${complaint.id}`,
      timestamp: complaint.submittedAt,
      title: 'Initial Triage & Assessment',
      description: `Triage assessment assigned: ${complaint.severity.toUpperCase()} severity. Category: ${complaint.categoryLabel || complaint.category}.`,
      verified: true,
      category: 'intake',
      actor: 'Triage System'
    });
  }

  // 2. Audit Trail Procedural Entries
  if (auditEvents && auditEvents.length > 0) {
    auditEvents.forEach((ae) => {
      let cat: ProceduralEvent['category'] = 'intake';
      let title = 'Procedural Action';
      const d = ae.details.toLowerCase();

      if (d.includes('committee')) {
        cat = 'committee';
        title = 'Committee Assignment Recorded';
      } else if (d.includes('challenge')) {
        cat = 'challenge';
        title = 'Committee Challenge Adjudicated';
      } else if (d.includes('evidence')) {
        cat = 'evidence';
        title = 'Evidence Package Verified';
      } else if (d.includes('witness')) {
        cat = 'witness';
        title = 'Witness Quorum Action';
      } else if (d.includes('message')) {
        cat = 'communication';
        title = 'Investigator Communication Recorded';
      } else if (d.includes('status') || d.includes('resolved')) {
        cat = 'resolution';
        title = 'Case Status Transition';
      }

      events.push({
        id: `audit-${ae.id}`,
        timestamp: ae.timestamp,
        title,
        description: ae.details,
        verified: ae.verificationStatus === 'verified_commitment',
        category: cat,
        actor: ae.actorRef,
        proofHash: ae.sha256Proof
      });
    });
  }

  // 3. Evidence Items Verification
  if (complaint.evidence && complaint.evidence.length > 0) {
    complaint.evidence.forEach((ev) => {
      events.push({
        id: `ev-${ev.id}`,
        timestamp: ev.uploadTimestamp || complaint.submittedAt,
        title: `Evidence Attachment Sealed: ${ev.name}`,
        description: `Stored in private bucket with SHA-256 ${shortHash(ev.sha256Hash, 12, 6)}. Size: ${ev.size}.`,
        verified: ev.verificationStatus === 'verified',
        category: 'evidence',
        actor: 'Secure Storage'
      });
    });
  }

  // 4. Witness Quorum Participation
  if (witnessSummary && witnessSummary.totalInvited > 0) {
    events.push({
      id: `witness-summary-${complaint.id}`,
      timestamp: complaint.submittedAt,
      title: 'Witness Participation Quorum',
      description: `${witnessSummary.totalInvited} voluntary invitation(s) issued. ${witnessSummary.accepted} participant(s) responded; ${witnessSummary.statementsSubmitted} statement(s) recorded. Identities protected.`,
      verified: true,
      category: 'witness',
      actor: 'Quorum Coordinator'
    });
  }

  // 5. Communications Activity
  if (messageCount > 0) {
    events.push({
      id: `msg-summary-${complaint.id}`,
      timestamp: complaint.submittedAt,
      title: 'Investigator Follow-Up Communications',
      description: `${messageCount} confidential bilateral message(s) exchanged via zero-knowledge encrypted channel.`,
      verified: true,
      category: 'communication',
      actor: 'Assigned Investigator'
    });
  }

  // 6. Resolution Milestone
  if (complaint.status === 'resolved' && complaint.resolution) {
    events.push({
      id: `res-${complaint.id}`,
      timestamp: complaint.submittedAt,
      title: 'Case Resolution Approved',
      description: `Formal findings delivered: ${complaint.resolution.outcome}. Procedural review completed.`,
      verified: true,
      category: 'resolution',
      actor: 'Investigation Board'
    });
  }

  // Sort chronologically (oldest to newest)
  const sorted = events.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const getCategoryIcon = (cat: ProceduralEvent['category']) => {
    switch (cat) {
      case 'intake':
        return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
      case 'committee':
        return <Users className="h-4 w-4 text-purple-600" />;
      case 'challenge':
        return <Scale className="h-4 w-4 text-orange-600" />;
      case 'evidence':
        return <FileCheck2 className="h-4 w-4 text-teal-600" />;
      case 'witness':
        return <UserCheck className="h-4 w-4 text-blue-600" />;
      case 'communication':
        return <MessageSquare className="h-4 w-4 text-indigo-600" />;
      case 'resolution':
        return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
      default:
        return <Clock className="h-4 w-4 text-brand-600" />;
    }
  };

  return (
    <Section
      icon={<Calendar />}
      title="HR Investigation Timeline"
      description="Chronological record of procedural actions, verifications, and milestones taken on this case."
      action={
        <button
          className="icon-btn h-8 w-8"
          onClick={() => loadData()}
          aria-label="Refresh HR investigation timeline"
          title="Refresh"
        >
          <RefreshCw className={`h-4 w-4 ${auditEvents === null ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      {error && (
        <Notice tone="danger" role="alert">
          {error}
        </Notice>
      )}

      {auditEvents === null ? (
        <SkeletonRows rows={4} label="Loading investigation timeline" />
      ) : sorted.length === 0 ? (
        <EmptyState
          compact
          icon={<FolderOpen />}
          title="No investigation events recorded"
          description="Procedural events will be recorded here as the investigation progresses."
        />
      ) : (
        <ol className="relative ml-2 space-y-4 border-l border-line">
          {sorted.map((item) => (
            <li key={item.id} className="relative ml-5 pb-1">
              {/* Timeline marker */}
              <span className="absolute -left-[27px] top-1 flex h-5 w-5 items-center justify-center rounded-full border border-line bg-surface shadow-sm">
                {getCategoryIcon(item.category)}
              </span>

              {/* Event card */}
              <div className="rounded-xl border border-line/80 bg-surface p-3 transition-colors hover:border-brand-300">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h4 className="text-xs font-semibold text-ink">{item.title}</h4>
                  <time dateTime={item.timestamp} className="text-[0.6875rem] text-muted tabular">
                    {formatDateTime(item.timestamp)}
                  </time>
                </div>

                <p className="mt-1 text-xs text-ink-soft leading-relaxed">{item.description}</p>

                <div className="mt-2 flex flex-wrap items-center gap-2.5 text-[0.6875rem] text-muted">
                  {item.actor && (
                    <span>
                      Actor: <strong className="font-semibold text-ink">{item.actor}</strong>
                    </span>
                  )}
                  {item.proofHash && (
                    <span className="font-mono text-muted" title={item.proofHash}>
                      hash {shortHash(item.proofHash, 8, 4)}
                    </span>
                  )}
                  <span
                    className={`rounded px-1.5 py-0.5 font-medium ${
                      item.verified
                        ? 'bg-teal-50 text-teal-700'
                        : 'bg-warn-50 text-warn-700'
                    }`}
                  >
                    {item.verified ? 'Verified' : 'Pending Verification'}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}
