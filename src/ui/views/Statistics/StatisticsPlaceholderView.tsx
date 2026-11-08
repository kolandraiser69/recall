import React from 'react';
import { BarChart3 } from 'lucide-react';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useNavigation } from '../../navigation/NavigationContext';

export const StatisticsPlaceholderView: React.FC = () => {
  const { navigateTo } = useNavigation();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <Card variant="standard" padding="lg" className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
          <BarChart3 className="w-6 h-6" />
        </div>

        <Badge variant="neutral" className="mb-2">
          Scheduled for Phase 6
        </Badge>

        <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          Statistics &amp; Analytics
        </h2>

        <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto mt-2 mb-6 leading-relaxed">
          Daily and weekly review heatmaps, memory retention curves, stability distributions, and upcoming workload projections will be introduced in Phase 6.
        </p>

        <Button variant="secondary" onClick={() => navigateTo('home')}>
          Back to Home
        </Button>
      </Card>
    </div>
  );
};
