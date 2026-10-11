import React, { useState, useEffect } from 'react';
import { List, Paperclip, Image as ImageIcon, Send, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { ApiService } from '../../services/api';

interface ShareIncidentDetailsCardProps {
  complaintId: string;
  onSubmitted?: () => void;
}

export function ShareIncidentDetailsCard({ complaintId, onSubmitted }: ShareIncidentDetailsCardProps) {
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [recentSubmissions, setRecentSubmissions] = useState<Array<{ id: string; text: string; timestamp: string }>>([]);

  useEffect(() => {
    let active = true;
    ApiService.getMessages(complaintId).then((res) => {
      if (active && res.success && res.data) {
        const mapped = res.data.map((m) => ({
          id: m.id,
          text: m.text,
          timestamp: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }));
        setRecentSubmissions(mapped);
      }
    });
    return () => {
      active = false;
    };
  }, [complaintId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = details.trim();
    if (!trimmed) {
      setError('Please enter incident details, witness observations, or evidence.');
      return;
    }
    if (submitting) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await ApiService.sendMessage(complaintId, trimmed);
      if (res.success && res.data) {
        setSuccessMessage('Incident details recorded securely in the case dossier and audit log.');
        setRecentSubmissions((prev) => [
          {
            id: res.data!.id,
            text: trimmed,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          },
          ...prev
        ]);
        setDetails('');
        onSubmitted?.();
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        setError(res.error || 'Failed to submit incident details. Please retry.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to submit incident details.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="card card-pad space-y-4">
      <div>
        <h3 className="text-base font-semibold text-ink">Share Incident Details</h3>
        <p className="text-xs text-muted">Provide additional information or observations to update case data.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative rounded-2xl border border-line bg-surface p-2 shadow-inner focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
          <textarea
            value={details}
            onChange={(e) => {
              setDetails(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={handleKeyDown}
            rows={4}
            className="w-full resize-none bg-transparent px-2.5 py-1.5 text-sm text-ink placeholder:text-muted focus:outline-none"
            placeholder="Type incident details, witnesses, or evidence here..."
            disabled={submitting}
          />

          <div className="mt-2 flex items-center justify-between border-t border-line/60 pt-2 px-1">
            <div className="flex items-center gap-1 text-muted">
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sunken hover:text-ink transition-colors"
                title="Formatting options"
                onClick={() => setDetails((prev) => (prev ? prev + '\n• ' : '• '))}
              >
                <List className="h-4 w-4" />
                <span className="sr-only">List formatting</span>
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sunken hover:text-ink transition-colors"
                title="Attach evidence reference"
                onClick={() => setDetails((prev) => prev + ' [Attached reference document]')}
              >
                <Paperclip className="h-4 w-4" />
                <span className="sr-only">Attach file</span>
              </button>
              <button
                type="button"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-sunken hover:text-ink transition-colors"
                title="Attach image/screenshot reference"
                onClick={() => setDetails((prev) => prev + ' [Attached image reference]')}
              >
                <ImageIcon className="h-4 w-4" />
                <span className="sr-only">Upload image</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting || !details.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              {submitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Submitting…</span>
                </>
              ) : (
                <>
                  <span>Send Details</span>
                  <Send className="h-3.5 w-3.5" />
                </>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div role="alert" className="flex items-center gap-2 rounded-xl border border-danger-100 bg-danger-50 px-3 py-2 text-xs font-medium text-danger-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div role="status" className="flex items-center gap-2 rounded-xl border border-teal-100 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-800">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600" />
            <span>{successMessage}</span>
          </div>
        )}

        {recentSubmissions.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-semibold text-ink-soft mb-1.5">Submitted observations on this case:</p>
            <ul className="space-y-1.5">
              {recentSubmissions.map((s) => (
                <li key={s.id} className="rounded-xl bg-sunken px-3 py-2 text-xs text-ink">
                  <div className="flex items-center justify-between text-muted text-[0.6875rem] mb-0.5">
                    <span className="font-medium text-brand-700">Observation logged</span>
                    <span>{s.timestamp}</span>
                  </div>
                  <p className="text-ink-soft">{s.text}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </form>
    </div>
  );
}
