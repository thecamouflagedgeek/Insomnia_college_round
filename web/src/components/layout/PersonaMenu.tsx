import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, RotateCcw, Terminal } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { ROLE_LABEL } from '../../lib/people';
import { Avatar } from '../ui/Avatar';

interface PersonaMenuProps {
  onOpenApiDebugger: () => void;
}

/** Demo persona switcher (stands in for login). Access rules are enforced by the backend for each persona. */
export function PersonaMenu({ onOpenApiDebugger }: PersonaMenuProps) {
  const { currentUser, allUsers, switchUser, resetDemoState } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-2.5 transition-colors hover:border-brand-200 hover:bg-brand-50"
      >
        <Avatar src={currentUser.avatar} name={currentUser.name} size={32} />
        <span className="hidden min-w-0 text-left lg:block">
          <span className="block max-w-[9rem] truncate text-[0.8125rem] font-semibold leading-tight text-ink">
            {currentUser.name}
          </span>
          <span className="block text-[0.6875rem] leading-tight text-muted">{ROLE_LABEL[currentUser.role]}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
        <span className="sr-only">Switch demo persona</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-[60] mt-2 w-[min(20rem,calc(100vw-2rem))] origin-top-right animate-pop rounded-2xl border border-line bg-surface p-2 shadow-[var(--shadow-pop)]"
        >
          <div className="px-3 pb-2 pt-1.5">
            <p className="text-[0.8125rem] font-semibold text-ink">Demo personas</p>
            <p className="text-xs text-muted">The backend applies each role's access rules.</p>
          </div>
          <div className="space-y-0.5">
            {allUsers.map((u) => {
              const current = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  role="menuitemradio"
                  aria-checked={current}
                  onClick={() => {
                    switchUser(u.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                    current ? 'bg-brand-50' : 'hover:bg-sunken'
                  }`}
                >
                  <Avatar src={u.avatar} name={u.name} size={30} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-semibold text-ink">{u.name}</span>
                    <span className="block truncate text-xs text-muted">{ROLE_LABEL[u.role]}</span>
                  </span>
                  {current && <Check className="h-4 w-4 shrink-0 text-brand-600" />}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line px-1 pt-2">
            <button
              role="menuitem"
              onClick={() => {
                onOpenApiDebugger();
                setOpen(false);
              }}
              className="btn btn-ghost btn-sm"
            >
              <Terminal />
              API shell
            </button>
            <button
              role="menuitem"
              onClick={() => {
                if (confirm('Reset the in-browser demo data to its initial state?')) {
                  resetDemoState();
                  setOpen(false);
                  window.location.reload();
                }
              }}
              className="btn btn-sm bg-transparent text-muted hover:bg-danger-50 hover:text-danger-700"
            >
              <RotateCcw />
              Reset demo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
