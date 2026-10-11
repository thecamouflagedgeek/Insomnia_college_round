import { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { NavPage, pageFromHash, hashFor } from './components/layout/nav';
import { ApiService } from './services/api';
import { Complaint } from './types/complaint';

// Active Pages
import { Dashboard } from './pages/Dashboard';
import { Reports } from './pages/Reports';
import { ReportDetails } from './pages/ReportDetails';
import { CommitteeManagement } from './pages/CommitteeManagement';
import { WitnessQuorumPage } from './pages/WitnessQuorumPage';
import { InvestigationInboxPage } from './pages/InvestigationInboxPage';
import { RepeatAllegations } from './pages/RepeatAllegations';

function AppContent() {
  const { currentUser } = useAuth();
  // The hash carries the page (and case id) so a refresh or shared link reopens the same view.
  const initial = pageFromHash(window.location.hash);
  const [currentPage, setCurrentPage] = useState<NavPage>(initial.page);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(initial.caseId ?? '');

  const firstSync = useRef(true);
  useEffect(() => {
    const target = hashFor(currentPage, selectedCaseId);
    if (window.location.hash !== target) {
      // Normalise the landing URL in place; later moves get their own history entry for Back.
      window.history[firstSync.current ? 'replaceState' : 'pushState'](null, '', target);
    }
    firstSync.current = false;
  }, [currentPage, selectedCaseId]);

  useEffect(() => {
    const onPop = () => {
      const next = pageFromHash(window.location.hash);
      setCurrentPage(next.page);
      if (next.caseId) setSelectedCaseId(next.caseId);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Start on the newest case this user can access (live ids replace the mock's INC-892).
  useEffect(() => {
    ApiService.getReports().then((res) => {
      const first = res.data?.[0]?.id;
      if (first) setSelectedCaseId((cur) => cur || first);
    });
  }, [currentUser.id]);
  const [pendingChallengesCount, setPendingChallengesCount] = useState<number>(0);

  // Monitor challenges to update badge dynamically
  useEffect(() => {
    ApiService.getChallenges().then((res) => {
      if (res.data) {
        const pending = res.data.filter((c) => c.status === 'pending_independent_review').length;
        setPendingChallengesCount(pending);
      }
    });
  }, [currentUser.id, currentPage]);

  const handleNavigate = (page: NavPage, caseId?: string) => {
    if (caseId) setSelectedCaseId(caseId);
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'reports':
        return (
          <Reports
            onSelectComplaint={(complaint: Complaint) => {
              setSelectedCaseId(complaint.id);
              setCurrentPage('report_details');
            }}
          />
        );
      case 'report_details':
        return (
          <ReportDetails
            complaintId={selectedCaseId}
            onBack={() => setCurrentPage('reports')}
            onNavigate={handleNavigate}
          />
        );
      case 'committee':
        return <CommitteeManagement onOpenCase={(id) => handleNavigate('report_details', id)} />;
      case 'witness':
        return <WitnessQuorumPage />;
      case 'inbox':
        return <InvestigationInboxPage />;
      case 'repeat_allegations':
        return <RepeatAllegations onOpenCase={(id) => handleNavigate('report_details', id)} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <DashboardLayout
      currentPage={currentPage}
      onNavigate={handleNavigate}
      pendingChallengesCount={pendingChallengesCount}
    >
      {renderPage()}
    </DashboardLayout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
