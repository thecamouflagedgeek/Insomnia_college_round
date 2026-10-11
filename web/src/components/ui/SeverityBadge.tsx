import { SeverityLevel } from '../../types/complaint';

const CONFIG: Record<SeverityLevel, { label: string; cls: string; dot: string }> = {
  critical: { label: 'Critical', cls: 'bg-danger-50 text-danger-700', dot: 'bg-danger-500' },
  high: { label: 'High', cls: 'bg-attn-50 text-attn-700', dot: 'bg-attn-500' },
  medium: { label: 'Medium', cls: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
  low: { label: 'Low', cls: 'bg-sunken text-muted', dot: 'bg-[#a19cb6]' }
};

/** Triage severity from the backend's severity engine; a review cue, not a finding. */
export function SeverityBadge({ severity, className = '' }: { severity: SeverityLevel; className?: string }) {
  const c = CONFIG[severity] ?? CONFIG.medium;
  return (
    <span className={`chip ${c.cls} ${className}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}
