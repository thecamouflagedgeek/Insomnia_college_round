import { SeverityLevel } from '../../types/complaint';

interface SeverityBadgeProps {
  severity: SeverityLevel;
  className?: string;
}

export function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  const configs: Record<SeverityLevel, { label: string; bg: string; text: string; dot: string }> = {
    critical: {
      label: 'Critical',
      bg: 'bg-red-50 border border-red-200',
      text: 'text-red-700',
      dot: 'bg-red-500'
    },
    high: {
      label: 'High Priority',
      bg: 'bg-amber-50 border border-amber-200',
      text: 'text-amber-800',
      dot: 'bg-amber-500'
    },
    medium: {
      label: 'Medium',
      bg: 'bg-indigo-50 border border-indigo-200',
      text: 'text-indigo-700',
      dot: 'bg-indigo-500'
    },
    low: {
      label: 'Routine',
      bg: 'bg-slate-50 border border-slate-200',
      text: 'text-slate-600',
      dot: 'bg-slate-400'
    }
  };

  const config = configs[severity] || configs.medium;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} animate-pulse`} />
      {config.label}
    </span>
  );
}
