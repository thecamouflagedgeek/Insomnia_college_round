import { useState } from 'react';
import { useAutoRefresh } from '../../hooks/useAutoRefresh';
import { EyeOff, HeartHandshake } from 'lucide-react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { ReflectReformInsights } from '../../types/intelligence';
import { Section } from './Section';
import { SkeletonRows } from './Skeleton';
import { EmptyState } from './EmptyState';

/** Reflect & Reform: aggregate, anonymous reporter feedback on resolved cases plus committed reform actions.
 *  The backend withholds ratings until enough reporters responded that no rating is attributable. */
export function ReflectReformCard() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<ReflectReformInsights | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'unavailable' | 'forbidden'>('loading');

  const load = async (silent = false, isCurrent = () => true) => {
    if (!silent) setState('loading');
    const res = await ApiService.getInsights();
    if (!isCurrent()) return;
    if (res.success && res.data) {
      setData(res.data);
      setState('ok');
    } else {
      setData(null);
      setState(res.status === 403 ? 'forbidden' : 'unavailable');
    }
  };

  useAutoRefresh((isCurrent, initial) => load(!initial, isCurrent), [currentUser.id]);

  return (
    <Section
      className="h-full"
      icon={<HeartHandshake />}
      title="Reflect & Reform"
      description={
        data
          ? `${data.resolvedCases} resolved case${data.resolvedCases === 1 ? '' : 's'} · anonymous reporter feedback` : 'Anonymous reporter feedback on resolved cases'
      }
    >
      {state === 'loading' && <SkeletonRows rows={2} label="Loading insights" />}
      {state === 'unavailable' && (
        <EmptyState compact icon={<HeartHandshake />} title="Needs the live backend" description="Feedback insights are computed by the backend and are not part of the demo data." />
      )}
      {state === 'forbidden' && (
        <EmptyState compact icon={<EyeOff />} title="Not visible to your role" description="Insights are limited to HR and oversight roles." />
      )}
      {state === 'ok' && data && (
        <div className="space-y-4">
          {data.suppressed ? (
            <div className="flex items-start gap-2.5 rounded-xl bg-sunken p-3 text-[0.8125rem] text-ink-soft">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              <span>
                Ratings appear once at least {data.minimumResponses} reporters have responded, so no answer can be traced to a person.
              </span>
            </div>
          ) : (
            <dl className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: 'Felt fair', value: `${data.averageFairness}/5` },
                { label: 'Felt safe', value: `${data.feltSafePct}%` },
                { label: 'Would report again', value: `${data.wouldReportAgainPct}%` }
              ].map((m) => (
                <div key={m.label} className="rounded-xl bg-sunken px-2 py-3">
                  <dd className="text-lg font-bold text-ink tabular">{m.value}</dd>
                  <dt className="mt-0.5 text-[0.6875rem] text-muted">{m.label}</dt>
                </div>
              ))}
            </dl>
          )}
          <div>
            <h3 className="text-xs font-semibold text-ink-soft">Reform actions committed</h3>
            {data.reformActions.length === 0 ? (
              <p className="mt-1 text-[0.8125rem] text-muted">None recorded yet.</p>
            ) : (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {data.reformActions.map((a) => (
                  <li key={a.action} className="chip bg-brand-50 text-brand-700">
                    {a.action}
                    <span className="tabular text-brand-500">× {a.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
