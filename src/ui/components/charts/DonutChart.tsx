import React, { useState } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  centerTitle?: string;
  centerSubtitle?: string;
  className?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  size = 180,
  thickness = 22,
  centerTitle,
  centerSubtitle,
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`mx-auto rounded-full border-4 border-dashed border-[var(--border-subtle)] flex flex-col items-center justify-center text-center p-3 ${className}`}
      >
        <span className="text-xs text-[var(--text-tertiary)]">No reviews yet</span>
      </div>
    );
  }

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let cumulativeOffset = 0;

  return (
    <div className={`flex flex-col sm:flex-row items-center justify-center gap-6 ${className}`}>
      {/* SVG Donut */}
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          {segments.map((seg, idx) => {
            const fraction = seg.value / total;
            const strokeDasharray = `${fraction * circumference} ${circumference}`;
            const strokeDashoffset = -cumulativeOffset * circumference;
            cumulativeOffset += fraction;
            const isHovered = hoveredIdx === idx;

            return (
              <circle
                key={idx}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="transparent"
                stroke={seg.color}
                strokeWidth={isHovered ? thickness + 4 : thickness}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
              />
            );
          })}
        </svg>

        {/* Centered Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
            {hoveredIdx !== null && segments[hoveredIdx]
              ? `${Math.round((segments[hoveredIdx]!.value / total) * 100)}%`
              : centerTitle || total}
          </span>
          <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
            {hoveredIdx !== null && segments[hoveredIdx]
              ? segments[hoveredIdx]!.label
              : centerSubtitle || 'Reviews'}
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs w-full sm:w-auto">
        {segments.map((seg, idx) => {
          const pct = Math.round((seg.value / total) * 100);
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`flex items-center gap-2 p-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                isHovered ? 'bg-[var(--bg-subtle)]' : ''
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="font-medium text-[var(--text-primary)] truncate max-w-[100px]">
                {seg.label}
              </span>
              <span className="text-[var(--text-secondary)] font-mono ml-auto text-[11px]">
                {seg.value} <span className="text-[var(--text-tertiary)]">({pct}%)</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
