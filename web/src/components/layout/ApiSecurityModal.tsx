import { useState } from 'react';
import { X, Send, ShieldCheck, AlertCircle, Copy, Check } from 'lucide-react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useAccessibleCases } from '../../hooks/useAccessibleCases';

interface ApiSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiSecurityModal({ isOpen, onClose }: ApiSecurityModalProps) {
  const { currentUser, allUsers, switchUser } = useAuth();
  // Probe a real case so the access-control demo hits the live backend; INC-892 only exists in mock mode.
  const { selectedCaseId } = useAccessibleCases();
  const demoCase = selectedCaseId || 'INC-892';
  const [endpoint, setEndpoint] = useState<string>('GET /reports/CASE');
  const [responseOutput, setResponseOutput] = useState<{
    status: number;
    statusText: string;
    body: Record<string, unknown> | string;
    headers: Record<string, string>;
    executionTimeMs: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const testEndpoints = [
    { label: `GET /reports/${demoCase} (Case Details & Evidence)`, value: 'GET /reports/CASE' },
    { label: 'GET /challenges/CH-104 (Confidential Challenge Details)', value: 'GET /challenges/CH-104' },
    { label: 'GET /reports (Accessible Complaint Queue)', value: 'GET /reports' },
    { label: `GET /reports/${demoCase}/witness-invitations (Quorum Roster)`, value: 'GET /reports/CASE/witness-invitations' },
    { label: `GET /reports/${demoCase}/audit (Silent Cryptographic Trail)`, value: 'GET /reports/CASE/audit' }
  ];

  const handleExecuteRequest = async () => {
    setLoading(true);
    const start = performance.now();

    try {
      if (endpoint === 'GET /reports/CASE') {
        const res = await ApiService.getReport(demoCase);
        const end = performance.now();
        setResponseOutput({
          status: res.status,
          statusText: res.status === 200 ? 'OK' : res.status === 403 ? 'FORBIDDEN' : 'ERROR',
          body: res.data ? (res.data as unknown as Record<string, unknown>) : { error: res.error, code: 'ACCESS_REVOKED_OR_DENIED' },
          headers: {
            'content-type': 'application/json',
            'x-incognito-auth-user': currentUser.id,
            'x-incognito-user-role': currentUser.role
          },
          executionTimeMs: Math.round(end - start)
        });
      } else if (endpoint === 'GET /challenges/CH-104') {
        const res = await ApiService.getChallenge('CH-104');
        const end = performance.now();
        setResponseOutput({
          status: res.status,
          statusText: res.status === 200 ? 'OK' : res.status === 403 ? 'FORBIDDEN (CONFIDENTIAL)' : 'ERROR',
          body: res.data ? (res.data as unknown as Record<string, unknown>) : { error: res.error, code: 'CONFIDENTIAL_CHALLENGE_REDACTED' },
          headers: {
            'content-type': 'application/json',
            'x-incognito-auth-user': currentUser.id
          },
          executionTimeMs: Math.round(end - start)
        });
      } else if (endpoint === 'GET /reports') {
        const res = await ApiService.getReports();
        const end = performance.now();
        setResponseOutput({
          status: res.status,
          statusText: 'OK',
          body: { count: res.data?.length, reports: res.data },
          headers: {
            'content-type': 'application/json',
            'x-incognito-auth-user': currentUser.id
          },
          executionTimeMs: Math.round(end - start)
        });
      } else if (endpoint === 'GET /reports/CASE/witness-invitations') {
        const res = await ApiService.getWitnessInvitations(demoCase);
        const end = performance.now();
        setResponseOutput({
          status: res.status,
          statusText: 'OK',
          body: {
            invitations: res.data,
            note: currentUser.role === 'assigned_investigator' ? 'Investigator Privilege: Full acceptance records unmasked.' : 'Masked view: Participation records hidden for reporter & witness security.'
          },
          headers: {
            'content-type': 'application/json'
          },
          executionTimeMs: Math.round(end - start)
        });
      } else if (endpoint === 'GET /reports/CASE/audit') {
        const res = await ApiService.getAuditEvents(demoCase);
        const end = performance.now();
        setResponseOutput({
          status: res.status,
          statusText: 'OK',
          body: { eventsCount: res.data?.length, events: res.data },
          headers: {
            'content-type': 'application/json'
          },
          executionTimeMs: Math.round(end - start)
        });
      }
    } catch (err: unknown) {
      const end = performance.now();
      const msg = err instanceof Error ? err.message : String(err);
      setResponseOutput({
        status: 500,
        statusText: 'INTERNAL ERROR',
        body: { error: msg },
        headers: { 'content-type': 'application/json' },
        executionTimeMs: Math.round(end - start)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (responseOutput) {
      navigator.clipboard.writeText(JSON.stringify(responseOutput, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-night/45 p-0 backdrop-enter sm:items-center sm:p-4"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-shell-title"
        className="flex max-h-[92vh] w-full max-w-4xl animate-sheet flex-col overflow-hidden rounded-t-[var(--radius-card)] bg-night text-white shadow-[var(--shadow-pop)] sm:rounded-[var(--radius-card)]"
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600">
              <ShieldCheck className="h-[18px] w-[18px]" />
            </span>
            <div>
              <h2 id="api-shell-title" className="text-base font-semibold">API shell</h2>
              <p className="text-xs text-white/60">Call the backend as any persona and see exactly what the server returns, including refusals.</p>
            </div>
          </div>
          <button autoFocus onClick={onClose} aria-label="Close API shell" className="rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.05] p-4">
            <div className="min-w-0">
              <p className="text-xs text-white/55">Calling as</p>
              <p className="mt-0.5 text-sm font-semibold">
                {currentUser.name} <span className="font-mono text-xs font-normal text-white/55">{currentUser.id} · {currentUser.role}</span>
              </p>
            </div>
            <label className="flex items-center gap-2 text-xs text-white/60">
              Switch caller
              <select
                value={currentUser.id}
                onChange={(e) => switchUser(e.target.value)}
                className="rounded-xl border border-white/15 bg-night-2 px-3 py-2 text-xs text-white focus:border-brand-300 focus:outline-none"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="min-w-0 flex-1">
              <span className="sr-only">Endpoint</span>
              <select
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-night-2 px-4 py-2.5 font-mono text-[0.8125rem] text-white focus:border-brand-300 focus:outline-none"
              >
                {testEndpoints.map((ep) => (
                  <option key={ep.value} value={ep.value}>{ep.label}</option>
                ))}
              </select>
            </label>
            <button onClick={handleExecuteRequest} disabled={loading} className="btn btn-primary">
              <Send />
              {loading ? 'Sending…' : 'Send request'}
            </button>
          </div>

          {responseOutput ? (
            <div className="animate-enter overflow-hidden rounded-2xl border border-white/10 bg-black/30 p-4 font-mono text-xs">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-lg px-2.5 py-1 font-semibold ${
                      responseOutput.status === 200
                        ? 'bg-teal-500/15 text-teal-100'
                        : responseOutput.status === 403
                          ? 'bg-danger-500/20 text-danger-100'
                          : 'bg-attn-500/20 text-attn-100'
                    }`}
                  >
                    HTTP {responseOutput.status} {responseOutput.statusText}
                  </span>
                  <span className="text-white/50 tabular">{responseOutput.executionTimeMs} ms</span>
                </div>
                <button onClick={handleCopy} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white">
                  {copied ? <Check className="h-3.5 w-3.5 text-teal-100" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>

              {responseOutput.status === 403 && (
                <p className="mb-3 flex items-start gap-2 rounded-xl bg-danger-500/15 p-3 font-sans text-danger-100">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  The server refused this request for {currentUser.name}.
                </p>
              )}

              <div className="max-h-72 space-y-2 overflow-y-auto">
                <div className="text-[0.6875rem] text-white/45">
                  # Request context
                  {Object.entries(responseOutput.headers).map(([k, v]) => (
                    <div key={k} className="pl-2 text-white/60">
                      {k}: <span className="text-brand-200">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 text-[0.6875rem] text-white/45"># Response body</div>
                <pre className="overflow-x-auto whitespace-pre-wrap pl-2 text-teal-100">
                  {typeof responseOutput.body === 'string' ? responseOutput.body : JSON.stringify(responseOutput.body, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-xs text-white/50">
              Choose an endpoint and send a request to see the server's response.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
