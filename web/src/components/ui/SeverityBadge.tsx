import { AlertTriangle } from 'lucide-react';
import { SeverityLevel } from '../../types/complaint';

interface SeverityBadgeProps {
  severity: SeverityLevel;
  className?: string;
}

/** Redesigned severity badge: prominent solid pills with outer glow for critical & high */
export function SeverityBadge({ severity, className = '' }: SeverityBadgeProps) {
  if (severity === 'critical') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#c81e1e] px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-white shadow-[0_0_12px_rgba(220,38,38,0.7)] ring-1 ring-red-400/40 ${className}`}
      >
        <AlertTriangle className="h-3 w-3 shrink-0 stroke-[2.5]" />
        CRITICAL
      </span>
    );
  }

  if (severity === 'high') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#ea580c] px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-white shadow-[0_0_10px_rgba(234,88,12,0.6)] ring-1 ring-orange-400/40 ${className}`}
      >
        <AlertTriangle className="h-3 w-3 shrink-0 stroke-[2.5]" />
        HIGH
      </span>
    );
  }

  if (severity === 'medium') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full bg-[#d97706] px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-white shadow-[0_0_8px_rgba(217,119,6,0.35)] ring-1 ring-amber-400/40 ${className}`}
      >
        <AlertTriangle className="h-3 w-3 shrink-0 stroke-[2.2]" />
        MEDIUM
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-[#64748b] px-3 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-white ring-1 ring-slate-400/40 ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-200" />
      LOW
    </span>
  );
}

