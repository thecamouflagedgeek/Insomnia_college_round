import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { DashboardLayout } from './components/layout/DashboardLayout';
import { NavPage } from './components/layout/Sidebar';
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
  const [currentPage, setCurrentPage] = useState<NavPage>('dashboard');
  const [selectedCaseId, setSelectedCaseId] = useState<string>('');

  // Start on the newest case this user can access (live ids replace the mock's INC-892).
  useEffect(() => {
    ApiService.getReports().then((res) => {
      const first = res.data?.[0]?.id;
      if (first) setSelectedCaseId((cur) => cur || first);
    });
  }, [currentUser.id]);
  const [pendingChallengesCount, setPendingChallengesCount] = useState<number>(1);

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
        return <CommitteeManagement />;
      case 'witness':
        return <WitnessQuorumPage />;
      case 'inbox':
        return <InvestigationInboxPage />;
      case 'repeat_allegations':
        return <RepeatAllegations />;
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
