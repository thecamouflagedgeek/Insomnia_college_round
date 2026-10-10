import {
  LayoutDashboard,
  FolderGit2,
  Users,
  Radio,
  MessageSquare,
  Layers,
  Shield
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export type NavPage =
  | 'dashboard'
  | 'reports'
  | 'report_details'
  | 'committee'
  | 'witness'
  | 'inbox'
  | 'repeat_allegations';

interface SidebarProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  pendingChallengesCount?: number;
}

export function Sidebar({
  currentPage,
  onNavigate,
  pendingChallengesCount = 1
}: SidebarProps) {
  const { currentUser } = useAuth();

  const navItems = [
    { id: 'dashboard' as NavPage, label: 'Overview', icon: LayoutDashboard },
    { id: 'reports' as NavPage, label: 'Complaints Queue', icon: FolderGit2 },
    {
      id: 'committee' as NavPage,
      label: 'Committee Management',
      icon: Users,
      badge: pendingChallengesCount > 0 ? `${pendingChallengesCount}` : undefined,
      badgeColor: 'bg-[#FFD08A] text-[#191725] font-bold'
    },
    { id: 'witness' as NavPage, label: 'Witness Quorum', icon: Radio },
    { id: 'inbox' as NavPage, label: 'Investigation Inbox', icon: MessageSquare },
    { id: 'repeat_allegations' as NavPage, label: 'Pattern Intelligence', icon: Layers }
  ];

  return (
    <aside
      className="fixed top-4 left-4 bottom-4 w-64 bg-[#5B3FA3] text-white flex flex-col z-40 select-none shadow-2xl rounded-3xl border border-white/10 overflow-hidden"
      aria-label="Application Navigation"
    >
      {/* Top Header & Branding (Fixed at top of rounded sidebar) */}
      <div className="flex-shrink-0 px-5 pt-6 pb-5 border-b border-white/10 bg-[#493184]/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm border border-white/20 shrink-0">
            <Shield className="w-5 h-5 text-[#FFD08A]" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black tracking-wider text-white leading-tight">
              INCOGNITO
            </h1>
            <p className="text-[10px] text-purple-200 tracking-tight font-medium uppercase truncate">
              Workplace Justice & Oversight
            </p>
          </div>
        </div>
      </div>

      {/* Middle Navigation Items (Independently Scrollable with smooth pill highlights) */}
      <nav className="flex-1 min-h-0 overflow-y-auto px-3.5 py-4 space-y-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            currentPage === item.id ||
            (item.id === 'reports' && currentPage === 'report_details');

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl text-xs font-semibold transition-all duration-150 relative ${
                isActive
                  ? 'bg-white/20 text-white shadow-inner font-bold backdrop-blur-sm'
                  : 'text-purple-200 hover:text-white hover:bg-white/10'
              }`}
            >
              {isActive && (
                <span className="absolute left-1.5 top-2.5 bottom-2.5 w-1 bg-[#FFD08A] rounded-full" />
              )}
              <div className="flex items-center gap-3 min-w-0 pl-1.5">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive ? 'text-[#FFD08A]' : 'text-purple-300'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] shrink-0 font-bold ${
                    item.badgeColor || 'bg-white/20 text-white'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Anchored Bottom Footer (Profile card anchored cleanly at bottom of rounded capsule) */}
      <div className="flex-shrink-0 p-4 border-t border-white/10 bg-[#493184]/50 backdrop-blur-sm">
        <div className="flex items-center gap-2.5">
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-8 h-8 rounded-full object-cover ring-2 ring-[#FFD08A]/40 shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white truncate leading-tight">
              {currentUser.name}
            </p>
            <p className="text-[10px] text-purple-200 truncate mt-0.5 capitalize">
              {currentUser.role.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
