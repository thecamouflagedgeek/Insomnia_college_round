import { CheckCircle2, Clock, CircleAlert, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { AuditVerificationStatus } from '../../types/audit';

const CFG: Record<AuditVerificationStatus, { label: string; cls: string; icon: ReactNode; title: string }> = {
  verified_commitment: {
    label: 'Verified',
    cls: 'bg-teal-50 text-teal-700',
    icon: <CheckCircle2 />,
    title: 'Hash chain intact and matching its anchor, as reported by the backend verifier'
  },
  pending_verification: {
    label: 'Awaiting anchor',
    cls: 'bg-warn-50 text-warn-700',
    icon: <Clock />,
    title: 'Recorded in the hash chain; not yet anchored on-chain'
  },
  verification_failed: {
    label: 'Mismatch',
    cls: 'bg-danger-50 text-danger-700',
    icon: <XCircle />,
    title: 'The backend verifier found this entry does not match the chain or its anchor'
  },
  unavailable_verification_service: {
    label: 'Unverified',
    cls: 'bg-sunken text-muted',
    icon: <CircleAlert />,
    title: 'Verification service unavailable'
  }
};

export function AuditStatusChip({ status }: { status: AuditVerificationStatus }) {
  const c = CFG[status] ?? CFG.unavailable_verification_service;
  return (
    <span className={`chip ${c.cls}`} title={c.title}>
      {c.icon}
      {c.label}
    </span>
  );
}
