import React from 'react';
import { BookOpen } from 'lucide-react';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { useNavigation } from '../../navigation/NavigationContext';

export const StudyPlaceholderView: React.FC = () => {
  const { navigateTo } = useNavigation();

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <Card variant="standard" padding="lg" className="text-center py-12">
        <div className="w-12 h-12 mx-auto mb-4 rounded-[var(--radius-md)] bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center">
          <BookOpen className="w-6 h-6" />
        </div>

        <Badge variant="accent" className="mb-2">
          Scheduled for Phase 4
        </Badge>

        <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
          Study Engine &amp; FSRS
        </h2>

        <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto mt-2 mb-6 leading-relaxed">
          The full flashcard session engine—featuring question reveal, 3D card flipping, FSRS-4.5 interval rating buttons (Again, Hard, Good, Easy), and intraday queue management—will be introduced in Phase 4.
        </p>

        <Button variant="secondary" onClick={() => navigateTo('home')}>
          Back to Home
        </Button>
      </Card>
    </div>
  );
};
