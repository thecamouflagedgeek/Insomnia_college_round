import { AlertTriangle } from 'lucide-react';
import { SeverityLevel } from '../../types/complaint';

interface SeverityBadgeProps {
  severity: SeverityLevel;
  className?: string;
}

/** Restrained, professional severity badge: consistent pill dimensions without artificial glowing shadows or decorative dots */
export function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  if (severity === 'critical') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#b91c1c] px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-white ring-1 ring-inset ring-red-900/20 ${className}`}
      >
        <AlertTriangle className="h-3 w-3 shrink-0 stroke-[2.2]" />
        CRITICAL
      </span>
    );
  }

  if (severity === 'high') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#c2410c] px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-white ring-1 ring-inset ring-orange-900/20 ${className}`}
      >
        <AlertTriangle className="h-3 w-3 shrink-0 stroke-[2.2]" />
        HIGH
      </span>
    );
  }

  if (severity === 'medium') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#b45309] px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-white ring-1 ring-inset ring-amber-900/20 ${className}`}
      >
        <AlertTriangle className="h-3 w-3 shrink-0 stroke-[2]" />
        MEDIUM
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#475569] px-2.5 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-white ring-1 ring-inset ring-slate-800/20 ${className}`}
    >
      LOW
    </span>
  );
}

