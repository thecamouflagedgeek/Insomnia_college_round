import React, { useState } from 'react';
import { Sidebar, NavPage } from './Sidebar';
import { Navbar } from './Navbar';
import { ApiSecurityModal } from './ApiSecurityModal';

interface DashboardLayoutProps {
  currentPage: NavPage;
  onNavigate: (page: NavPage) => void;
  pendingChallengesCount?: number;
  children: React.ReactNode;
}

export function DashboardLayout({
  currentPage,
  onNavigate,
  pendingChallengesCount = 1,
  children
}: DashboardLayoutProps) {
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#FAF7F5] font-sans antialiased text-[#191725]">
      {/* 1. Fixed Left Sidebar (Full viewport height, independent nav scroll) */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={onNavigate}
        pendingChallengesCount={pendingChallengesCount}
      />

      {/* 2. Main Content Canvas (Offset by rounded floating sidebar, scrolls independently) */}
      <div className="md:pl-[280px] flex flex-col min-h-screen min-w-0 pr-2">
        <div className="relative z-50">
          <Navbar
            currentPage={currentPage}
            onOpenApiDebugger={() => setIsApiModalOpen(true)}
            pendingNotificationCount={pendingChallengesCount}
          />
        </div>

        {/* 3. Main Page Body with smooth entry animation */}
        <main key={currentPage} className="flex-1 px-4 pt-2 pb-6 min-w-0 page-enter relative z-0">
          {children}
        </main>
      </div>

      {/* Development / Judge Security API Testing Modal */}
      <ApiSecurityModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
      />
    </div>
  );
}
