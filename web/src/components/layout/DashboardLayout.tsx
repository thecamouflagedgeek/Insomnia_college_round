import React from 'react';
import { TopBar } from './TopBar';
import { NavPage } from './nav';
import { useBackendStatus } from '../../hooks/useBackendStatus';

interface DashboardLayoutProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  pendingChallengesCount?: number;
  children: React.ReactNode;
}

export function DashboardLayout({ currentPage, onNavigate, pendingChallengesCount = 0, children }: DashboardLayoutProps) {
  const backendStatus = useBackendStatus();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main"
        className="sr-only z-50 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <TopBar
        currentPage={currentPage}
        onNavigate={onNavigate}
        pendingChallengesCount={pendingChallengesCount}
        backendStatus={backendStatus}
      />
      <main id="main" key={currentPage} className="mx-auto max-w-[1440px] animate-enter px-4 pb-12 pt-3 sm:px-6">
        {children}
      </main>
    </div>
  );
}
