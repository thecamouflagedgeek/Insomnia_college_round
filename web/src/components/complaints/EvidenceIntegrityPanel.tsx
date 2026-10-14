import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Eye, EyeOff, FileText, Paperclip, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
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

type Opened =
  | { state: 'loading' }
  | { state: 'open'; url: string; mime: string }
  | { state: 'error'; message: string };

export function EvidenceIntegrityPanel({ evidence, complaintId }: EvidenceIntegrityPanelProps) {
  const [checks, setChecks] = useState<Record<string, CheckResult>>({});
  const [opened, setOpened] = useState<Record<string, Opened>>({});
  const urls = useRef<string[]>([]);

  // Object URLs hold the decrypted file in memory; release them when the dossier closes.
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Opening a file is recorded in the Silent Audit by the backend.
  const toggleView = async (evId: string) => {
    const cur = opened[evId];
    if (cur?.state === 'open') {
      URL.revokeObjectURL(cur.url);
      setOpened((p) => Object.fromEntries(Object.entries(p).filter(([k]) => k !== evId)));
      return;
    }
    setOpened((p) => ({ ...p, [evId]: { state: 'loading' } }));
    const res = await ApiService.openEvidenceFile(complaintId, evId);
    if (res.success && res.data) urls.current.push(res.data.url);
    setOpened((p) => ({
      ...p,
      [evId]:
        res.success && res.data
          ? { state: 'open', url: res.data.url, mime: res.data.mime }
          : { state: 'error', message: res.error || 'The file could not be opened' }
    }));
  };

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
                  <button
                    className="btn btn-ghost btn-sm shrink-0"
                    onClick={() => toggleView(item.id)}
                    disabled={opened[item.id]?.state === 'loading'}
                    aria-expanded={opened[item.id]?.state === 'open'}
                  >
                    {opened[item.id]?.state === 'loading' ? <RefreshCw className="animate-spin" /> : opened[item.id]?.state === 'open' ? <EyeOff /> : <Eye />}
                    {opened[item.id]?.state === 'open' ? 'Hide' : 'View'}
                  </button>
                  <button className="btn btn-secondary btn-sm shrink-0" onClick={() => verify(item.id)} disabled={check?.state === 'checking'}>
                    {check?.state === 'checking' ? <RefreshCw className="animate-spin" /> : <ShieldCheck />}
                    {check?.state === 'checking' ? 'Verifying…' : check?.state === 'done' ? 'Verify again' : 'Verify'}
                  </button>
                </div>
                {(() => {
                  const o = opened[item.id];
                  if (!o || o.state === 'loading') return null;
                  if (o.state === 'error')
                    return (
                      <p role="alert" className="mt-3 rounded-xl bg-danger-50 px-3 py-2 text-xs text-danger-700">
                        {o.message}
                      </p>
                    );
                  return (
                    <div className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
                      {o.mime.startsWith('image/') ? (
                        <img src={o.url} alt={`Evidence ${item.name}`} className="mx-auto max-h-[28rem] w-auto object-contain" />
                      ) : o.mime === 'application/pdf' ? (
                        // Chrome's PDF viewer does not run inside a sandboxed frame; the blob is local to this page.
                        <iframe src={o.url} title={`Evidence ${item.name}`} className="h-[28rem] w-full" />
                      ) : o.mime.startsWith('text/') ? (
                        <iframe src={o.url} title={`Evidence ${item.name}`} className="h-[20rem] w-full" sandbox="" />
                      ) : (
                        <p className="px-3 py-3 text-xs text-muted">
                          No preview for {o.mime || 'this file type'}.{' '}
                          <a href={o.url} download={item.name} className="font-semibold text-brand-700 hover:underline">
                            Download the file
                          </a>
                        </p>
                      )}
                      <p className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[0.6875rem] text-muted">
                        <span>Stored copy with identifying metadata removed where supported. Opening it is recorded in the Silent Audit.</span>
                        <a href={o.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">
                          Open in new tab
                        </a>
                      </p>
                    </div>
                  );
                })()}
                {(item.integrityFlags?.length ?? 0) > 0 && (
                  <div className="mt-3 rounded-xl bg-attn-50 px-3 py-2 text-xs text-attn-700">
                    <p className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      Worth a closer look
                    </p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {item.integrityFlags!.map((f) => (
                        <li key={f.code}>{f.message}</li>
                      ))}
                    </ul>
                    <p className="mt-1.5 text-attn-600">Automated cues, not a finding that the file is fake.</p>
                  </div>
                )}
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
