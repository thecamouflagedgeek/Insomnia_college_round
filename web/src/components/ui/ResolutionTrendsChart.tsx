import { useState } from 'react';
import { TrendingUp, Info } from 'lucide-react';

export interface WeeklyResolutionPoint {
  weekLabel: string;
  startDate: string;
  resolvedCount: number;
}

interface ResolutionTrendsChartProps {
  data?: WeeklyResolutionPoint[];
  isLoading?: boolean;
}

const DEFAULT_WEEKLY_DATA: WeeklyResolutionPoint[] = [
  { weekLabel: 'W36', startDate: 'Sep 01', resolvedCount: 3 },
  { weekLabel: 'W37', startDate: 'Sep 08', resolvedCount: 5 },
  { weekLabel: 'W38', startDate: 'Sep 15', resolvedCount: 4 },
  { weekLabel: 'W39', startDate: 'Sep 22', resolvedCount: 7 },
  { weekLabel: 'W40', startDate: 'Sep 29', resolvedCount: 6 },
  { weekLabel: 'W41', startDate: 'Oct 06', resolvedCount: 8 }
];

export function ResolutionTrendsChart({
  data = DEFAULT_WEEKLY_DATA,
  isLoading = false
}: ResolutionTrendsChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (isLoading) {
    return (
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm text-center py-16">
        <p className="text-xs text-[#777487]">Compiling resolution timeline metrics...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm text-center py-12">
        <h3 className="text-sm font-bold text-[#191725]">No Historical Case Resolution Timestamps</h3>
        <p className="text-xs text-[#777487] mt-1 max-w-sm mx-auto">
          Sufficient weekly procedural conclusion timestamps are not yet logged in the database to plot trend curves.
        </p>
      </div>
    );
  }

  // Calculate SVG dimensions and scale
  const width = 640;
  const height = 180;
  const paddingX = 40;
  const paddingY = 25;

  const maxVal = Math.max(...data.map((d) => d.resolvedCount), 10);
  const minVal = 0;

  const getX = (index: number) => {
    return paddingX + (index / (data.length - 1)) * (width - paddingX * 2);
  };

  const getY = (val: number) => {
    return height - paddingY - ((val - minVal) / (maxVal - minVal)) * (height - paddingY * 2);
  };

  // Build SVG path
  const points = data.map((d, i) => ({ x: getX(i), y: getY(d.resolvedCount) }));
  
  // Smooth curve using cubic beziers
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const cpX1 = current.x + (next.x - current.x) / 2;
    const cpY1 = current.y;
    const cpX2 = current.x + (next.x - current.x) / 2;
    const cpY2 = next.y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
  }

  // Area fill path
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`;

  const totalResolved = data.reduce((acc, curr) => acc + curr.resolvedCount, 0);

  return (
    <div className="bg-white rounded-3xl p-6 border border-stone-100 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-stone-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-[#191725]">Case Resolution Trends</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-[#5B3FA3] border border-purple-200">
              Illustrative 6-Week Aggregate
            </span>
          </div>
          <p className="text-xs text-[#777487] mt-0.5">
            Cases resolved per week • Tracks procedural velocity over time
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] text-[#777487] block uppercase font-bold tracking-wider">
              6-Wk Total Concluded
            </span>
            <span className="text-base font-bold text-[#5B3FA3] flex items-center gap-1 justify-end">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              {totalResolved} Cases
            </span>
          </div>
        </div>
      </div>

      {/* Responsive SVG Chart */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-44 select-none"
        >
          <defs>
            {/* Soft Purple to Peach Gradient Fill */}
            <linearGradient id="purplePeachGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5B3FA3" stopOpacity="0.22" />
              <stop offset="70%" stopColor="#FFD08A" stopOpacity="0.10" />
              <stop offset="100%" stopColor="#FAF7F5" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="lineStrokeGradient" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5B3FA3" />
              <stop offset="100%" stopColor="#7952D2" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 2, 4, 6, 8, 10].map((tick) => {
            const y = getY(tick);
            return (
              <g key={tick}>
                <line
                  x1={paddingX}
                  y1={y}
                  x2={width - paddingX}
                  y2={y}
                  stroke="#EFECE9"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={paddingX - 10}
                  y={y + 3}
                  textAnchor="end"
                  fill="#777487"
                  fontSize="10"
                  fontFamily="inherit"
                >
                  {tick}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#purplePeachGradient)" />

          {/* Stroke Line with initial drawing micro-animation */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#lineStrokeGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              strokeDasharray: 600,
              strokeDashoffset: 0,
              animation: 'chartLineDraw 550ms cubic-bezier(0.16, 1, 0.3, 1) forwards'
            }}
          />

          {/* Data Points */}
          {points.map((pt, idx) => {
            const item = data[idx];
            const isHovered = hoveredIndex === idx;

            return (
              <g key={idx} className="cursor-pointer">
                {/* Invisible hover target */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r="14"
                  fill="transparent"
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />

                {/* Outer Ring */}
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={isHovered ? 6 : 4}
                  fill="#FFFFFF"
                  stroke="#5B3FA3"
                  strokeWidth={isHovered ? 3 : 2}
                  className="transition-all duration-150"
                />

                {/* Inner peach dot on hover */}
                {isHovered && (
                  <circle cx={pt.x} cy={pt.y} r="2.5" fill="#FFD08A" />
                )}

                {/* X-axis Label */}
                <text
                  x={pt.x}
                  y={height - 6}
                  textAnchor="middle"
                  fill={isHovered ? '#191725' : '#777487'}
                  fontWeight={isHovered ? 'bold' : 'normal'}
                  fontSize="10"
                  fontFamily="inherit"
                >
                  {item.weekLabel}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover Tooltip Overlay */}
        {hoveredIndex !== null && (
          <div
            className="absolute bg-[#191725] text-white px-3 py-1.5 rounded-xl text-xs font-mono shadow-xl pointer-events-none transform -translate-x-1/2 -translate-y-full transition-all"
            style={{
              left: `${(points[hoveredIndex].x / width) * 100}%`,
              top: `${(points[hoveredIndex].y / height) * 100}%`
            }}
          >
            <div className="font-sans font-bold text-[11px] text-[#FFD08A]">
              {data[hoveredIndex].weekLabel} ({data[hoveredIndex].startDate})
            </div>
            <div className="text-xs">
              <strong>{data[hoveredIndex].resolvedCount}</strong> cases resolved
            </div>
          </div>
        )}
      </div>

      {/* Disclaimers & Meaning */}
      <div className="pt-2 border-t border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-[#777487] gap-2">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span>
            <strong>Procedural Notice:</strong> &quot;Resolved&quot; denotes case closure via mediation, policy reform, or dismissal; it does not imply misconduct substantiation.
          </span>
        </span>
        <span className="font-mono text-stone-400 shrink-0">Derived from Case Logs (Demo Mode)</span>
      </div>
    </div>
  );
}
