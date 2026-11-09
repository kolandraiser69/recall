import React, { useState } from 'react';
import type { HeatmapDay } from '../../../services/statisticsService';

export interface ActivityHeatmapProps {
  days: HeatmapDay[];
  currentStreak?: number;
  longestStreak?: number;
  className?: string;
}

export const ActivityHeatmap: React.FC<ActivityHeatmapProps> = ({
  days,
  currentStreak = 0,
  longestStreak = 0,
  className = '',
}) => {
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  // Group days into 7 rows (Sunday: 0 to Saturday: 6 or Monday: 1 to Sunday: 0)
  // Let's organize into weeks (columns of 7 days)
  const weeks: HeatmapDay[][] = [];
  let currentWeek: HeatmapDay[] = [];

  // Align the first day with its day of week
  if (days.length > 0 && days[0]) {
    const firstDate = new Date(days[0].date);
    const dayOfWeek = firstDate.getDay(); // 0 is Sunday
    // Pad initial empty slots if starting mid-week
    for (let i = 0; i < dayOfWeek; i++) {
      currentWeek.push({
        date: '',
        count: 0,
        intensity: 0,
        durationMs: 0,
      });
    }
  }

  for (const d of days) {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    weeks.push(currentWeek);
  }

  // Calculate month labels across columns
  const monthLabels: Array<{ text: string; colIndex: number }> = [];
  let lastMonth = -1;

  weeks.forEach((week, colIdx) => {
    const validDay = week.find((d) => d.date);
    if (validDay) {
      const month = new Date(validDay.date).getMonth();
      if (month !== lastMonth) {
        lastMonth = month;
        const monthName = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(
          new Date(validDay.date)
        );
        monthLabels.push({ text: monthName, colIndex: colIdx });
      }
    }
  });

  const getCellColor = (intensity: number) => {
    switch (intensity) {
      case 1:
        return 'bg-[var(--accent)]/30 border-[var(--accent)]/40';
      case 2:
        return 'bg-[var(--accent)]/55 border-[var(--accent)]/65';
      case 3:
        return 'bg-[var(--accent)]/80 border-[var(--accent)]';
      case 4:
        return 'bg-[var(--accent)] text-white border-[var(--accent)] shadow-xs';
      case 0:
      default:
        return 'bg-[var(--bg-subtle)] border-[var(--border-subtle)]';
    }
  };

  const formatDuration = (ms: number) => {
    const min = Math.round(ms / 60000);
    if (min < 1) return '< 1 min';
    if (min < 60) return `${min} min`;
    const hrs = (min / 60).toFixed(1);
    return `${hrs} hrs`;
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Tooltip bar */}
      <div className="h-6 flex items-center justify-between text-xs">
        <div className="text-[var(--text-secondary)]">
          {hoveredDay && hoveredDay.date ? (
            <span className="font-medium text-[var(--text-primary)]">
              {new Intl.DateTimeFormat('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              }).format(new Date(hoveredDay.date))}
              :{' '}
              <span className="font-mono text-[var(--accent)] font-semibold">
                {hoveredDay.count} {hoveredDay.count === 1 ? 'review' : 'reviews'}
              </span>
              {hoveredDay.durationMs > 0 && (
                <span className="text-[var(--text-tertiary)] ml-1">
                  ({formatDuration(hoveredDay.durationMs)})
                </span>
              )}
            </span>
          ) : (
            <span className="text-[var(--text-tertiary)]">
              Hover over squares to see learning activity
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)]">
          {currentStreak > 0 && (
            <span>
              🔥 Current Streak:{' '}
              <strong className="text-[var(--text-primary)]">{currentStreak} days</strong>
            </span>
          )}
          {longestStreak > 0 && (
            <span>
              ⭐ Longest:{' '}
              <strong className="text-[var(--text-primary)]">{longestStreak} days</strong>
            </span>
          )}
        </div>
      </div>

      {/* Grid Container with horizontal scroll on small screens */}
      <div className="overflow-x-auto pb-2 -mx-1 px-1">
        <div className="inline-block min-w-full">
          {/* Month Header */}
          <div className="flex gap-[3px] ml-7 mb-1 text-[10px] text-[var(--text-tertiary)] h-4 select-none">
            {weeks.map((_, colIdx) => {
              const label = monthLabels.find((m) => m.colIndex === colIdx);
              return (
                <div key={colIdx} className="w-3 shrink-0">
                  {label ? label.text : ''}
                </div>
              );
            })}
          </div>

          <div className="flex gap-2">
            {/* Day of Week Labels */}
            <div className="flex flex-col gap-[3px] text-[9px] text-[var(--text-tertiary)] select-none pt-0.5 w-5 shrink-0">
              <span className="h-3 leading-3">Sun</span>
              <span className="h-3 leading-3 opacity-0">Mon</span>
              <span className="h-3 leading-3">Tue</span>
              <span className="h-3 leading-3 opacity-0">Wed</span>
              <span className="h-3 leading-3">Thu</span>
              <span className="h-3 leading-3 opacity-0">Fri</span>
              <span className="h-3 leading-3">Sat</span>
            </div>

            {/* Weeks columns */}
            <div className="flex gap-[3px]">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-[3px] shrink-0">
                  {week.map((day, dIdx) => {
                    if (!day.date) {
                      return <div key={dIdx} className="w-3 h-3 rounded-[2px] opacity-0" />;
                    }

                    return (
                      <div
                        key={dIdx}
                        onMouseEnter={() => setHoveredDay(day)}
                        onMouseLeave={() => setHoveredDay(null)}
                        className={`w-3 h-3 rounded-[2px] border transition-transform duration-100 cursor-pointer hover:scale-125 hover:z-10 ${getCellColor(
                          day.intensity
                        )}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] pt-1 border-t border-[var(--divider)]">
        <span>365 days of learning history</span>
        <div className="flex items-center gap-1.5">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--bg-subtle)] border border-[var(--border-subtle)]" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--accent)]/30 border border-[var(--accent)]/40" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--accent)]/55 border border-[var(--accent)]/65" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--accent)]/80 border border-[var(--accent)]" />
          <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--accent)] border border-[var(--accent)]" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};
