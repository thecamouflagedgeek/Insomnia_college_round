import { Search, X } from 'lucide-react';
import { CATEGORY_LABEL, STATUS_LABEL } from '../../lib/format';

interface ComplaintFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  selectedSeverity: string;
  onSeverityChange: (sev: string) => void;
  selectedStatus: string;
  onStatusChange: (stat: string) => void;
  onClear: () => void;
}

const SEVERITIES = [
  { label: 'All severities', value: 'all' },
  { label: 'Critical', value: 'critical' },
  { label: 'High', value: 'high' },
  { label: 'Medium', value: 'medium' },
  { label: 'Low', value: 'low' }
];

export function ComplaintFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedSeverity,
  onSeverityChange,
  selectedStatus,
  onStatusChange,
  onClear
}: ComplaintFiltersProps) {
  const active = Boolean(searchQuery.trim()) || selectedCategory !== 'all' || selectedSeverity !== 'all' || selectedStatus !== 'all';

  return (
    <div role="search" className="flex flex-col gap-2.5 lg:flex-row lg:items-center">
      <label className="relative min-w-0 flex-1">
        <span className="sr-only">Search complaints</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search case ID, title or reporter token"
          className="field pl-10"
        />
      </label>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 lg:flex">
        <label>
          <span className="sr-only">Category</span>
          <select className="field lg:w-52" value={selectedCategory} onChange={(e) => onCategoryChange(e.target.value)}>
            <option value="all">All categories</option>
            {Object.entries(CATEGORY_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Severity</span>
          <select className="field lg:w-40" value={selectedSeverity} onChange={(e) => onSeverityChange(e.target.value)}>
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select className="field lg:w-48" value={selectedStatus} onChange={(e) => onStatusChange(e.target.value)}>
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
      </div>
      {active && (
        <button className="btn btn-ghost btn-sm self-start lg:self-auto" onClick={onClear}>
          <X />
          Clear
        </button>
      )}
    </div>
  );
}
