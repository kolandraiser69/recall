import React, { useState } from 'react';

export interface AreaLineChartItem {
  label: string;
  value: number;
  tooltip?: string;
}

export interface AreaLineChartProps {
  data: AreaLineChartItem[];
  height?: number;
  strokeColor?: string;
  className?: string;
  emptyMessage?: string;
}

export const AreaLineChart: React.FC<AreaLineChartProps> = ({
  data,
  height = 180,
  strokeColor = 'var(--accent)',
  className = '',
  emptyMessage = 'No data available for this timeframe',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0 || data.every((d) => d.value === 0)) {
    return (
      <div
        style={{ height }}
        className={`flex items-center justify-center text-xs text-[var(--text-tertiary)] bg-[var(--bg-subtle)] rounded-[var(--radius-md)] ${className}`}
      >
        {emptyMessage}
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const chartHeight = height - 36;
  const svgWidth = 600;
  const paddingX = 20;
  const usableWidth = svgWidth - paddingX * 2;
  const stepX = data.length > 1 ? usableWidth / (data.length - 1) : usableWidth;

  const points = data.map((d, i) => {
    const x = paddingX + i * stepX;
    const y = chartHeight - (d.value / maxValue) * (chartHeight - 24);
    return { x, y, ...d };
  });

  // Construct smooth SVG path
  let pathD = '';
  if (points.length > 0 && points[0]) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      if (p0 && p1) {
        const mx = (p0.x + p1.x) / 2;
        pathD += ` C ${mx} ${p0.y}, ${mx} ${p1.y}, ${p1.x} ${p1.y}`;
      }
    }
  }

  // Construct area fill path by closing down to the bottom
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaD =
    lastPoint && firstPoint
      ? `${pathD} L ${lastPoint.x} ${chartHeight} L ${firstPoint.x} ${chartHeight} Z`
      : '';

  return (
    <div className={`relative w-full ${className}`}>
      {/* Tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="absolute -top-9 left-1/2 -translate-x-1/2 pointer-events-none z-10 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-md text-[11px] font-mono text-[var(--text-primary)] whitespace-nowrap animate-in fade-in zoom-in-95 duration-100">
          {data[hoveredIdx]?.tooltip || `${data[hoveredIdx]?.label}: ${data[hoveredIdx]?.value} reviews`}
        </div>
      )}

      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        className="w-full h-auto overflow-visible"
        style={{ maxHeight: height }}
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Background Grid Lines */}
        {[0, 0.5, 1].map((pct, idx) => {
          const y = chartHeight - pct * (chartHeight - 24);
          const val = Math.round(pct * maxValue);
          return (
            <g key={idx}>
              <line
                x1={paddingX}
                y1={y}
                x2={svgWidth - paddingX}
                y2={y}
                stroke="var(--divider)"
                strokeDasharray="3 3"
                strokeWidth={1}
              />
              <text
                x={paddingX}
                y={y - 3}
                fill="var(--text-tertiary)"
                fontSize={9}
                fontFamily="ui-monospace, monospace"
              >
                {val}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#areaGradient)" />

        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={strokeColor}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Interactive Points and Labels */}
        {points.map((p, idx) => {
          const isHovered = hoveredIdx === idx;
          const showLabel =
            data.length <= 10 ||
            (data.length <= 31 && idx % Math.ceil(data.length / 7) === 0) ||
            idx === 0 ||
            idx === data.length - 1;

          return (
            <g
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className="cursor-pointer"
            >
              <circle
                cx={p.x}
                cy={p.y}
                r={isHovered ? 5.5 : 3}
                fill="var(--bg-surface)"
                stroke={strokeColor}
                strokeWidth={isHovered ? 2.5 : 1.5}
                className="transition-all duration-150"
              />

              {showLabel && (
                <text
                  x={p.x}
                  y={height - 6}
                  textAnchor="middle"
                  fill="var(--text-tertiary)"
                  fontSize={10}
                  className="select-none"
                >
                  {p.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
