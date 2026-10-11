import { useEffect, useRef, useState } from 'react';
import { Lock, MessageSquare, RefreshCw, Send } from 'lucide-react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { Notice } from '../ui/Notice';
import { EmptyState } from '../ui/EmptyState';
import { SkeletonRows } from '../ui/Skeleton';
import { formatDateTime } from '../../lib/format';

interface InvestigationInboxProps {
  complaintId: string;
}

type Message = { id: string; sender: string; text: string; timestamp: string; isEncrypted: boolean };

export function InvestigationInbox({ complaintId }: InvestigationInboxProps) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);

  const loadMessages = async () => {
    setAccessError(null);
    const res = await ApiService.getMessages(complaintId);
    if (res.success && res.data) setMessages(res.data);
    else {
      setMessages([]);
      setAccessError(res.error || 'You do not have access to messages for this case.');
    }
  };

  useEffect(() => {
    setMessages(null);
    setSendError(null);
    loadMessages();
  }, [complaintId, currentUser.id]);

  useEffect(() => {
    const el = streamRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text) return;
    setSending(true);
    setSendError(null);
    const res = await ApiService.sendMessage(complaintId, text);
    setSending(false);
    if (res.success) {
      setInputText('');
      loadMessages();
    } else {
      // Keep the draft so nothing is lost.
      setSendError(res.error || 'The message was not sent.');
    }
  };

  if (accessError) {
    return (
      <div className="card card-pad">
        <EmptyState icon={<Lock />} title="This channel isn't open to you" description={accessError} />
      </div>
    );
  }

  return (
    <section className="card flex h-[min(640px,calc(100vh-13rem))] min-h-[420px] flex-col" aria-label={`Messages for ${complaintId}`}>
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-ink">
            Anonymous reporter · <span className="case-id text-brand-700">{complaintId}</span>
          </h2>
          <p className="text-xs text-muted">The reporter replies from the INCOGNITO app. Their identity is never shown here.</p>
        </div>
        <button className="icon-btn h-9 w-9 shrink-0" onClick={loadMessages} aria-label="Refresh messages" title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </button>
      </header>

      <div ref={streamRef} className="flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite">
        {messages === null ? (
          <SkeletonRows rows={3} label="Loading messages" />
        ) : messages.length === 0 ? (
          <EmptyState compact icon={<MessageSquare />} title="No messages yet" description="Start the conversation. The reporter sees your message in the app." />
        ) : (
          messages.map((m) => {
            const mine = m.sender.includes(currentUser.name);
            return (
              <div key={m.id} className={`flex animate-enter flex-col ${mine ? 'items-end' : 'items-start'}`}>
                <p className="mb-1 text-[0.6875rem] text-muted">
                  <span className="font-semibold text-ink-soft">{m.sender}</span> · {formatDateTime(m.timestamp)}
                </p>
                <p
                  className={`max-w-[min(34rem,85%)] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-[0.8125rem] leading-relaxed ${
                    mine ? 'rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md bg-sunken text-ink'
                  }`}
                >
                  {m.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="border-t border-line px-5 py-4">
        {sendError && <Notice tone="danger" role="alert" className="mb-3">{sendError}</Notice>}
        <div className="flex items-end gap-2">
          <label className="flex-1">
            <span className="sr-only">Message</span>
            <textarea
              rows={1}
              className="field max-h-32 min-h-[2.75rem] resize-none py-2.5"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={`Reply as ${currentUser.name}`}
            />
          </label>
          <button type="submit" className="btn btn-primary h-[2.75rem]" disabled={sending || !inputText.trim()}>
            {sending ? <RefreshCw className="animate-spin" /> : <Send />}
            <span className="hidden sm:inline">{sending ? 'Sending…' : 'Send'}</span>
          </button>
        </div>
        <p className="mt-1.5 text-[0.6875rem] text-muted">Enter to send · Shift+Enter for a new line · Every message is recorded in the Silent Audit.</p>
      </form>
    </section>
  );
}
