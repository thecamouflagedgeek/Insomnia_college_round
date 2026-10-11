import { useState } from 'react';
import { CheckCircle2, FileText, Paperclip, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { EvidenceFile } from '../../types/complaint';
import { ApiService } from '../../services/api';
import { Section } from '../ui/Section';
import { EmptyState } from '../ui/EmptyState';
import { shortHash } from '../../lib/format';

interface EvidenceIntegrityPanelProps {
  evidence: EvidenceFile[];
  complaintId: string;
}

type CheckResult =
  | { state: 'checking' }
  | { state: 'done'; verified: boolean; sha256Matches: boolean; demo: boolean }
  | { state: 'error'; message: string };

const SEALED: Record<EvidenceFile['verificationStatus'], { label: string; cls: string }> = {
  verified: { label: 'Sealed in audit', cls: 'bg-teal-50 text-teal-700' },
  pending: { label: 'Awaiting anchor', cls: 'bg-warn-50 text-warn-700' },
  tampered: { label: 'Seal mismatch', cls: 'bg-danger-50 text-danger-700' }
};

export function EvidenceIntegrityPanel({ evidence, complaintId }: EvidenceIntegrityPanelProps) {
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});

  // Calls the backend verifier: it re-hashes the stored file and checks its evidence_sealed audit entry.
  const verify = async (evId: string) => {
    setChecks((p) => ({ ...p, [evId]: { state: 'checking' } }));
    const res = await ApiService.verifyEvidenceIntegrity(complaintId, evId);
    setChecks((p) => ({
      ...p,
      [evId]:
        res.success && res.data
          ? { state: 'done', verified: res.data.verified, sha256Matches: res.data.sha256Matches, demo: res.source === 'stateful_mock' }
          : { state: 'error', message: res.error || 'Verification failed to run' }
    }));
  };

  return (
    <Section
      icon={<Paperclip />}
      title="Evidence"
      description="Each file's SHA-256 is recorded in the Silent Audit. Verify asks the backend to re-hash the stored file and check that entry."
    >
      {evidence.length === 0 ? (
        <EmptyState compact icon={<Paperclip />} title="No evidence attached" description="The reporter has not uploaded files for this case." />
      ) : (
        <ul className="space-y-2.5">
          {evidence.map((item) => {
            const check = checks[item.id];
            const sealed = SEALED[item.verificationStatus] ?? SEALED.pending;
            return (
              <li key={item.id} className="rounded-2xl border border-line bg-sunken/60 p-3.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-brand-600 ring-1 ring-line">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[0.8125rem] font-semibold text-ink">{item.name}</p>
                      <span className="text-xs text-muted tabular">{item.size}</span>
                      <span className={`chip ${sealed.cls}`}>{sealed.label}</span>
                    </div>
                    <p className="mt-1 truncate font-mono text-[0.6875rem] text-muted" title={item.sha256Hash}>
                      SHA-256 {shortHash(item.sha256Hash, 16, 8)}
                    </p>
                  </div>
                  <button className="btn btn-secondary btn-sm shrink-0" onClick={() => verify(item.id)} disabled={check?.state === 'checking'}>
                    {check?.state === 'checking' ? <RefreshCw className="animate-spin" /> : <ShieldCheck />}
                    {check?.state === 'checking' ? 'Verifying…' : check?.state === 'done' ? 'Verify again' : 'Verify'}
                  </button>
                </div>
                {check?.state === 'done' && (
                  <p
                    role="status"
                    className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-xs ${
                      check.verified ? 'bg-teal-50 text-teal-700' : 'bg-danger-50 text-danger-700'
                    }`}
                  >
                    {check.verified ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0 animate-check" /> : <XCircle className="mt-px h-4 w-4 shrink-0" />}
                    <span>
                      {check.verified
                        ? 'File hash matches and its audit entry verifies.'
                        : check.sha256Matches
                          ? 'File hash matches, but its audit entry is not yet verified.'
                          : 'The stored file does not match its recorded hash.'}
                      {check.demo && ' (Demo data: no backend check was run.)'}
                    </span>
                  </p>
                )}
                {check?.state === 'error' && (
                  <p role="alert" className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700">
                    {check.message}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
