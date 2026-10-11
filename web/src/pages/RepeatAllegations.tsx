import { useEffect, useState } from 'react';
import { FileStack, GitCompareArrows, Layers, ShieldAlert, UserRoundSearch } from 'lucide-react';
import { ApiService } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { PatternReport } from '../types/intelligence';
import { PageHeader } from '../components/ui/PageHeader';
import { Notice } from '../components/ui/Notice';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { categoryLabel } from '../lib/format';

interface Cluster {
  id: string;
  kind: 'subject' | 'similar';
  title: string;
  context: string;
  caseRefs: string[];
  measure: string;
  note: string;
}

// Shown only when the live backend is unavailable, and labelled as sample data.
const SAMPLE_CLUSTERS: Cluster[] = [
  {
    id: 'sample-1',
    kind: 'subject',
    title: 'Several reports name the same person',
    context: 'Global Operations & Logistics',
    caseRefs: ['INC-892', 'INC-833'],
    measure: '2 separate reports',
    note: 'Reporters describe rating overrides after raising safety concerns.'
  },
  {
    id: 'sample-2',
    kind: 'similar',
    title: 'Similar incident descriptions',
    context: 'Cloud Infrastructure Group',
    caseRefs: ['INC-650', 'INC-741'],
    measure: 'Similarity 0.71',
    note: 'Both describe compensation bands differing across comparable roles.'
  }
];

interface RepeatAllegationsProps {
  onOpenCase?: (caseId: string) => void;
}

export function RepeatAllegations({ onOpenCase }: RepeatAllegationsProps) {
  const { currentUser } = useAuth();
  const [live, setLive] = useState<PatternReport | null>(null);
  const [state, setState] = useState<'loading' | 'live' | 'sample' | 'forbidden'>('loading');

  // Live: the correlation + repeat-allegation engines over the cases this user may access.
  useEffect(() => {
    setState('loading');
    ApiService.getPatterns().then((res) => {
      if (res.success && res.data) {
        setLive(res.data);
        setState('live');
      } else {
        setLive(null);
        setState(res.status === 403 ? 'forbidden' : 'sample');
      }
    });
  }, [currentUser.id]);

  const clusters: Cluster[] = live
    ? [
        ...live.repeatSubjects.map<Cluster>((r) => ({
          id: r.subjectRef,
          kind: 'subject',
          title: 'Several reports name the same person',
          context: r.categories.map((c) => categoryLabel(c, c)).join(' · '),
          caseRefs: r.caseIds,
          measure: `${r.count} separate reports`,
          note: 'Matched on a structured directory reference chosen by each reporter, never on typed names.'
        })),
        ...live.correlatedPairs.map<Cluster>((p) => ({
          id: p.caseIds.join('+'),
          kind: 'similar',
          title: 'Similar incident descriptions',
          context: `Method: ${p.method}`,
          caseRefs: p.caseIds,
          measure: `Similarity ${p.score.toFixed(2)}`,
          note: live.limitation
        }))
      ]
    : state === 'sample'
      ? SAMPLE_CLUSTERS
      : [];

  const subjects = clusters.filter((c) => c.kind === 'subject');
  const similar = clusters.filter((c) => c.kind === 'similar');

  return (
    <div className="space-y-5">
      <PageHeader
        title="Pattern Intelligence"
        description="Possible links between separate reports, for investigators to look into."
      />

      <Notice tone="warning" title="A pattern is a reason to look, not a finding">
        Reports are never merged because they look alike, and a repeat count does not establish that anything happened.
        Each case still needs independent corroboration.
      </Notice>

      {state === 'loading' && <LoadingState message="Analysing accessible cases" />}
      {state === 'sample' && (
        <Notice tone="neutral" title="Sample data">
          Live pattern analysis needs the backend. The cards below are illustrative examples.
        </Notice>
      )}
      {state === 'forbidden' && (
        <div className="card">
          <EmptyState icon={<ShieldAlert />} title="Not available to your role" description="Pattern analysis is limited to HR and oversight roles." />
        </div>
      )}
      {state === 'live' && clusters.length === 0 && (
        <div className="card">
          <EmptyState icon={<Layers />} title="No patterns found" description="No shared subjects or similar reports among the cases you can access." />
        </div>
      )}

      {clusters.length > 0 && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <ClusterColumn icon={<UserRoundSearch />} title="Same subject" empty="No person is named in more than one report." clusters={subjects} onOpenCase={onOpenCase} />
          <ClusterColumn icon={<GitCompareArrows />} title="Similar descriptions" empty="No reports read as closely similar." clusters={similar} onOpenCase={onOpenCase} />
        </div>
      )}
    </div>
  );
}

function ClusterColumn({
  icon,
  title,
  empty,
  clusters,
  onOpenCase
}: {
  icon: React.ReactNode;
  title: string;
  empty: string;
  clusters: Cluster[];
  onOpenCase?: (id: string) => void;
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div className="flex items-center gap-2 text-brand-600 [&>svg]:h-[18px] [&>svg]:w-[18px]">
        {icon}
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        <span className="chip bg-surface text-muted ring-1 ring-line tabular">{clusters.length}</span>
      </div>
      {clusters.length === 0 ? (
        <p className="card card-pad text-[0.8125rem] text-muted">{empty}</p>
      ) : (
        <ul className="stagger space-y-3">
          {clusters.map((c) => (
            <li key={c.id} className="card card-pad">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-ink">{c.title}</h3>
                  <p className="mt-0.5 text-xs text-muted">{c.context}</p>
                </div>
                <span className="chip bg-attn-50 text-attn-700 tabular">{c.measure}</span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <FileStack className="h-3.5 w-3.5 text-muted" />
                {c.caseRefs.map((ref) => (
                  <button
                    key={ref}
                    onClick={() => onOpenCase?.(ref)}
                    disabled={!onOpenCase}
                    className="case-id rounded-md bg-brand-50 px-2 py-0.5 text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-default"
                  >
                    {ref}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[0.8125rem] text-ink-soft">{c.note}</p>
              <p className="mt-2 text-xs font-semibold text-muted">Needs independent corroboration</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
