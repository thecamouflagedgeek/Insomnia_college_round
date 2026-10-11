import { Complaint } from '../../types/complaint';

interface CaseSelectProps {
  cases: Complaint[];
  value: string;
  onChange: (id: string) => void;
  label?: string;
  loading?: boolean;
}

/** Case picker used by pages that work on one case at a time (witnesses, inbox). */
export function CaseSelect({ cases, value, onChange, label = 'Case', loading = false }: CaseSelectProps) {
  return (
    <label className="flex w-full min-w-0 flex-col gap-1 sm:w-80">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <select
        className="field font-medium"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={loading || cases.length === 0}
      >
        {loading && <option>Loading cases…</option>}
        {!loading && cases.length === 0 && <option>No cases available</option>}
        {cases.map((c) => (
          <option key={c.id} value={c.id}>
            {c.id} · {c.title}
          </option>
        ))}
      </select>
    </label>
  );
}
