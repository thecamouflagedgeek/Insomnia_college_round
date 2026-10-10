import { useState } from 'react';
import { X, Send, ShieldCheck, AlertCircle, Copy, Check } from 'lucide-react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';

interface ApiSecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ApiSecurityModal({ isOpen, onClose }: ApiSecurityModalProps) {
  const { currentUser, allUsers, switchUser } = useAuth();
  const [endpoint, setEndpoint] = useState<string>('GET /reports/INC-892');
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
    { label: 'GET /reports/INC-892 (Case Details & Evidence)', value: 'GET /reports/INC-892' },
    { label: 'GET /challenges/CH-104 (Confidential Challenge Details)', value: 'GET /challenges/CH-104' },
    { label: 'GET /reports (Accessible Complaint Queue)', value: 'GET /reports' },
    { label: 'GET /reports/INC-892/witness-invitations (Quorum Roster)', value: 'GET /reports/INC-892/witness-invitations' },
    { label: 'GET /reports/INC-892/audit (Silent Cryptographic Trail)', value: 'GET /reports/INC-892/audit' }
  ];

  const handleExecuteRequest = async () => {
    setLoading(true);
    const start = performance.now();

    try {
      if (endpoint === 'GET /reports/INC-892') {
        const res = await ApiService.getReport('INC-892');
        const end = performance.now();
        setResponseOutput({
          status: res.status,
          statusText: res.status === 200 ? 'OK' : res.status === 403 ? 'FORBIDDEN' : 'ERROR',
          body: res.data ? (res.data as unknown as Record<string, unknown>) : { error: res.error, code: 'ACCESS_REVOKED_OR_DENIED' },
          headers: {
            'content-type': 'application/json',
            'x-incognito-auth-user': currentUser.id,
            'x-incognito-user-role': currentUser.role,
            'x-access-control-revocation-state': 'EVALUATED_AGAINST_COMMITTEE_CHALLENGE'
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
            'x-incognito-auth-user': currentUser.id,
            'x-confidentiality-filter': 'STRICT_INDEPENDENT_SEPARATION'
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
      } else if (endpoint === 'GET /reports/INC-892/witness-invitations') {
        const res = await ApiService.getWitnessInvitations('INC-892');
        const end = performance.now();
        setResponseOutput({
          status: res.status,
          statusText: 'OK',
          body: {
            invitations: res.data,
            note: currentUser.role === 'assigned_investigator' ? 'Investigator Privilege: Full acceptance records unmasked.' : 'Masked view: Participation records hidden for reporter & witness security.'
          },
          headers: {
            'content-type': 'application/json',
            'x-incognito-witness-privilege': currentUser.role === 'assigned_investigator' ? 'GRANTED' : 'MASKED'
          },
          executionTimeMs: Math.round(end - start)
        });
      } else if (endpoint === 'GET /reports/INC-892/audit') {
        const res = await ApiService.getAuditEvents('INC-892');
        const end = performance.now();
        setResponseOutput({
          status: res.status,
          statusText: 'OK',
          body: { eventsCount: res.data?.length, events: res.data },
          headers: {
            'content-type': 'application/json',
            'x-blockchain-contract': '0x718a...229 (Polygon PoS)'
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#191725] text-stone-100 rounded-3xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border border-stone-800 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#5B3FA3] flex items-center justify-center text-white">
              <ShieldCheck className="w-5 h-5 text-[#FFD08A]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Judge Security & Direct API Shell</h2>
              <p className="text-xs text-stone-400">
                Execute requests directly against authorization logic to verify HTTP 403 Forbidden enforcement
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Active Auth Persona */}
          <div className="bg-stone-900/90 rounded-2xl p-4 border border-stone-800 flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="text-[11px] font-mono text-stone-400 uppercase tracking-wider block">
                Simulated Bearer Authorization
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm font-bold text-white">{currentUser.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#5B3FA3] text-purple-200 font-mono">
                  role: {currentUser.role}
                </span>
                <span className="text-xs text-stone-400 font-mono">
                  (id: {currentUser.id})
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-stone-400">Switch Caller:</span>
              <select
                value={currentUser.id}
                onChange={(e) => switchUser(e.target.value)}
                className="bg-stone-800 border border-stone-700 text-xs text-white rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#5B3FA3]"
              >
                {allUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Endpoint Selector & Send Button */}
          <div className="flex items-center gap-2">
            <select
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              className="flex-1 bg-stone-900 border border-stone-700 text-sm font-mono text-white rounded-2xl px-4 py-3 focus:outline-none focus:border-[#5B3FA3]"
            >
              {testEndpoints.map((ep) => (
                <option key={ep.value} value={ep.value}>
                  {ep.label}
                </option>
              ))}
            </select>

            <button
              onClick={handleExecuteRequest}
              disabled={loading}
              className="px-6 py-3 bg-[#5B3FA3] hover:bg-[#493184] text-white text-sm font-bold rounded-2xl transition-all shadow-md flex items-center gap-2 disabled:opacity-50"
            >
              <Send className="w-4 h-4 text-[#FFD08A]" />
              <span>{loading ? 'Executing...' : 'Send Request'}</span>
            </button>
          </div>

          {/* Response Console */}
          {responseOutput ? (
            <div className="bg-stone-950 rounded-2xl border border-stone-800 p-4 font-mono text-xs overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-stone-800 mb-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                      responseOutput.status === 200
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : responseOutput.status === 403
                        ? 'bg-red-950 text-red-400 border border-red-800 animate-pulse'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    HTTP {responseOutput.status} {responseOutput.statusText}
                  </span>
                  <span className="text-stone-400">Latency: {responseOutput.executionTimeMs}ms</span>
                </div>

                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-stone-400 hover:text-white px-2.5 py-1 rounded-lg hover:bg-stone-800 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy Response'}</span>
                </button>
              </div>

              {/* Status Explanation */}
              {responseOutput.status === 403 && (
                <div className="mb-3 p-3 bg-red-950/60 border border-red-900 rounded-xl text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="font-bold">Security Rule Enforced: </span>
                    {currentUser.role === 'committee_member'
                      ? 'Revocation Policy active. The user is either stripped of assignment or attempting to access confidential conflict records.'
                      : 'Unauthorized action blocked by role permissions.'}
                  </div>
                </div>
              )}

              <div className="max-h-64 overflow-y-auto space-y-2">
                <div className="text-stone-500 text-[11px]">
                  # Response Headers:
                  {Object.entries(responseOutput.headers).map(([k, v]) => (
                    <div key={k} className="text-stone-400 pl-2">
                      {k}: <span className="text-purple-300">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 text-stone-500 text-[11px]"># Response Body:</div>
                <pre className="text-emerald-400 text-xs overflow-x-auto whitespace-pre-wrap pl-2">
                  {typeof responseOutput.body === 'string'
                    ? responseOutput.body
                    : JSON.stringify(responseOutput.body, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-stone-500 font-mono text-xs border border-dashed border-stone-800 rounded-2xl">
              Click &quot;Send Request&quot; to inspect real-time authorization behavior and HTTP status responses.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
