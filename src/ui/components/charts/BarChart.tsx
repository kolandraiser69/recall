import React, { useState } from 'react';

export interface BarChartItem {
  label: string;
  value: number;
  tooltip?: string;
}

export interface BarChartProps {
  data: BarChartItem[];
  height?: number;
  barColor?: string;
  className?: string;
  emptyMessage?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 180,
  barColor = 'var(--accent)',
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
  const chartHeight = height - 40; // reserve space for x-axis labels
  const svgWidth = 600;
  const paddingX = 16;
  const usableWidth = svgWidth - paddingX * 2;
  const barWidth = Math.max(4, Math.min(24, (usableWidth / data.length) * 0.7));
  const gap = usableWidth / data.length;

  return (
    <div className={`relative w-full ${className}`}>
      {/* Tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div
          className="absolute -top-9 left-1/2 -translate-x-1/2 pointer-events-none z-10 px-2.5 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-md text-[11px] font-mono text-[var(--text-primary)] whitespace-nowrap animate-in fade-in zoom-in-95 duration-100"
        >
          {data[hoveredIdx]?.tooltip || `${data[hoveredIdx]?.label}: ${data[hoveredIdx]?.value} reviews`}
        </div>
      )}

      <svg
        viewBox={`0 0 ${svgWidth} ${height}`}
        className="w-full h-auto overflow-visible"
        style={{ maxHeight: height }}
      >
        {/* Background Grid Lines */}
        {[0, 0.5, 1].map((pct, idx) => {
          const y = chartHeight - pct * (chartHeight - 16);
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

        {/* Bars */}
        {data.map((item, idx) => {
          const barHeight = Math.max(2, (item.value / maxValue) * (chartHeight - 20));
          const x = paddingX + idx * gap + (gap - barWidth) / 2;
          const y = chartHeight - barHeight;
          const isHovered = hoveredIdx === idx;

          // Determine label display frequency based on item count
          const showLabel =
            data.length <= 10 ||
            (data.length <= 31 && idx % Math.ceil(data.length / 7) === 0) ||
            idx === 0 ||
            idx === data.length - 1;

          return (
            <g key={idx} onMouseEnter={() => setHoveredIdx(idx)} onMouseLeave={() => setHoveredIdx(null)}>
              {/* Invisible touch/hover target */}
              <rect
                x={paddingX + idx * gap}
                y={0}
                width={gap}
                height={chartHeight}
                fill="transparent"
                className="cursor-pointer"
              />

              {/* Visible Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx={barWidth / 3}
                fill={barColor}
                opacity={isHovered ? 1 : 0.85}
                className="transition-all duration-150"
              />

              {/* X-axis Label */}
              {showLabel && (
                <text
                  x={x + barWidth / 2}
                  y={height - 8}
                  textAnchor="middle"
                  fill="var(--text-tertiary)"
                  fontSize={10}
                  className="select-none"
                >
                  {item.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
