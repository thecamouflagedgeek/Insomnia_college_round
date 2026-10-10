import { useState } from 'react';
import { WitnessQuorumPanel } from '../components/investigation/WitnessQuorumPanel';

export function WitnessQuorumPage() {
  const [selectedCaseId, setSelectedCaseId] = useState('INC-892');

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
            <option value="INC-892">Case INC-892 (Operations Retaliation)</option>
            <option value="INC-741">Case INC-741 (Executive BD Misconduct)</option>
          </select>
        </div>
      </div>

      <WitnessQuorumPanel complaintId={selectedCaseId} />
    </div>
  );
}
