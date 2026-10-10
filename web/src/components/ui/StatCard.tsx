import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: React.ReactNode;
  badge?: {
    text: string;
    variant: 'warning' | 'success' | 'info' | 'purple';
  };
  highlight?: boolean;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  badge,
  highlight = false,
  onClick
}: StatCardProps) {
  const badgeClasses = {
    warning: 'bg-amber-100 text-amber-800 border-amber-300',
    success: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    info: 'bg-blue-100 text-blue-800 border-blue-300',
    purple: 'bg-[#FAF5FF] text-[#5B3FA3] border-[#E9D8FD]'
  };

  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`bg-white rounded-3xl p-6 border ${
        highlight
          ? 'border-[#5B3FA3]/40 shadow-md shadow-[#5B3FA3]/5'
          : 'border-stone-100 shadow-sm'
      } ${
        isClickable
          ? 'card-interactive cursor-pointer hover:border-[#5B3FA3]/30 focus:outline-none focus:ring-2 focus:ring-[#5B3FA3]/20'
          : ''
      }`}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-[#777487]">{title}</p>
        {icon && (
          <div className="w-10 h-10 rounded-2xl bg-[#FAF7F5] flex items-center justify-center text-[#5B3FA3]">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-bold tracking-tight text-[#191725]">{value}</span>
        {badge && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${badgeClasses[badge.variant]}`}
          >
            {badge.text}
          </span>
        )}
      </div>

      {subtitle && <p className="mt-1 text-xs text-[#777487]">{subtitle}</p>}
    </div>
  );
}
