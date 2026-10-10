import { Complaint } from '../../types/complaint';
import { SeverityBadge } from '../ui/SeverityBadge';
import { StatusBadge } from '../ui/StatusBadge';
import { Shield, Lock, ArrowUpRight, Clock, FileText } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface ComplaintTableProps {
  complaints: Complaint[];
  onSelectComplaint: (complaint: Complaint) => void;
}

export function ComplaintTable({ complaints, onSelectComplaint }: ComplaintTableProps) {
  const { currentUser } = useAuth();

  const formatCategory = (cat: string) => {
    switch (cat) {
      case 'bullying_authority_abuse':
        return 'Bullying & Retaliation';
      case 'sexual_harassment':
        return 'Sexual Harassment';
      case 'discrimination':
        return 'Discrimination';
      case 'whistleblowing_bribery':
        return 'Bribery & Whistleblowing';
      default:
        return 'Misconduct';
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-stone-100 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-stone-100 bg-[#FAF7F5]/60 text-[11px] font-bold text-[#777487] uppercase tracking-wider">
              <th className="py-4 px-5">Case Identifier</th>
              <th className="py-4 px-4">Allegation Category</th>
              <th className="py-4 px-4">Severity</th>
              <th className="py-4 px-4">Case Status</th>
              <th className="py-4 px-4">Anonymous Token</th>
              <th className="py-4 px-4">Filed Timestamp</th>
              <th className="py-4 px-4">Next Investigative Action</th>
              <th className="py-4 px-5 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 text-xs">
            {complaints.map((item) => {
              const isRevoked = item.revokedMemberIds.includes(currentUser.id);

              return (
                <tr
                  key={item.id}
                  onClick={() => onSelectComplaint(item)}
                  className={`hover:bg-[#FAF7F5]/80 transition-colors cursor-pointer group ${
                    isRevoked ? 'bg-red-50/40 opacity-75' : ''
                  }`}
                >
                  {/* Case ID */}
                  <td className="py-4 px-5">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-xl bg-purple-50 flex items-center justify-center text-[#5B3FA3] font-mono font-bold text-xs">
                        <FileText className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="font-mono font-bold text-[#191725] group-hover:text-[#5B3FA3] transition-colors">
                          {item.id}
                        </span>
                        {isRevoked && (
                          <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-800">
                            <Lock className="w-2.5 h-2.5" />
                            REVOKED
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-4 px-4 font-medium text-[#191725]">
                    {formatCategory(item.category)}
                  </td>

                  {/* Severity */}
                  <td className="py-4 px-4">
                    <SeverityBadge severity={item.severity} />
                  </td>

                  {/* Status */}
                  <td className="py-4 px-4">
                    <StatusBadge status={item.status} />
                  </td>

                  {/* Anonymous Token */}
                  <td className="py-4 px-4 font-mono text-[#777487] text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <Shield className="w-3 h-3 text-[#5B3FA3]" />
                      <span>{item.anonymousToken}</span>
                    </div>
                  </td>

                  {/* Timestamp */}
                  <td className="py-4 px-4 text-[#777487] whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-stone-400" />
                      <span>{new Date(item.submittedAt).toLocaleDateString()}</span>
                    </div>
                  </td>

                  {/* Next Action */}
                  <td className="py-4 px-4 max-w-xs truncate text-[#777487]">
                    <span className="font-medium text-[#191725]">{item.requiredNextAction}</span>
                  </td>

                  {/* Action Link */}
                  <td className="py-4 px-5 text-right">
                    <button className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-stone-100 hover:bg-[#5B3FA3] text-[#777487] hover:text-white transition-colors">
                      <ArrowUpRight className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
