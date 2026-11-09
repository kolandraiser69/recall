import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/database';
import {
  statisticsService,
  type Timeframe,
} from '../../../services/statisticsService';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Select } from '../../components/Select';
import { SegmentedControl } from '../../components/SegmentedControl';
import { SectionContainer } from '../../components/SectionContainer';
import { BarChart } from '../../components/charts/BarChart';
import { AreaLineChart } from '../../components/charts/AreaLineChart';
import { DonutChart } from '../../components/charts/DonutChart';
import { ActivityHeatmap } from '../../components/charts/ActivityHeatmap';
import { useNavigation } from '../../navigation/NavigationContext';
import {
  Clock,
  Layers,
  ChevronRight,
  Activity,
  Award,
} from 'lucide-react';

export const StatisticsView: React.FC = () => {
  const { navigateTo } = useNavigation();

  // Filters state
  const [timeframe, setTimeframe] = useState<Timeframe>('30d');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('all');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');

  // Decks for filter dropdown
  const allDecks = useLiveQuery(
    () => db.decks.filter((d) => d.deletedAt === null).toArray(),
    []
  ) ?? [];

  const deckFilterId = selectedDeckId === 'all' ? undefined : selectedDeckId;

  // Live queries for reactive data
  const overviewStats = useLiveQuery(
    () => statisticsService.getOverviewStats(deckFilterId, true),
    [deckFilterId]
  );

  const historyStats = useLiveQuery(
    () => statisticsService.getReviewHistoryStats({ timeframe, deckId: deckFilterId, includeSubdecks: true }),
    [timeframe, deckFilterId]
  );

  const heatmapStats = useLiveQuery(
    () => statisticsService.getActivityHeatmapData(365),
    []
  );

  const deckStats = useLiveQuery(
    () => statisticsService.getDeckStatistics(),
    []
  );

  const fsrsStats = useLiveQuery(
    () => statisticsService.getFSRSStats(deckFilterId),
    [deckFilterId]
  );

  const formatHoursMinutes = (ms: number) => {
    const totalMinutes = Math.round(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours === 0) return `${minutes}m`;
    return `${hours}h ${minutes}m`;
  };

  const timeframeOptions = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '90d', label: '90 Days' },
    { value: '365d', label: '1 Year' },
    { value: 'all', label: 'All Time' },
  ];

  const deckOptions = [
    { value: 'all', label: 'Entire Collection (All Decks)' },
    ...allDecks.map((d) => ({
      value: d.id,
      label: d.name,
    })),
  ];

  const ratingSegments = historyStats
    ? [
        { label: 'Again', value: historyStats.ratings.again, color: '#ef4444' },
        { label: 'Hard', value: historyStats.ratings.hard, color: '#f59e0b' },
        { label: 'Good', value: historyStats.ratings.good, color: '#007aff' },
        { label: 'Easy', value: historyStats.ratings.easy, color: '#10b981' },
      ]
    : [];

  const chartData = historyStats?.points.map((p) => ({
    label: p.formattedDate,
    value: p.reviews,
    tooltip: `${p.formattedDate}: ${p.reviews} reviews`,
  })) ?? [];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header bar with filters */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[var(--divider)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Statistics &amp; Insights
            </h1>
            <Badge variant="accent">FSRS-4.5</Badge>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Track your memory retention, review habits, and long-term learning consistency.
          </p>
        </div>

        {/* Global Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="w-52">
            <Select
              options={deckOptions}
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
            />
          </div>

          <SegmentedControl
            options={timeframeOptions}
            value={timeframe}
            onChange={(val) => setTimeframe(val as Timeframe)}
          />
        </div>
      </div>

      {/* Top Overview KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Reviews */}
        <Card variant="standard" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Reviews Completed</span>
            </div>
            {overviewStats && overviewStats.dailyAverageReviews > 0 && (
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                ~{overviewStats.dailyAverageReviews}/day
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {overviewStats?.totalReviews ?? '—'}
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Recorded study repetitions
          </p>
        </Card>

        {/* Total Study Time */}
        <Card variant="standard" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Study Time</span>
            </div>
            {historyStats && historyStats.avgDurationSec > 0 && (
              <span className="text-[10px] text-[var(--text-tertiary)] font-mono">
                {historyStats.avgDurationSec}s / card
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {overviewStats ? formatHoursMinutes(overviewStats.totalTimeSpentMs) : '—'}
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Active recall practice duration
          </p>
        </Card>

        {/* Retention Rate */}
        <Card variant="standard" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-[var(--success)]" />
              <span>Retention Rate</span>
            </div>
            {overviewStats && (
              <span className="text-[10px] text-[var(--success)] font-medium">
                {overviewStats.matureRetentionRate}% mature
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {overviewStats ? `${overviewStats.retentionRate}%` : '—'}
          </div>
          <p className="text-[11px] text-[var(--text-tertiary)]">
            Successful memory retrievals
          </p>
        </Card>

        {/* Active Cards Breakdown */}
        <Card
          variant="interactive"
          padding="md"
          className="space-y-1 cursor-pointer"
          onClick={() => navigateTo('collection')}
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)]">
            <div className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>Total Cards</span>
            </div>
            <span className="text-[10px] text-[var(--accent)] font-medium">Browse →</span>
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
            {overviewStats?.totalCards ?? '—'}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] pt-0.5">
            <span>{overviewStats?.stateCounts.new ?? 0} New</span>
            <span>•</span>
            <span className="text-amber-500 font-medium">
              {(overviewStats?.stateCounts.learning ?? 0) + (overviewStats?.stateCounts.review ?? 0)} Active
            </span>
          </div>
        </Card>
      </div>

      {/* Section 1: Review History Charts */}
      <SectionContainer
        title="Review Activity &amp; Answer Distribution"
        description="Daily volume and recall ratings over the selected timeframe"
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={chartType === 'line' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setChartType('line')}
            >
              Line
            </Button>
            <Button
              variant={chartType === 'bar' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setChartType('bar')}
            >
              Bar
            </Button>
          </div>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Activity Chart (2 cols) */}
          <Card variant="standard" padding="md" className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--text-primary)]">
                Reviews Trend ({timeframe.toUpperCase()})
              </span>
              <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
                Total: {historyStats?.totalReviews ?? 0}
              </span>
            </div>

            <div className="pt-2">
              {chartType === 'line' ? (
                <AreaLineChart data={chartData} height={200} />
              ) : (
                <BarChart data={chartData} height={200} />
              )}
            </div>
          </Card>

          {/* Rating Distribution Donut (1 col) */}
          <Card variant="standard" padding="md" className="flex flex-col justify-between space-y-3">
            <span className="text-xs font-semibold text-[var(--text-primary)]">
              Rating Distribution
            </span>

            <div className="py-2">
              <DonutChart
                segments={ratingSegments}
                size={160}
                thickness={20}
                centerTitle={String(historyStats?.totalReviews ?? 0)}
                centerSubtitle="Ratings"
              />
            </div>

            <div className="text-[11px] text-[var(--text-tertiary)] text-center pt-2 border-t border-[var(--divider)]">
              {historyStats && historyStats.ratings.again > 0 ? (
                <span>
                  Again rate:{' '}
                  <strong className="text-red-500 font-mono">
                    {Math.round((historyStats.ratings.again / historyStats.totalReviews) * 100)}%
                  </strong>
                </span>
              ) : (
                <span>Consistent retention across reviews</span>
              )}
            </div>
          </Card>
        </div>
      </SectionContainer>

      {/* Section 2: 365-Day Activity Heatmap */}
      <SectionContainer
        title="Learning Consistency"
        description="Daily study heatmap over the past 52 weeks"
      >
        <Card variant="standard" padding="md">
          <ActivityHeatmap
            days={heatmapStats?.days ?? []}
            currentStreak={heatmapStats?.currentStreak ?? 0}
            longestStreak={heatmapStats?.longestStreak ?? 0}
          />
        </Card>
      </SectionContainer>

      {/* Section 3: FSRS-4.5 Scheduling Diagnostics */}
      <SectionContainer
        title="FSRS-4.5 Algorithm Diagnostics"
        description="Memory stability, item difficulty distributions, and retention target alignment"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Stability & Difficulty KPI Card */}
          <Card variant="standard" padding="md" className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                FSRS Core Parameters
              </span>
              <Badge variant="accent">FSRS-4.5</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                <span className="text-xl font-bold font-mono text-[var(--text-primary)]">
                  {fsrsStats?.averageStability ?? 0} <span className="text-xs font-normal">days</span>
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] block">
                  Avg. Memory Stability (S)
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  Days until retention drops to 90%
                </span>
              </div>

              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-1">
                <span className="text-xl font-bold font-mono text-[var(--text-primary)]">
                  {fsrsStats?.averageDifficulty ?? 0} <span className="text-xs font-normal">/ 10</span>
                </span>
                <span className="text-[11px] text-[var(--text-secondary)] block">
                  Avg. Card Difficulty (D)
                </span>
                <span className="text-[10px] text-[var(--text-tertiary)]">
                  Intrinsic cognitive complexity
                </span>
              </div>
            </div>

            {/* Retention Comparison Bar */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--divider)]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-secondary)]">
                  Target ({Math.round((fsrsStats?.desiredRetention ?? 0.9) * 100)}%) vs. Measured
                </span>
                <span className="font-mono font-bold text-[var(--text-primary)]">
                  {fsrsStats?.measuredRetention ?? 0}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                  style={{ width: `${Math.min(100, fsrsStats?.measuredRetention ?? 0)}%` }}
                />
              </div>
            </div>
          </Card>

          {/* Stability Distribution */}
          <Card variant="standard" padding="md" className="space-y-3">
            <span className="text-xs font-semibold text-[var(--text-primary)] block">
              Memory Stability Distribution (Active Cards)
            </span>

            <div className="space-y-2 text-xs pt-1">
              {[
                { label: '< 1 day (Initial)', count: fsrsStats?.stabilityDistribution.under1d ?? 0 },
                { label: '1 - 7 days (Early)', count: fsrsStats?.stabilityDistribution.from1dTo7d ?? 0 },
                { label: '7 - 30 days (Solid)', count: fsrsStats?.stabilityDistribution.from7dTo30d ?? 0 },
                { label: '30 - 90 days (Mature)', count: fsrsStats?.stabilityDistribution.from30dTo90d ?? 0 },
                { label: '> 90 days (Long-Term)', count: fsrsStats?.stabilityDistribution.over90d ?? 0 },
              ].map((bucket, idx) => {
                const totalReviewCards =
                  (fsrsStats?.stabilityDistribution.under1d ?? 0) +
                  (fsrsStats?.stabilityDistribution.from1dTo7d ?? 0) +
                  (fsrsStats?.stabilityDistribution.from7dTo30d ?? 0) +
                  (fsrsStats?.stabilityDistribution.from30dTo90d ?? 0) +
                  (fsrsStats?.stabilityDistribution.over90d ?? 0);
                const pct = totalReviewCards > 0 ? Math.round((bucket.count / totalReviewCards) * 100) : 0;

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[var(--text-secondary)]">{bucket.label}</span>
                      <span className="font-mono text-[var(--text-primary)]">
                        {bucket.count} <span className="text-[var(--text-tertiary)]">({pct}%)</span>
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[var(--accent)]"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </SectionContainer>

      {/* Section 4: Deck Breakdown Table */}
      <SectionContainer
        title="Deck Breakdown"
        description="Card workload, review totals, and memory stability by deck"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateTo('decks')}
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
          >
            Manage Decks
          </Button>
        }
      >
        <Card variant="standard" padding="none" className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--divider)] bg-[var(--bg-subtle)] text-[var(--text-tertiary)] font-medium">
                  <th className="py-2.5 px-4">Deck Name</th>
                  <th className="py-2.5 px-3 text-center">Total Cards</th>
                  <th className="py-2.5 px-3 text-center">Due Today</th>
                  <th className="py-2.5 px-3 text-center">New Cards</th>
                  <th className="py-2.5 px-3 text-center">Reviews</th>
                  <th className="py-2.5 px-3 text-center">Retention</th>
                  <th className="py-2.5 px-3 text-center">Avg Stability</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--divider)]">
                {deckStats && deckStats.length > 0 ? (
                  deckStats.map((d) => (
                    <tr
                      key={d.id}
                      className="hover:bg-[var(--bg-subtle)] transition-colors group cursor-pointer"
                      onClick={() => navigateTo('collection', { deckId: d.id })}
                    >
                      <td className="py-3 px-4 font-semibold text-[var(--text-primary)] flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        <span>{d.name}</span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[var(--text-secondary)]">
                        {d.totalCards}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {d.dueCount > 0 ? (
                          <Badge variant="accent">{d.dueCount} Due</Badge>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">0</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[var(--text-secondary)]">
                        {d.newCount}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[var(--text-secondary)]">
                        {d.totalReviews}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[var(--text-primary)]">
                        {d.totalReviews > 0 ? `${d.retentionRate}%` : '—'}
                      </td>
                      <td className="py-3 px-3 text-center font-mono text-[var(--text-secondary)]">
                        {d.averageStability > 0 ? `${d.averageStability}d` : '—'}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigateTo('collection', { deckId: d.id });
                          }}
                        >
                          Browse
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-xs text-[var(--text-tertiary)]">
                      No decks found. Create or import your first deck to start generating statistics.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </SectionContainer>
    </div>
  );
};
