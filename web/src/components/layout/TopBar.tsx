import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Bell, Menu, X } from 'lucide-react';
import { NAV_ITEMS, NavPage, PAGE_TITLE, activeNavId } from './nav';
import { PersonaMenu } from './PersonaMenu';
import { DataSourceBadge } from '../ui/DataSourceBadge';
import { BackendStatus } from '../../hooks/useBackendStatus';

interface TopBarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  pendingChallengesCount: number;
  backendStatus: BackendStatus;
  onOpenApiDebugger: () => void;
}

function Wordmark() {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-[0_4px_10px_-4px_rgb(79_51_184/0.7)]">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2.5 4 5.8v5.4c0 5 3.4 9.3 8 10.3 4.6-1 8-5.3 8-10.3V5.8L12 2.5Z" />
          <path d="M8.5 12.5h7" />
        </svg>
      </span>
      <span className="hidden text-[0.95rem] font-extrabold tracking-[0.08em] text-ink sm:inline">INCOGNITO</span>
    </span>
  );
}

export function TopBar({ currentPage, onNavigate, pendingChallengesCount, backendStatus, onOpenApiDebugger }: TopBarProps) {
  const active = activeNavId(currentPage);
  const [menuOpen, setMenuOpen] = useState(false);

  // Sliding active pill for the desktop tab group.
  const groupRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const el = groupRef.current?.querySelector<HTMLElement>(`[data-nav="${active}"]`);
      if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => window.removeEventListener('resize', measure);
  }, [active]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const go = (page: NavPage) => {
    setMenuOpen(false);
    onNavigate(page);
  };

  return (
    <header className="sticky top-0 z-40 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-[1440px] items-center gap-3 px-4 sm:px-6">
        <button
          className="icon-btn xl:hidden"
          onClick={() => setMenuOpen((o) => !o)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
        >
          {menuOpen ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
        </button>

        <button onClick={() => go('dashboard')} className="shrink-0 rounded-xl" aria-label="INCOGNITO overview">
          <Wordmark />
        </button>

        <span className="ml-1 hidden truncate text-sm font-semibold text-ink-soft sm:inline xl:hidden">
          <span className="text-line-strong" aria-hidden="true">/ </span>
          {PAGE_TITLE[currentPage]}
        </span>

        {/* Desktop tab group with sliding active pill */}
        <nav aria-label="Primary" className="mx-auto hidden xl:block">
          <div ref={groupRef} className="relative flex items-center gap-1 rounded-full border border-line bg-surface p-1 shadow-[var(--shadow-card)]">
            {pill && (
              <span
                aria-hidden="true"
                className="absolute bottom-1 top-1 rounded-full bg-brand-600 shadow-[0_4px_12px_-4px_rgb(79_51_184/0.6)] transition-[transform,width] duration-300 ease-[var(--ease-out-expo)]"
                style={{ left: 0, width: pill.w, transform: `translateX(${pill.x}px)` }}
              />
            )}
            {NAV_ITEMS.map((item) => {
              const isActive = item.id === active;
              const badge = item.id === 'committee' && pendingChallengesCount > 0 ? pendingChallengesCount : null;
              return (
                <button
                  key={item.id}
                  data-nav={item.id}
                  onClick={() => go(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  title={item.label}
                  className={`relative z-10 flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.8125rem] font-semibold transition-colors duration-200 ${
                    isActive ? 'text-white' : 'text-ink-soft hover:text-brand-700'
                  }`}
                >
                  {item.short}
                  {badge !== null && (
                    <span
                      className={`flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[0.625rem] font-bold tabular ${
                        isActive ? 'bg-white text-brand-700' : 'bg-attn-500 text-white'
                      }`}
                      aria-label={`${badge} pending`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="ml-auto flex items-center gap-2 xl:ml-0">
          <DataSourceBadge status={backendStatus} />
          <button
            className="icon-btn relative"
            onClick={() => go('committee')}
            aria-label={
              pendingChallengesCount > 0
                ? `${pendingChallengesCount} committee challenge${pendingChallengesCount > 1 ? 's' : ''} awaiting independent review`
                : 'No committee challenges awaiting review'
            }
            title="Committee challenges awaiting review"
          >
            <Bell className="h-[18px] w-[18px]" />
            {pendingChallengesCount > 0 && (
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-attn-500 ring-2 ring-surface" />
            )}
          </button>
          <PersonaMenu onOpenApiDebugger={onOpenApiDebugger} />
        </div>
      </div>

      {/* Compact navigation below xl */}
      {menuOpen && (
        <>
          <div className="fixed inset-0 top-[4.5rem] z-30 bg-night/25 backdrop-enter xl:hidden" onClick={() => setMenuOpen(false)} />
          <nav
            id="mobile-nav"
            aria-label="Primary"
            className="absolute inset-x-3 top-[4.25rem] z-40 animate-pop rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-pop)] sm:left-6 sm:right-auto sm:w-80 xl:hidden"
          >
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === active;
              const badge = item.id === 'committee' && pendingChallengesCount > 0 ? pendingChallengesCount : null;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                    isActive ? 'bg-brand-600 text-white' : 'text-ink-soft hover:bg-brand-50 hover:text-brand-700'
                  }`}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  {badge !== null && (
                    <span className={`chip ${isActive ? 'bg-white text-brand-700' : 'bg-attn-500 text-white'}`}>{badge}</span>
                  )}
                </button>
              );
            })}
          </nav>
        </>
      )}
    </header>
  );
}
