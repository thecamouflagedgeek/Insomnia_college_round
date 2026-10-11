import React from 'react';
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, Lock } from 'lucide-react';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'locked';

const TONES: Record<Tone, { box: string; icon: React.ReactNode }> = {
  info: { box: 'bg-brand-50 text-brand-800 border-brand-100', icon: <Info /> },
  success: { box: 'bg-teal-50 text-teal-700 border-teal-100', icon: <CheckCircle2 /> },
  warning: { box: 'bg-attn-50 text-attn-700 border-attn-100', icon: <AlertTriangle /> },
  danger: { box: 'bg-danger-50 text-danger-700 border-danger-100', icon: <OctagonAlert /> },
  neutral: { box: 'bg-sunken text-ink-soft border-line', icon: <Info /> },
  locked: { box: 'bg-sunken text-ink-soft border-line', icon: <Lock /> }
};

interface NoticeProps {
  tone?: Tone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  role?: 'status' | 'alert';
}

/** Inline message for guidance, results and errors. Never used to fake an outcome. */
export function Notice({ tone = 'info', title, children, action, className = '', role }: NoticeProps) {
  const t = TONES[tone];
  return (
    <div
      role={role}
      className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 text-[0.8125rem] leading-relaxed sm:flex-row sm:items-center ${t.box} ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-2.5">
        <span className="mt-0.5 shrink-0 [&>svg]:h-4 [&>svg]:w-4">{t.icon}</span>
        <div className="min-w-0">
          {title && <p className="font-semibold">{title}</p>}
          {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
