import { useState, useRef, useEffect } from 'react';
import {
  Bell,
  ChevronDown,
  RotateCcw,
  Terminal,
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { NavPage } from './Sidebar';

interface NavbarProps {
  currentPage: NavPage;
  onOpenApiDebugger: () => void;
  pendingNotificationCount?: number;
}

const PAGE_NAMES: Record<NavPage, string> = {
  dashboard: 'Overview',
  reports: 'Complaints Queue',
  report_details: 'Case Dossier',
  committee: 'Committee Management',
  witness: 'Witness Quorum',
  inbox: 'Investigation Inbox',
  repeat_allegations: 'Pattern Intelligence',
  email_notices: 'Controlled Notices'
};

export function Navbar({
  currentPage,
  onOpenApiDebugger,
  pendingNotificationCount = 1
}: NavbarProps) {
  const { currentUser, allUsers, switchUser, resetDemoState } = useAuth();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click or Escape key
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isDropdownOpen]);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'hr_reviewer':
        return { label: 'HR Reviewer', bg: 'bg-purple-100 text-purple-800' };
      case 'assigned_investigator':
        return { label: 'Investigator', bg: 'bg-blue-100 text-blue-800' };
      case 'committee_member':
        return { label: 'Committee Member', bg: 'bg-amber-100 text-amber-800' };
      case 'independent_reviewer':
        return { label: 'Independent Ombuds', bg: 'bg-emerald-100 text-emerald-800' };
      default:
        return { label: 'Administrator', bg: 'bg-stone-100 text-stone-800' };
    }
  };

  const badge = getRoleBadge(currentUser.role);
  const pageName = PAGE_NAMES[currentPage] || 'Dashboard';

  return (
    <header className="relative z-50 bg-white/90 backdrop-blur-md border border-white/70 rounded-3xl m-4 mb-2 px-6 py-3.5 shadow-sm flex items-center justify-between transition-all">
      {/* Left side: OG Signature Greeting Pill with radar dot + Page Badge matching reference */}
      <div className="flex items-center gap-3">
        {/* Welcome Pill matching reference */}
        <div className="inline-flex items-center gap-2.5 px-4 py-2 bg-[#FAF7F5] border border-stone-200/80 rounded-full shadow-inner">
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#5B3FA3] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#5B3FA3]"></span>
          </span>
          <span className="text-xs font-semibold text-[#191725]">
            Welcome, <span className="text-[#5B3FA3] font-bold">{currentUser.name}</span>
          </span>
        </div>

        {/* Page Context Badge */}
        <div className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-purple-50/80 border border-purple-200/60 rounded-full text-[11px] font-bold text-[#5B3FA3]">
          <Sparkles className="w-3 h-3 text-[#FFD08A]" />
          <span>{pageName}</span>
        </div>

        {/* Role Badge */}
        <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${badge.bg}`}>
          {badge.label}
        </span>
      </div>

      {/* Right side: Persona Switcher, Notifications & User Avatar */}
      <div className="flex items-center gap-3" ref={dropdownRef}>
        {/* Persona Switcher Pill */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white border border-stone-200 hover:border-[#5B3FA3]/50 rounded-2xl text-xs font-medium text-[#191725] transition-all shadow-sm btn-interactive"
            title="Switch Persona to test real access control policies"
            aria-expanded={isDropdownOpen}
          >
            <span className="text-[#777487] text-[11px] hidden md:inline">Persona:</span>
            <span className="font-bold text-[#5B3FA3]">{currentUser.name.split(' ')[0]}</span>
            <ChevronDown className="w-3.5 h-3.5 text-[#777487]" />
          </button>

          {/* Persona Switcher Dropdown */}
          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-stone-200/90 p-2 z-[100] dropdown-enter">
              <div className="px-3 py-2 border-b border-stone-100">
                <p className="text-xs font-bold text-[#191725]">Test Access Control Personas</p>
                <p className="text-[10px] text-[#777487]">
                  Verify how permissions shift when role or challenge status changes
                </p>
              </div>

              <div className="mt-1 space-y-1">
                {allUsers.map((user) => {
                  const uBadge = getRoleBadge(user.role);
                  const isCurrent = user.id === currentUser.id;

                  return (
                    <button
                      key={user.id}
                      onClick={() => {
                        switchUser(user.id);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-colors ${
                        isCurrent
                          ? 'bg-[#FAF5FF] border border-[#5B3FA3]/20'
                          : 'hover:bg-stone-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-7 h-7 rounded-full object-cover"
                        />
                        <div>
                          <p className="text-xs font-bold text-[#191725]">{user.name}</p>
                          <p className="text-[10px] text-[#777487] truncate max-w-[130px]">
                            {user.title}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${uBadge.bg}`}>
                          {uBadge.label}
                        </span>
                        {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 text-[#5B3FA3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Utility Tools */}
              <div className="mt-2 pt-2 border-t border-stone-100 flex items-center justify-between px-1">
                <button
                  onClick={() => {
                    onOpenApiDebugger();
                    setIsDropdownOpen(false);
                  }}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#5B3FA3] hover:bg-[#FAF7F5] rounded-xl transition-colors"
                >
                  <Terminal className="w-3.5 h-3.5 text-[#FFD08A]" />
                  <span>API Shell</span>
                </button>

                <button
                  onClick={() => {
                    if (confirm('Reset demo state back to initial submission?')) {
                      resetDemoState();
                      setIsDropdownOpen(false);
                      window.location.reload();
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-stone-500 hover:text-red-600 rounded-xl transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Demo</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            className="p-2 text-[#777487] hover:text-[#5B3FA3] hover:bg-[#FAF7F5] rounded-xl transition-all btn-interactive"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>
          {pendingNotificationCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#FFD08A] rounded-full ring-2 ring-white" />
          )}
        </div>

        {/* User Profile Avatar Pill matching reference */}
        <div className="flex items-center gap-2 pl-2 border-l border-stone-200">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-[#5B3FA3]/20"
          />
          <div className="hidden lg:block text-left">
            <p className="text-xs font-bold text-[#191725] leading-none">{currentUser.name}</p>
            <p className="text-[10px] text-[#777487] leading-none mt-1">{currentUser.email}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
