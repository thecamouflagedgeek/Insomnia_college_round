import { ComplaintCategory, SeverityLevel, ComplaintStatus } from '../../types/complaint';
import { Search } from 'lucide-react';

interface ComplaintFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (cat: string) => void;
  selectedSeverity: string;
  onSeverityChange: (sev: string) => void;
  selectedStatus: string;
  onStatusChange: (stat: string) => void;
}

export function ComplaintFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedSeverity,
  onSeverityChange,
  selectedStatus,
  onStatusChange
}: ComplaintFiltersProps) {
  const categories: { label: string; value: string }[] = [
    { label: 'All Misconduct Types', value: 'all' },
    { label: 'Bullying & Authority Abuse', value: 'bullying_authority_abuse' },
    { label: 'Sexual Harassment', value: 'sexual_harassment' },
    { label: 'Discrimination', value: 'discrimination' },
    { label: 'Whistleblowing & Bribery', value: 'whistleblowing_bribery' }
  ];

  const severities: { label: string; value: string }[] = [
    { label: 'All Severities', value: 'all' },
    { label: 'Critical Only', value: 'critical' },
    { label: 'High Priority', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Routine', value: 'low' }
  ];

  const statuses: { label: string; value: string }[] = [
    { label: 'All Case States', value: 'all' },
    { label: 'Under Challenge ⚠️', value: 'under_challenge' },
    { label: 'Investigation Active', value: 'investigation_active' },
    { label: 'Committee Assigned', value: 'committee_assigned' }
  ];

  return (
    <div className="bg-white rounded-3xl p-5 mb-6 border border-stone-100 shadow-sm flex flex-col md:flex-row items-center gap-3">
      {/* Search Input */}
      <div className="relative flex-1 w-full">
        <Search className="w-4 h-4 text-[#777487] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by Case ID, Category, Anonymous Token..."
          className="w-full bg-[#FAF7F5] border border-stone-200/80 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#191725] placeholder-[#777487] focus:outline-none focus:border-[#5B3FA3] transition-colors"
        />
      </div>

      {/* Category Dropdown */}
      <select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-full md:w-auto bg-[#FAF7F5] border border-stone-200/80 rounded-2xl px-3.5 py-2.5 text-xs text-[#191725] font-medium focus:outline-none focus:border-[#5B3FA3]"
      >
        {categories.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      {/* Severity Dropdown */}
      <select
        value={selectedSeverity}
        onChange={(e) => onSeverityChange(e.target.value)}
        className="w-full md:w-auto bg-[#FAF7F5] border border-stone-200/80 rounded-2xl px-3.5 py-2.5 text-xs text-[#191725] font-medium focus:outline-none focus:border-[#5B3FA3]"
      >
        {severities.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      {/* Status Dropdown */}
      <select
        value={selectedStatus}
        onChange={(e) => onStatusChange(e.target.value)}
        className="w-full md:w-auto bg-[#FAF7F5] border border-stone-200/80 rounded-2xl px-3.5 py-2.5 text-xs text-[#191725] font-medium focus:outline-none focus:border-[#5B3FA3]"
      >
        {statuses.map((st) => (
          <option key={st.value} value={st.value}>
            {st.label}
          </option>
        ))}
      </select>
    </div>
  );
}
