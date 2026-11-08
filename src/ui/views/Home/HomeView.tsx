import React from 'react';
import { BookOpen, Layers, Plus, Clock, Sparkles, CheckCircle2 } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/database';
import { deckService } from '../../../services/deckService';
import { CardState } from '../../../core/models/card';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { SectionContainer } from '../../components/SectionContainer';
import { useNavigation } from '../../navigation/NavigationContext';

export const HomeView: React.FC = () => {
  const { navigateTo } = useNavigation();

  const now = Date.now();
  const deckHierarchy = useLiveQuery(() => deckService.getDeckHierarchy(), []);
  const stats = useLiveQuery(async () => {
    const [decks, cards, dueCards, reviews] = await Promise.all([
      db.decks.filter((d) => d.deletedAt === null).count(),
      db.cards.filter((c) => c.deletedAt === null).count(),
      db.cards.filter((c) => c.deletedAt === null && !c.isSuspended && c.due <= now && c.state !== CardState.New).count(),
      db.reviews.filter((r) => r.deletedAt === null).count(),
    ]);
    return { decks, cards, dueCards, reviews };
  }, []);

  const deckCount = stats?.decks ?? null;
  const totalCardCount = stats?.cards ?? null;
  const dueCardCount = stats?.dueCards ?? null;
  const reviewCount = stats?.reviews ?? null;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const formattedDate = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  }).format(new Date());

  const isLoading = deckCount === null;

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Subtle Greeting Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-[var(--divider)] pb-4">
        <div>
          <span className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-wider">
            {formattedDate}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] mt-0.5">
            {getGreeting()}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral" icon={<span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />}>
            Local-First SRS
          </Badge>
        </div>
      </div>

      {/* Main Hero: Study Entry Card */}
      <Card variant="standard" padding="lg" className="relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="space-y-2 max-w-lg">
            <div className="flex items-center gap-2">
              <Badge
                variant={
                  totalCardCount === 0 || deckCount === 0
                    ? 'neutral'
                    : dueCardCount && dueCardCount > 0
                    ? 'accent'
                    : 'neutral'
                }
              >
                {deckCount === 0
                  ? 'Welcome to Recall'
                  : totalCardCount === 0
                  ? 'No Cards in Collection'
                  : dueCardCount && dueCardCount > 0
                  ? `${dueCardCount} Due for Review`
                  : 'All Caught Up'}
              </Badge>
              {totalCardCount !== null && totalCardCount > 0 && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  {totalCardCount} total {totalCardCount === 1 ? 'card' : 'cards'}
                </span>
              )}
            </div>

            <h2 className="text-lg font-semibold text-[var(--text-primary)]">
              {deckCount === 0
                ? 'Get started by creating your first deck'
                : totalCardCount === 0
                ? 'Your decks are ready, but have no flashcards yet'
                : dueCardCount && dueCardCount > 0
                ? 'Ready for your daily recall session?'
                : 'No cards currently due for review'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {deckCount === 0
                ? 'Organize your knowledge into hierarchical decks and start mastering concepts with modern spaced repetition.'
                : totalCardCount === 0
                ? 'Add notes and flashcards to your decks to begin learning with FSRS-scheduled reviews.'
                : dueCardCount && dueCardCount > 0
                ? 'Spaced repetition works best when practiced in short, consistent daily intervals.'
                : 'All scheduled cards are up to date. You can create new cards, explore your decks, or take a well-deserved break.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
            {deckCount === 0 ? (
              <Button
                variant="primary"
                size="lg"
                onClick={() => navigateTo('decks')}
                leftIcon={<Plus className="w-4 h-4" />}
              >
                Create First Deck
              </Button>
            ) : totalCardCount === 0 ? (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => navigateTo('collection')}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Add Flashcards
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => navigateTo('decks')}
                  leftIcon={<Layers className="w-4 h-4" />}
                >
                  View Decks
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  disabled={isLoading || dueCardCount === 0}
                  onClick={() => navigateTo('study')}
                  leftIcon={<BookOpen className="w-4 h-4" />}
                >
                  Start Session
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => navigateTo('decks')}
                  leftIcon={<Layers className="w-4 h-4" />}
                >
                  View Decks
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Section: Deck Overview */}
      <SectionContainer
        title="Your Collections"
        description="Organize your knowledge into hierarchical decks"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateTo('decks')}
            rightIcon={<span className="text-xs">→</span>}
          >
            All Decks
          </Button>
        }
      >
        {deckCount === 0 ? (
          /* Empty State for Decks */
          <Card variant="standard" padding="lg" className="text-center py-10">
            <div className="w-11 h-11 mx-auto mb-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] flex items-center justify-center text-[var(--text-tertiary)] border border-[var(--border-subtle)]">
              <Layers className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">No decks created yet</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto mt-1 mb-5">
              Decks will hold your flashcards and customized FSRS scheduling intervals. Create your first deck or import an Anki collection.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigateTo('decks')}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Go to Decks
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {deckHierarchy && deckHierarchy.length > 0 ? (
              deckHierarchy.slice(0, 6).map((deck) => (
                <Card
                  key={deck.id}
                  variant="interactive"
                  padding="md"
                  onClick={() => navigateTo('decks')}
                  className="flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
                        {deck.name}
                      </span>
                      {deck.children.length > 0 && (
                        <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)] shrink-0">
                          {deck.children.length} subdeck{deck.children.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {deck.description && (
                      <p className="text-xs text-[var(--text-tertiary)] line-clamp-1 mt-1">
                        {deck.description}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-4 pt-2 border-t border-[var(--border-subtle)] text-xs">
                    {deck.totalCounts.dueCount > 0 ? (
                      <Badge variant="neutral" className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20">
                        {deck.totalCounts.dueCount} Due
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-[var(--text-tertiary)]">0 Due</span>
                    )}
                    {deck.totalCounts.newCount > 0 && (
                      <Badge variant="accent">
                        {deck.totalCounts.newCount} New
                      </Badge>
                    )}
                    <span className="text-[11px] text-[var(--text-tertiary)] ml-auto font-mono">
                      {deck.totalCounts.total} {deck.totalCounts.total === 1 ? 'card' : 'cards'}
                    </span>
                  </div>
                </Card>
              ))
            ) : (
              <Card variant="interactive" padding="md" onClick={() => navigateTo('decks')}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">Decks Active</span>
                  <Badge variant="neutral">{deckCount}</Badge>
                </div>
                <p className="text-xs text-[var(--text-tertiary)] mt-2">Browse your deck hierarchies</p>
              </Card>
            )}
          </div>
        )}
      </SectionContainer>

      {/* Section: Learning Progress & System Status */}
      <SectionContainer title="System Status" description="Local persistence and data integrity">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card variant="standard" padding="md" className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <Clock className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
              <span>Reviews Completed</span>
            </div>
            <div className="text-xl font-bold font-mono text-[var(--text-primary)]">
              {reviewCount !== null ? reviewCount : '—'}
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)]">Total recorded learning logs</p>
          </Card>

          <Card variant="standard" padding="md" className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
              <span>IndexedDB Engine</span>
            </div>
            <div className="text-xl font-bold text-[var(--text-primary)]">
              Online
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)]">Dexie.js client database active</p>
          </Card>

          <Card variant="standard" padding="md" className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Spaced Repetition</span>
            </div>
            <div className="text-xl font-bold text-[var(--text-primary)]">
              FSRS-4.5
            </div>
            <p className="text-[11px] text-[var(--text-tertiary)]">90% Target Retention default</p>
          </Card>
        </div>
      </SectionContainer>
    </div>
  );
};
