import { FolderOpen } from 'lucide-react';
import { WitnessQuorumPanel } from '../components/investigation/WitnessQuorumPanel';
import { useAccessibleCases } from '../hooks/useAccessibleCases';
import { PageHeader } from '../components/ui/PageHeader';
import { CaseSelect } from '../components/ui/CaseSelect';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';

export function WitnessQuorumPage() {
  const { cases, selectedCaseId, setSelectedCaseId, loading } = useAccessibleCases();

  return (
    <div className="space-y-5">
      <PageHeader
        title="Witness Quorum"
        description="Invite colleagues to corroborate voluntarily and anonymously. Participation is protected from retaliation."
        actions={<CaseSelect cases={cases} value={selectedCaseId} onChange={setSelectedCaseId} loading={loading} />}
      />
      {loading ? (
        <LoadingState message="Loading cases" />
      ) : selectedCaseId ? (
        <WitnessQuorumPanel complaintId={selectedCaseId} />
      ) : (
        <div className="card">
          <EmptyState icon={<FolderOpen />} title="No cases for your role" description="Witness invitations are managed per case. Cases appear once you are assigned to one." />
        </div>
      )}
    </div>
  );
}
