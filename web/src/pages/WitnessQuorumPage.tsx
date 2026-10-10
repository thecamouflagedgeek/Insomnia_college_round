import { WitnessQuorumPanel } from '../components/investigation/WitnessQuorumPanel';
import { useAccessibleCases } from '../hooks/useAccessibleCases';

export function WitnessQuorumPage() {
  const { cases, selectedCaseId, setSelectedCaseId } = useAccessibleCases();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#191725]">Witness Quorum Oversight</h1>
          <p className="text-xs text-[#777487] mt-1">
            Voluntary, anonymous corroboration management • Protected under Whistleblower Non-Retaliation Policy
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-[#777487]">Select Case Docket:</span>
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
        <WitnessQuorumPanel complaintId={selectedCaseId} />
      ) : (
        <p className="text-xs text-[#777487]">No cases available for your role.</p>
      )}
    </div>
  );
}
