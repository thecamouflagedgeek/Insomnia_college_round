import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  FolderOpen,
  Info,
  Lock,
  MessageSquare,
  Radio,
  RefreshCw,
  Search,
  Send,
  Shield,
  UserCheck,
  UserPlus,
  Users,
  XCircle
} from 'lucide-react';
import { useAccessibleCases } from '../hooks/useAccessibleCases';
import { useAuth } from '../hooks/useAuth';
import { useAutoRefresh, refreshDashboard } from '../hooks/useAutoRefresh';
import { ApiService } from '../services/api';
import { WitnessInvitation } from '../types/witness';
import { PageHeader } from '../components/ui/PageHeader';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { SeverityBadge } from '../components/ui/SeverityBadge';
import { StatusBadge } from '../components/ui/StatusBadge';
import { categoryLabel, formatDate, formatDateTime, shortHash } from '../lib/format';

type CaseMessage = {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  isEncrypted?: boolean;
};

export function WitnessQuorumPage() {
  const { currentUser } = useAuth();
  const { cases, selectedCaseId, setSelectedCaseId, loading: casesLoading } = useAccessibleCases();

  const [searchQuery, setSearchQuery] = useState('');
  const [invitations, setInvitations] = useState<WitnessInvitation[]>([]);
  const [messages, setMessages] = useState<CaseMessage[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Composer states
  const [composerMode, setComposerMode] = useState<'invite' | 'message'>('invite');
  const [inviteAlias, setInviteAlias] = useState('');
  const [messageText, setMessageText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [issuedCode, setIssuedCode] = useState<{ alias: string; code: string } | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const threadEndRef = useRef<HTMLDivElement>(null);

  const isAssignedInvestigator =
    currentUser.role === 'assigned_investigator' || currentUser.role === 'administrator';

  const activeCase = cases.find((c) => c.id === selectedCaseId);

  // Load records for the selected case
  const loadCaseData = async (silent = false, isCurrent = () => true) => {
    if (!selectedCaseId) {
      setInvitations([]);
      setMessages([]);
      return;
    }

    if (!silent) {
      setDataLoading(true);
      setError(null);
    }

    const [invRes, msgRes] = await Promise.all([
      ApiService.getWitnessInvitations(selectedCaseId),
      ApiService.getMessages(selectedCaseId)
    ]);

    if (!isCurrent()) return;

    if (invRes.success && invRes.data) {
      setInvitations(invRes.data);
    } else {
      setInvitations([]);
      if (!silent && invRes.error) setError(invRes.error);
    }

    if (msgRes.success && msgRes.data) {
      setMessages(msgRes.data);
    } else {
      setMessages([]);
    }

    if (!silent) setDataLoading(false);
  };

  useAutoRefresh((isCurrent, initial) => loadCaseData(!initial, isCurrent), [selectedCaseId]);

  // Pre-fill next witness alias suggested
  useEffect(() => {
    if (invitations.length > 0) {
      const nextLetter = String.fromCharCode(65 + (invitations.length % 26));
      setInviteAlias(`Witness ${nextLetter}`);
    } else {
      setInviteAlias('Witness A');
    }
  }, [invitations.length]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) return;
    const alias = inviteAlias.trim();
    if (!alias) {
      setFormError('Please provide a masked alias for the witness.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setSuccessNotice(null);

    const res = await ApiService.inviteWitness(selectedCaseId, alias);
    setSubmitting(false);

    if (res.success && res.data) {
      if (res.data.witnessCode) {
        setIssuedCode({ alias: res.data.anonymousAlias, code: res.data.witnessCode });
      }
      setSuccessNotice(
        `✓ Invitation for "${alias}" created and cryptographically sealed. Outbound notification delivery is pending server SMTP configuration.`
      );
      refreshDashboard();
      loadCaseData(true);
    } else {
      setFormError(res.error || 'The invitation could not be issued.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCaseId) return;
    const trimmed = messageText.trim();
    if (!trimmed) {
      setFormError('Please enter a context message or inquiry update.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    setSuccessNotice(null);

    const res = await ApiService.sendMessage(selectedCaseId, trimmed);
    setSubmitting(false);

    if (res.success && res.data) {
      setMessageText('');
      setSuccessNotice('✓ Message appended to the secure case communication thread.');
      refreshDashboard();
      loadCaseData(true);
    } else {
      setFormError(res.error || 'Failed to send message.');
    }
  };

  const copyCode = async () => {
    if (!issuedCode) return;
    try {
      await navigator.clipboard.writeText(issuedCode.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      /* clipboard blocked: code stays selectable */
    }
  };

  // Derive truthful metrics from actual backend records
  const acceptedCount = invitations.filter((i) => i.status === 'accepted').length;
  const declinedCount = invitations.filter((i) => i.status === 'declined').length;
  const responsesReceived = acceptedCount + declinedCount;
  const pendingCount = invitations.filter((i) => i.status === 'pending').length;
  const quorumMet = acceptedCount >= 2;

  // Filter cases for the left sidebar
  const filteredCases = cases.filter((c) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      c.id.toLowerCase().includes(q) ||
      c.title.toLowerCase().includes(q) ||
      (c.categoryLabel || c.category).toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Witness Quorum"
        description="Confidential case communication interface to coordinate voluntary witness corroboration and share limited procedural context."
        actions={
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadCaseData()}
            disabled={dataLoading}
          >
            <RefreshCw className={dataLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {casesLoading ? (
        <LoadingState message="Loading accessible cases" />
      ) : cases.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FolderOpen />}
            title="No cases for your role"
            description="Witness invitations are managed per case. Cases appear once you are assigned to one."
          />
        </div>
      ) : (
        /* Chat-Inspired Two-Panel Interface */
        <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-card)] flex flex-col lg:flex-row h-[720px]">
          {/* Left Panel: Case List */}
          <div className="w-full lg:w-80 xl:w-96 border-b lg:border-b-0 lg:border-r border-line bg-sunken/40 flex flex-col shrink-0">
            {/* Search Header */}
            <div className="p-3.5 border-b border-line bg-surface">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search accessible cases…"
                  className="field w-full pl-9 text-xs"
                />
              </div>
            </div>

            {/* Case Items List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {filteredCases.length === 0 ? (
                <div className="p-4 text-center text-xs text-muted">No cases match your search.</div>
              ) : (
                filteredCases.map((c) => {
                  const isSelected = c.id === selectedCaseId;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        setSelectedCaseId(c.id);
                        setIssuedCode(null);
                        setFormError(null);
                        setSuccessNotice(null);
                      }}
                      className={`w-full rounded-xl p-3 text-left transition-all ${
                        isSelected
                          ? 'border border-brand-500 bg-brand-50/70 shadow-sm'
                          : 'border border-transparent bg-surface hover:border-line hover:bg-surface'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="case-id text-xs font-bold text-brand-700">{c.id}</span>
                        <span className="text-[0.6875rem] text-muted tabular">{formatDate(c.submittedAt)}</span>
                      </div>
                      <p className="mt-1 text-xs font-semibold text-ink truncate" title={c.title}>
                        {c.title}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-1.5">
                        <span className="text-[0.6875rem] text-muted truncate">
                          {categoryLabel(c.category, c.categoryLabel)}
                        </span>
                        <StatusBadge status={c.status} className="scale-90 origin-right" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Panel: Witness Communication & Message Composer */}
          <div className="flex-1 flex flex-col bg-surface overflow-hidden">
            {!activeCase ? (
              <div className="flex-1 flex items-center justify-center p-8">
                <EmptyState
                  compact
                  icon={<MessageSquare />}
                  title="Select a case"
                  description="Choose a case from the list on the left to coordinate witness participation."
                />
              </div>
            ) : (
              <>
                {/* Chat Panel Header */}
                <div className="px-5 py-3.5 border-b border-line bg-surface flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="case-id text-sm font-bold text-brand-700">{activeCase.id}</span>
                      <SeverityBadge severity={activeCase.severity} />
                      <StatusBadge status={activeCase.status} />
                    </div>
                    <h3 className="text-sm font-semibold text-ink truncate mt-0.5" title={activeCase.title}>
                      {activeCase.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    {quorumMet ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#047857] px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-emerald-900/20">
                        <CheckCircle2 className="h-3.5 w-3.5 stroke-[2.2]" />
                        Quorum reached ({acceptedCount} verified)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#475569] px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-slate-800/20">
                        <Radio className="h-3.5 w-3.5 stroke-[2.2]" />
                        Quorum pending ({acceptedCount}/2 accepted)
                      </span>
                    )}
                  </div>
                </div>

                {/* Conversation Body / Witness Invitation Stream */}
                <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-sunken/20">
                  {/* Procedural Banner */}
                  <div className="rounded-xl border border-line bg-surface p-3 text-xs text-muted flex items-start gap-2.5 shadow-sm">
                    <Info className="h-4 w-4 shrink-0 text-brand-600 mt-0.5" />
                    <div>
                      <span className="font-semibold text-ink">Voluntary Witness Participation Protocol:</span> Witness
                      statements are never collected through this web portal. This workspace coordinates invitations,
                      verifies quorum, and records anonymous participation codes.
                    </div>
                  </div>

                  {dataLoading && invitations.length === 0 && messages.length === 0 ? (
                    <div className="py-12 text-center text-xs text-muted">
                      <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-brand-600" />
                      Loading witness records and messages…
                    </div>
                  ) : invitations.length === 0 && messages.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<Users />}
                      title="No witness invitations yet"
                      description="Use the composer below to issue the first confidential witness invitation."
                    />
                  ) : (
                    <>
                      {/* Witness Invitations */}
                      {invitations.map((inv) => {
                        const isAccepted = inv.status === 'accepted';
                        const isDeclined = inv.status === 'declined';
                        return (
                          <div
                            key={inv.id}
                            className={`rounded-2xl border p-4 shadow-sm transition-colors ${
                              isAccepted
                                ? 'border-teal-200 bg-teal-50/30'
                                : isDeclined
                                  ? 'border-line bg-sunken/40 opacity-75'
                                  : 'border-brand-200 bg-surface'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                                  <UserCheck className="h-4 w-4" />
                                </span>
                                <div>
                                  <p className="text-xs font-semibold text-ink">
                                    Witness ({inv.anonymousAlias || 'Identity Masked for Privilege'})
                                  </p>
                                  <p className="text-[0.6875rem] text-muted">
                                    Invited {formatDate(inv.invitedAt)}
                                    {inv.respondedAt && ` · Responded ${formatDate(inv.respondedAt)}`}
                                  </p>
                                </div>
                              </div>

                              <div>
                                {isAccepted ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#047857] px-2 py-0.5 text-[0.6875rem] font-semibold text-white ring-1 ring-inset ring-emerald-900/20">
                                    <Check className="h-3 w-3 stroke-[2.2]" />
                                    Participating
                                  </span>
                                ) : isDeclined ? (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#475569] px-2 py-0.5 text-[0.6875rem] font-semibold text-white ring-1 ring-inset ring-slate-800/20">
                                    <XCircle className="h-3 w-3" />
                                    Declined
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#c2410c] px-2 py-0.5 text-[0.6875rem] font-semibold text-white ring-1 ring-inset ring-orange-900/20">
                                    <Clock className="h-3 w-3 stroke-[2.2]" />
                                    Awaiting reply
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Invitation Details & Truthful Delivery State */}
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-2.5 text-xs">
                              <div className="flex items-center gap-2 font-mono text-[0.6875rem] text-muted">
                                <Lock className="h-3 w-3" />
                                <span>Code: {inv.witnessCode ? inv.witnessCode : '•••••••• (Protected)'}</span>
                              </div>
                              <span className="text-[0.6875rem] text-muted">
                                Status: <strong>{inv.status}</strong> · Outbound email pending configuration
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Bilateral Investigation Messages */}
                      {messages.map((msg) => (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${
                            msg.sender === 'you' ? 'items-end' : 'items-start'
                          }`}
                        >
                          <div
                            className={`max-w-[85%] rounded-2xl p-3.5 shadow-sm text-xs ${
                              msg.sender === 'you'
                                ? 'bg-brand-600 text-white rounded-br-none'
                                : 'bg-surface border border-line text-ink rounded-bl-none'
                            }`}
                          >
                            <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                            <span
                              className={`mt-1.5 block text-[0.625rem] tabular ${
                                msg.sender === 'you' ? 'text-brand-200 text-right' : 'text-muted'
                              }`}
                            >
                              {formatDateTime(msg.timestamp)}
                            </span>
                          </div>
                        </div>
                      ))}

                      <div ref={threadEndRef} />
                    </>
                  )}
                </div>

                {/* Newly issued one-time code alert banner */}
                {issuedCode && (
                  <div className="px-5 py-2.5 bg-teal-50 border-t border-b border-teal-200 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 text-teal-800">
                      <Shield className="h-4 w-4 text-teal-600 shrink-0" />
                      <span>
                        One-Time Token for <strong>{issuedCode.alias}</strong>: <code className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-teal-200">{issuedCode.code}</code>
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={copyCode}
                      className="btn btn-secondary btn-sm bg-white"
                    >
                      {copiedCode ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {copiedCode ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                )}

                {/* Feedback notices */}
                {formError && (
                  <div className="px-5 py-2 bg-danger-50 border-t border-danger-200 text-xs text-danger-700 flex items-center gap-2">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {successNotice && (
                  <div className="px-5 py-2 bg-teal-50 border-t border-teal-200 text-xs text-teal-800 flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-teal-600" />
                    <span>{successNotice}</span>
                  </div>
                )}

                {/* Message & Invitation Composer */}
                <div className="p-4 border-t border-line bg-surface space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-lg border border-line bg-sunken p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setComposerMode('invite');
                          setFormError(null);
                        }}
                        className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                          composerMode === 'invite' ? 'bg-surface text-brand-700 shadow-sm' : 'text-muted hover:text-ink'
                        }`}
                      >
                        <UserPlus className="inline h-3.5 w-3.5 mr-1" />
                        Issue Witness Invitation
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setComposerMode('message');
                          setFormError(null);
                        }}
                        className={`px-3 py-1 font-semibold rounded-md transition-colors ${
                          composerMode === 'message' ? 'bg-surface text-brand-700 shadow-sm' : 'text-muted hover:text-ink'
                        }`}
                      >
                        <MessageSquare className="inline h-3.5 w-3.5 mr-1" />
                        Share Context Message
                      </button>
                    </div>

                    <span className="text-[0.6875rem] text-muted">
                      {composerMode === 'invite' ? 'Masked Witness Quorum Invitation' : 'Bilateral Case Thread'}
                    </span>
                  </div>

                  {composerMode === 'invite' ? (
                    <form onSubmit={handleSendInvite} className="flex gap-2">
                      <input
                        type="text"
                        value={inviteAlias}
                        onChange={(e) => setInviteAlias(e.target.value)}
                        placeholder="Witness Alias (e.g. Witness A, Engineering Colleague)…"
                        className="field flex-1 text-xs"
                        disabled={submitting || !isAssignedInvestigator}
                      />
                      <button
                        type="submit"
                        disabled={submitting || !isAssignedInvestigator || !inviteAlias.trim()}
                        className="btn btn-primary text-xs"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{submitting ? 'Issuing…' : 'Send Invitation'}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleSendMessage} className="flex gap-2">
                      <input
                        type="text"
                        value={messageText}
                        onChange={(e) => setMessageText(e.target.value)}
                        placeholder="Type confidential context message or inquiry update…"
                        className="field flex-1 text-xs"
                        disabled={submitting}
                      />
                      <button
                        type="submit"
                        disabled={submitting || !messageText.trim()}
                        className="btn btn-primary text-xs"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{submitting ? 'Sending…' : 'Post Message'}</span>
                      </button>
                    </form>
                  )}

                  <p className="text-[0.6875rem] text-muted">
                    Notice: Invitations are hashed and stored in persistent state. Outbound notification delivery is pending external SMTP configuration.
                  </p>
                </div>

                {/* Analytics Row Below Composer */}
                <div className="px-5 py-3 border-t border-line bg-sunken/60 grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                  <div className="rounded-xl border border-line bg-surface p-2 shadow-sm">
                    <p className="text-[0.6875rem] font-medium text-muted">Accepted</p>
                    <p className="text-base font-bold text-teal-700 tabular">{acceptedCount}</p>
                    <p className="text-[0.625rem] text-muted">corroborating</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-2 shadow-sm">
                    <p className="text-[0.6875rem] font-medium text-muted">Declined</p>
                    <p className="text-base font-bold text-slate-700 tabular">{declinedCount}</p>
                    <p className="text-[0.625rem] text-muted">opted out</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-2 shadow-sm">
                    <p className="text-[0.6875rem] font-medium text-muted">Responses Received</p>
                    <p className="text-base font-bold text-brand-700 tabular">{responsesReceived}</p>
                    <p className="text-[0.625rem] text-muted">recorded reply</p>
                  </div>
                  <div className="rounded-xl border border-line bg-surface p-2 shadow-sm">
                    <p className="text-[0.6875rem] font-medium text-muted">Awaiting Reply</p>
                    <p className="text-base font-bold text-orange-700 tabular">{pendingCount}</p>
                    <p className="text-[0.625rem] text-muted">of {invitations.length} invited</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
