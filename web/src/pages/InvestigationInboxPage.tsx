import { InvestigationInbox } from '../components/investigation/InvestigationInbox';
import { useAccessibleCases } from '../hooks/useAccessibleCases';

export function InvestigationInboxPage() {
  const { cases, selectedCaseId, setSelectedCaseId } = useAccessibleCases();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#191725]">Investigation Messaging Hub</h1>
          <p className="text-xs text-[#777487] mt-1">
            Zero-Knowledge blinded communication between Assigned Investigator and Anonymous Reporter
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#777487]">Case Channel:</span>
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="bg-white border border-stone-200 text-xs font-bold text-[#191725] rounded-xl px-3 py-1.5 focus:outline-none focus:border-[#5B3FA3] shadow-sm"
          >
            {cases.map((c) => (
              <option key={c.id} value={c.id}>
                Case {c.id} ({c.title})
              </option>
            ))}
          </select>
        </div>
      </div>

      {selectedCaseId ? (
        <InvestigationInbox complaintId={selectedCaseId} />
      ) : (
        <p className="text-xs text-[#777487]">No case channels available for your role.</p>
      )}
    </div>
  );
}
