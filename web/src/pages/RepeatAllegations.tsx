import { useState } from 'react';
import { Layers, AlertTriangle, ShieldAlert, CheckCircle, Search } from 'lucide-react';

export function RepeatAllegations() {
  const [filterDepartment, setFilterDepartment] = useState('all');

  const clusters = [
    {
      id: 'CLUST-01',
      patternTitle: 'Recurring Retaliation Following Safety & Regulatory Reporting',
      department: 'Global Operations & Logistics',
      complaintsCount: 2,
      caseRefs: ['INC-892', 'INC-833 (Prior Year Archive)'],
      severityRating: 'Elevated Risk Pattern',
      independentFindingStatus: 'Under Active Corroboration',
      notes: 'Multiple independent reporters report rating overrides following disclosures concerning logistics safety standards.'
    },
    {
      id: 'CLUST-02',
      patternTitle: 'Compensation Band Disparities Across Demographics',
      department: 'Cloud Infrastructure Group',
      complaintsCount: 1,
      caseRefs: ['INC-650'],
      severityRating: 'Systemic Statistical Disparity',
      independentFindingStatus: 'Independent HR Compensation Audit Initiated',
      notes: 'Anonymized CSV data indicates variance across promotion speed cohorts.'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-[#191725]">Pattern Intelligence & Repeat Allegations</h1>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-100 text-[#5B3FA3] font-bold">
            Restricted to Authorized Investigators
          </span>
        </div>
        <p className="text-xs text-[#777487] mt-1">
          Cluster analysis of anonymized complaints across business units • Mitigates siloed misconduct blindness
        </p>
      </div>

      {/* Ethical Safeguard Banner */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-3xl text-xs text-amber-900 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong>Fundamental Investigative Principle:</strong> A report&apos;s existence is not proof of guilt.
          Separate complaints must not be merged merely because they appear similar, and repeat allegation
          counts do not establish liability. All inquiries require independent corroboration.
        </div>
      </div>

      {/* Pattern Clusters */}
      <div className="space-y-4">
        {clusters.map((cluster) => (
          <div
            key={cluster.id}
            className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-stone-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-[#5B3FA3]">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[#191725]">{cluster.patternTitle}</h3>
                  <p className="text-xs text-[#777487]">{cluster.department}</p>
                </div>
              </div>

              <span className="px-3 py-1 bg-amber-100 text-amber-900 border border-amber-300 rounded-full text-xs font-bold self-start">
                {cluster.severityRating}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-[#FAF7F5] rounded-2xl border border-stone-200/80">
                <span className="text-[10px] text-[#777487] block">Correlated Dossiers</span>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap font-mono font-bold text-[#5B3FA3]">
                  {cluster.caseRefs.map((ref) => (
                    <span key={ref} className="bg-white px-2 py-0.5 rounded border border-stone-200">
                      {ref}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-[#FAF7F5] rounded-2xl border border-stone-200/80">
                <span className="text-[10px] text-[#777487] block">Corroboration Status</span>
                <span className="font-bold text-[#191725] mt-1 block">
                  {cluster.independentFindingStatus}
                </span>
              </div>

              <div className="p-3 bg-[#FAF7F5] rounded-2xl border border-stone-200/80">
                <span className="text-[10px] text-[#777487] block">Investigative Finding</span>
                <span className="text-[#191725] mt-1 block leading-tight">
                  {cluster.notes}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
