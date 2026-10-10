import { useState, useEffect } from 'react';
import { Complaint } from '../types/complaint';
import { ApiService } from '../services/api';
import { ComplaintTable } from '../components/complaints/ComplaintTable';
import { ComplaintFilters } from '../components/complaints/ComplaintFilters';
import { useAuth } from '../hooks/useAuth';
import { FolderGit2, ShieldAlert } from 'lucide-react';

interface ReportsProps {
  onSelectComplaint: (complaint: Complaint) => void;
}

export function Reports({ onSelectComplaint }: ReportsProps) {
  const { currentUser } = useAuth();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const loadReports = async () => {
    setLoading(true);
    const res = await ApiService.getReports();
    if (res.data) setComplaints(res.data);
    setLoading(false);
  };

  useEffect(() => {
    loadReports();
  }, [currentUser.id]);

  // Client-side filter evaluation
  const filteredComplaints = complaints.filter((c) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = c.id.toLowerCase().includes(q);
      const matchToken = c.anonymousToken.toLowerCase().includes(q);
      const matchTitle = c.title.toLowerCase().includes(q);
      if (!matchId && !matchToken && !matchTitle) return false;
    }

    if (selectedCategory !== 'all' && c.category !== selectedCategory) return false;
    if (selectedSeverity !== 'all' && c.severity !== selectedSeverity) return false;
    if (selectedStatus !== 'all' && c.status !== selectedStatus) return false;

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-[#191725]">Authorized Complaints Roster</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-[#5B3FA3] font-bold">
              {filteredComplaints.length} Accessible
            </span>
          </div>
          <p className="text-xs text-[#777487] mt-1">
            Privacy-Preserved Case Roster • Zero employee names revealed • Protected under Whistleblower Protocol
          </p>
        </div>

        {currentUser.role === 'committee_member' && (
          <div className="text-xs px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-700" />
            <span>Committee member access restricted to explicitly assigned dockets.</span>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <ComplaintFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        selectedSeverity={selectedSeverity}
        onSeverityChange={setSelectedSeverity}
        selectedStatus={selectedStatus}
        onStatusChange={setSelectedStatus}
      />

      {/* Complaints Table */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-stone-100 text-xs text-[#777487]">
          Retrieving authorized case dockets...
        </div>
      ) : filteredComplaints.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-stone-100 text-xs text-[#777487]">
          No complaints match current filters or authorization scope.
        </div>
      ) : (
        <ComplaintTable
          complaints={filteredComplaints}
          onSelectComplaint={onSelectComplaint}
        />
      )}
    </div>
  );
}
