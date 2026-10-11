import { BackendStatus } from '../../hooks/useBackendStatus';

/** States plainly whether the screen shows the live backend or in-browser demo data. */
export function DataSourceBadge({ status }: { status: BackendStatus }) {
  const cfg = {
    checking: { label: 'Connecting…', cls: 'bg-sunken text-muted', dot: 'bg-dot', title: 'Checking the backend' },
    live: { label: 'Live backend', cls: 'bg-teal-50 text-teal-700', dot: 'bg-teal-500', title: 'Data comes from the INCOGNITO backend' },
    demo: {
      label: 'Demo data',
      cls: 'bg-warn-50 text-warn-700',
      dot: 'bg-warn-600',
      title: 'Backend unreachable or mock forced: showing in-browser demo data'
    }
  }[status];
  return (
    <span className={`chip ${cfg.cls}`} title={cfg.title} role="status">
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}
