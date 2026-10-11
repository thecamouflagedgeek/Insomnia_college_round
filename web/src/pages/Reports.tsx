import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useState } from 'react';
import { FolderOpen, RefreshCw, SearchX } from 'lucide-react';
import { Complaint } from '../types/complaint';
import { ApiService } from '../services/api';
import { ComplaintTable } from '../components/complaints/ComplaintTable';
import { ComplaintFilters } from '../components/complaints/ComplaintFilters';
import { PageHeader } from '../components/ui/PageHeader';
import { Notice } from '../components/ui/Notice';
import { EmptyState } from '../components/ui/EmptyState';
import { SkeletonRows } from '../components/ui/Skeleton';
import { useAuth } from '../hooks/useAuth';

interface ReportsProps {
  onSelectComplaint: (complaint: Complaint) => void;
}

export function Reports({ onSelectComplaint }: ReportsProps) {
  const { currentUser } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const loadReports = async (silent = false, isCurrent = () => true) => {
    if (!silent) { setLoading(true); setComplaints([]); }
    const res = await ApiService.getReports();
    if (!isCurrent()) return;
    setError(res.success ? null : res.error || 'Could not load complaints.');
    setComplaints(res.success ? res.data ?? [] : []);
    setLoading(false);
  };
  useAutoRefresh((isCurrent, initial) => loadReports(!initial, isCurrent), [currentUser.id]);

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedSeverity('all');
    setSelectedStatus('all');
  };

  const filtered = complaints.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (q && ![c.id, c.anonymousToken, c.title].some((v) => v.toLowerCase().includes(q))) return false;
    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && c.severity !== selectedSeverity) return false;
    if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Complaints Queue"
        description="Anonymous reports you are authorised to see. Reporter identities are never shown; tokens are case-specific."
        actions={
          <button className="btn btn-secondary btn-sm" onClick={() => void loadReports()} disabled={loading}>
            <RefreshCw className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        }
      />

      {currentUser.role === 'committee_member' && (
        <Notice tone="locked">Committee members see only the cases they are seated on.</Notice>
      )}

      <section className="card card-pad space-y-4" aria-label="Complaints">
        <ComplaintFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          selectedSeverity={selectedSeverity}
          onSeverityChange={setSelectedSeverity}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          onClear={clearFilters}
        />

        {!loading && !error && (
          <p className="text-xs text-muted" aria-live="polite">
            Showing <span className="font-semibold text-ink tabular">{filtered.length}</span> of{' '}
            <span className="tabular">{complaints.length}</span> cases
          </p>
        )}

        {loading ? (
          <SkeletonRows rows={6} label="Loading complaints" />
        ) : error ? (
          <Notice
            tone="danger"
            role="alert"
            title="Complaints could not be loaded"
            action={
              <button className="btn btn-secondary btn-sm" onClick={() => void loadReports()}>
                <RefreshCw />
                Retry
              </button>
            }
          >
            {error}
          </Notice>
        ) : complaints.length === 0 ? (
          <EmptyState icon={<FolderOpen />} title="No cases for your role" description="Cases appear here once you are assigned to them, or when new reports arrive." />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title="No cases match these filters"
            description="Try a different search or clear the filters."
            action={<button className="btn btn-secondary btn-sm" onClick={clearFilters}>Clear filters</button>}
          />
        ) : (
          <ComplaintTable complaints={filtered} onSelectComplaint={onSelectComplaint} />
        )}
      </section>
    </div>
  );
}
