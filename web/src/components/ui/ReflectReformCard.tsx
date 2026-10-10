import { useEffect, useState } from 'react';
import { HeartHandshake, EyeOff } from 'lucide-react';
import { ApiService } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { ReflectReformInsights } from '../../types/intelligence';

/** Reflect & Reform: aggregate, anonymous reporter feedback on resolved cases plus committed reform actions.
 *  The backend withholds ratings until enough reporters responded that no rating is attributable. */
export function ReflectReformCard() {
  const { currentUser } = useAuth();
  const [data, setData] = useState<ReflectReformInsights | null>(null);

  useEffect(() => {
    ApiService.getInsights().then((res) => setData(res.success ? res.data ?? null : null));
  }, [currentUser.id]);

  if (!data) return null; // live backend + HR/oversight role only

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-purple-50 flex items-center justify-center text-[#5B3FA3]">
          <HeartHandshake className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-base font-bold text-[#191725]">Reflect & Reform</h3>
          <p className="text-xs text-[#777487]">
            {data.resolvedCases} resolved cases · anonymous reporter feedback on how they were handled
          </p>
        </div>
      </div>

      {data.suppressed ? (
        <div className="p-3 bg-stone-100 rounded-2xl text-xs text-[#777487] flex items-center gap-2">
          <EyeOff className="w-4 h-4" />
          Ratings appear once at least {data.minimumResponses} reporters have responded, so no answer can be traced
          to a person.
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="p-3 bg-[#FAF7F5] rounded-2xl">
            <div className="text-lg font-bold text-[#191725]">{data.averageFairness}/5</div>
            <div className="text-[10px] text-[#777487]">Process felt fair</div>
          </div>
          <div className="p-3 bg-[#FAF7F5] rounded-2xl">
            <div className="text-lg font-bold text-[#191725]">{data.feltSafePct}%</div>
            <div className="text-[10px] text-[#777487]">Felt safe reporting</div>
          </div>
          <div className="p-3 bg-[#FAF7F5] rounded-2xl">
            <div className="text-lg font-bold text-[#191725]">{data.wouldReportAgainPct}%</div>
            <div className="text-[10px] text-[#777487]">Would report again</div>
          </div>
        </div>
      )}

      {data.reformActions.length > 0 && (
        <div className="text-xs">
          <div className="font-bold text-[#191725] mb-1">Reform actions committed</div>
          <div className="flex flex-wrap gap-2">
            {data.reformActions.map((a) => (
              <span key={a.action} className="px-2.5 py-1 rounded-xl bg-purple-50 border border-purple-200 text-[#5B3FA3]">
                {a.action} × {a.count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
