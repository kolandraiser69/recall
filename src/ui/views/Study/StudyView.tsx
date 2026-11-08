import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigation } from '../../navigation/NavigationContext';
import { studySessionService, type StudySession } from '../../../services/studySessionService';
import { fsrsService } from '../../../services/fsrsService';
import { TemplateRenderer } from '../../../core/templates/templateRenderer';
import { CardState, Rating } from '../../../core/models/card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { ProgressBar } from '../../components/ProgressBar';
import { ShadowCardContainer } from '../../components/ShadowCardContainer';
import { useToast } from '../../components/Toast';
import { NoteEditorModal } from '../Editor/NoteEditorModal';
import {
  ArrowLeft,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  Plus,
} from 'lucide-react';

export const StudyView: React.FC = () => {
  const { routeParams, navigateTo } = useNavigation();
  const { error: toastError, success: toastSuccess } = useToast();

  const [session, setSession] = useState<StudySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);

  // Time tracking for active card review
  const cardShownAtRef = useRef<number>(Date.now());

  // Initialize or reload study session
  const initSession = useCallback(async () => {
    setIsLoading(true);
    setIsAnswerRevealed(false);
    try {
      const newSession = await studySessionService.startSession({
        deckId: routeParams.deckId ?? null,
        includeSubdecks: true,
      });
      setSession(newSession);
      cardShownAtRef.current = Date.now();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to start study session.');
    } finally {
      setIsLoading(false);
    }
  }, [routeParams.deckId, toastError]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  // Current Card Item
  const currentItem = session?.currentCardItem ?? null;
  const currentCard = currentItem?.card ?? null;
  const currentNote = currentItem?.note ?? null;
  const currentNoteType = currentItem?.noteType ?? null;

  // Calculate Next Intervals for 4 Rating Buttons
  const nextIntervals = useMemo(() => {
    if (!currentCard || !session) return null;
    return fsrsService.getNextIntervals(currentCard, currentItem?.deck.settings ?? session.settings);
  }, [currentCard, currentItem?.deck.settings, session]);

  // Handle Reveal Answer
  const handleRevealAnswer = useCallback(() => {
    if (isAnswerRevealed) return;
    setIsAnswerRevealed(true);
  }, [isAnswerRevealed]);

  // Handle Rating Submission
  const handleRate = useCallback(
    async (rating: Rating) => {
      if (!session || !currentItem || isSubmitting) return;

      setIsSubmitting(true);
      const durationMs = Date.now() - cardShownAtRef.current;

      try {
        const { session: updatedSession } = await studySessionService.submitReview(
          session,
          rating,
          durationMs
        );
        setSession(updatedSession);
        setIsAnswerRevealed(false);
        cardShownAtRef.current = Date.now();
      } catch (err) {
        toastError(err instanceof Error ? err.message : 'Failed to record card review.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [session, currentItem, isSubmitting, toastError]
  );

  // Handle Undo
  const handleUndo = useCallback(async () => {
    if (!session || session.undoStack.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const revertedSession = await studySessionService.undoLastReview(session);
      setSession(revertedSession);
      setIsAnswerRevealed(false);
      cardShownAtRef.current = Date.now();
      toastSuccess('Review undone.');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to undo review.');
    } finally {
      setIsSubmitting(false);
    }
  }, [session, isSubmitting, toastSuccess, toastError]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if focus is inside an input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'z' || (e.key === 'z' && (e.ctrlKey || e.metaKey))) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (!isAnswerRevealed) {
        if (e.code === 'Space' || e.key === 'Enter') {
          e.preventDefault();
          handleRevealAnswer();
        }
      } else {
        if (e.key === '1') {
          e.preventDefault();
          handleRate(Rating.Again);
        } else if (e.key === '2') {
          e.preventDefault();
          handleRate(Rating.Hard);
        } else if (e.key === '3' || e.code === 'Space') {
          e.preventDefault();
          handleRate(Rating.Good);
        } else if (e.key === '4') {
          e.preventDefault();
          handleRate(Rating.Easy);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnswerRevealed, handleRevealAnswer, handleRate, handleUndo]);

  // Render question / answer HTML
  const renderedContent = useMemo(() => {
    if (!currentCard || !currentNote || !currentNoteType) {
      return { questionHtml: '', answerHtml: '' };
    }

    const template =
      currentNoteType.templates[currentCard.templateIndex] || currentNoteType.templates[0];
    if (!template) {
      return { questionHtml: '', answerHtml: '' };
    }

    const clozeIndex = currentNoteType.isCloze ? currentCard.templateIndex + 1 : 1;
    return TemplateRenderer.render(template, currentNote.fieldValues, { clozeIndex });
  }, [currentCard, currentNote, currentNoteType]);

  // Formatting helpers
  const formatDuration = (startTime: number, endTime: number = Date.now()) => {
    const totalSeconds = Math.max(0, Math.floor((endTime - startTime) / 1000));
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="py-24 text-center space-y-3 animate-in fade-in duration-150">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-[var(--accent)] border-t-transparent animate-spin" />
        <p className="text-xs text-[var(--text-secondary)] font-mono">Preparing study session...</p>
      </div>
    );
  }

  // 2. Empty Session / Initial Blockers State
  if (session && session.emptyReason !== 'none') {
    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--divider)]">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigateTo('decks')}
            leftIcon={<ArrowLeft className="w-4 h-4" />}
          >
            All Decks
          </Button>
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {session.targetDeckName}
          </span>
        </div>

        <Card variant="standard" padding="lg" className="text-center py-12 space-y-4">
          <div className="w-12 h-12 mx-auto rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
            {session.emptyReason === 'no_due_cards' ? (
              <CheckCircle2 className="w-6 h-6 text-[var(--success)]" />
            ) : (
              <Layers className="w-6 h-6 text-[var(--accent)]" />
            )}
          </div>

          <div className="space-y-1 max-w-sm mx-auto">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              {session.emptyReason === 'no_cards' && 'No Flashcards in Deck'}
              {session.emptyReason === 'all_suspended' && 'All Cards Suspended'}
              {session.emptyReason === 'daily_limits_reached' && 'Daily Limit Reached'}
              {session.emptyReason === 'no_due_cards' && 'All Caught Up!'}
            </h2>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {session.emptyReason === 'no_cards' &&
                'This deck does not contain any flashcards yet. Add notes to begin studying.'}
              {session.emptyReason === 'all_suspended' &&
                'All cards belonging to this deck are marked as suspended and excluded from active reviews.'}
              {session.emptyReason === 'daily_limits_reached' &&
                "You've reached your configured daily study limits for new cards and reviews in this collection."}
              {session.emptyReason === 'no_due_cards' &&
                'There are no flashcards due for review right now. Spaced repetition works best with daily consistency.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {session.emptyReason === 'no_cards' ? (
              <>
                <Button
                  variant="primary"
                  onClick={() => setIsAddNoteOpen(true)}
                  leftIcon={<Plus className="w-4 h-4" />}
                >
                  Create Flashcard
                </Button>
                <Button variant="secondary" onClick={() => navigateTo('decks')}>
                  Return to Decks
                </Button>
              </>
            ) : (
              <>
                <Button variant="primary" onClick={() => navigateTo('decks')}>
                  Return to Decks
                </Button>
                <Button variant="secondary" onClick={() => navigateTo('collection')}>
                  Browse Collection
                </Button>
              </>
            )}
          </div>
        </Card>

        <NoteEditorModal
          isOpen={isAddNoteOpen}
          onClose={() => setIsAddNoteOpen(false)}
          defaultDeckId={session.targetDeckId ?? undefined}
          onSuccess={() => {
            setIsAddNoteOpen(false);
            initSession();
          }}
        />
      </div>
    );
  }

  // 3. Completed Session State
  if (session && session.isCompleted && session.stats.cardsAnswered > 0) {
    const stats = session.stats;
    const duration = formatDuration(stats.startTime, stats.endTime);

    return (
      <div className="max-w-xl mx-auto space-y-6 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--divider)]">
          <span className="text-xs font-semibold text-[var(--text-secondary)]">
            {session.targetDeckName}
          </span>
          <Badge variant="accent">Session Complete</Badge>
        </div>

        <Card variant="standard" padding="lg" className="text-center py-10 space-y-6">
          <div className="w-14 h-14 mx-auto rounded-full bg-[var(--accent-subtle)] text-[var(--accent)] flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Session Completed!
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Great work! You have finished all scheduled cards for this session.
            </p>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left">
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
              <span className="text-[11px] text-[var(--text-tertiary)] block">Total Answered</span>
              <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
                {stats.cardsAnswered}
              </span>
            </div>

            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
              <span className="text-[11px] text-[var(--text-tertiary)] block">New Cards</span>
              <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
                {stats.newCardsStudied}
              </span>
            </div>

            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
              <span className="text-[11px] text-[var(--text-tertiary)] block">Reviews</span>
              <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
                {stats.reviewCardsStudied}
              </span>
            </div>

            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
              <span className="text-[11px] text-[var(--text-tertiary)] block">Duration</span>
              <span className="text-lg font-bold font-mono text-[var(--text-primary)] flex items-center gap-1">
                <Clock className="w-4 h-4 text-[var(--text-tertiary)]" />
                {duration}
              </span>
            </div>
          </div>

          {/* Rating Breakdown */}
          <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-2">
            <span className="text-xs font-semibold text-[var(--text-secondary)] block text-left">
              Rating Distribution
            </span>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="block text-[10px] text-rose-500 font-medium">Again</span>
                <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                  {stats.ratings[Rating.Again] ?? 0}
                </span>
              </div>
              <div className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="block text-[10px] text-amber-500 font-medium">Hard</span>
                <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                  {stats.ratings[Rating.Hard] ?? 0}
                </span>
              </div>
              <div className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="block text-[10px] text-[var(--accent)] font-medium">Good</span>
                <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                  {stats.ratings[Rating.Good] ?? 0}
                </span>
              </div>
              <div className="p-2 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                <span className="block text-[10px] text-emerald-500 font-medium">Easy</span>
                <span className="font-mono font-bold text-sm text-[var(--text-primary)]">
                  {stats.ratings[Rating.Easy] ?? 0}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Button variant="primary" onClick={() => navigateTo('decks')}>
              Back to Decks
            </Button>
            <Button variant="secondary" onClick={() => navigateTo('home')}>
              Home Dashboard
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // 4. Active Card Study Session
  if (!session || !currentItem || !currentCard || !currentNote || !currentNoteType) {
    return null;
  }

  const answered = session.stats.cardsAnswered;
  const total = Math.max(1, session.initialTotal);
  const progressPercent = Math.min(100, Math.round((answered / total) * 100));

  const isCurrentCardNew = currentCard.state === CardState.New;

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-in fade-in duration-150">
      {/* Top Header: Navigation, Deck Breadcrumb & Progress */}
      <div className="space-y-3 pb-2 border-b border-[var(--divider)]">
        <div className="flex items-center justify-between gap-2">
          {/* Back & Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => navigateTo('decks')}
              className="p-1.5 -ml-1.5 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              aria-label="Exit Study Session"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1 text-xs text-[var(--text-secondary)] truncate">
              {session.deckPath.length > 0 ? (
                session.deckPath.map((d, i) => (
                  <React.Fragment key={d.id}>
                    {i > 0 && <ChevronRight className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />}
                    <span className={i === session.deckPath.length - 1 ? 'font-semibold text-[var(--text-primary)]' : ''}>
                      {d.name}
                    </span>
                  </React.Fragment>
                ))
              ) : (
                <span className="font-semibold text-[var(--text-primary)]">{session.targetDeckName}</span>
              )}
            </div>
          </div>

          {/* Right: Badges & Undo */}
          <div className="flex items-center gap-2 shrink-0">
            {isCurrentCardNew ? (
              <Badge variant="accent" className="text-[10px]">
                New Card
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-[10px] bg-[var(--bg-subtle)]">
                Review
              </Badge>
            )}

            {session.undoStack.length > 0 && (
              <button
                type="button"
                onClick={handleUndo}
                disabled={isSubmitting}
                className="text-xs px-2 py-1 rounded-[var(--radius-sm)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors flex items-center gap-1 cursor-pointer"
                title="Undo last rating (z)"
              >
                <RotateCcw className="w-3 h-3" />
                <span className="hidden sm:inline">Undo</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar & Counters */}
        <div className="space-y-1.5">
          <ProgressBar value={progressPercent} color="accent" />
          <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] font-mono">
            <span>
              {answered} of {total} completed
            </span>
            <span>{session.queue.length + 1} remaining</span>
          </div>
        </div>
      </div>

      {/* Main Flashcard Card Container */}
      <Card
        variant="standard"
        padding="lg"
        className="min-h-[300px] sm:min-h-[360px] flex flex-col justify-between shadow-[var(--shadow-card)] border-[var(--border-subtle)] transition-all relative overflow-hidden"
      >
        {/* Flashcard Body rendered inside Shadow DOM for styling safety */}
        <div className="flex-1 py-4 flex flex-col justify-center">
          <ShadowCardContainer
            html={isAnswerRevealed ? renderedContent.answerHtml : renderedContent.questionHtml}
            css={currentNoteType.css}
            className="w-full text-center"
          />
        </div>

        {/* Bottom Card Footer: Reveal Button OR FSRS Rating Options */}
        <div className="pt-6 border-t border-[var(--border-subtle)]">
          {!isAnswerRevealed ? (
            /* Show Answer CTA */
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <Button
                variant="primary"
                size="lg"
                onClick={handleRevealAnswer}
                className="w-full sm:w-64 h-12 text-base font-semibold shadow-sm"
              >
                Show Answer
              </Button>
              <span className="text-[11px] text-[var(--text-tertiary)] font-mono hidden sm:inline">
                (Press Space)
              </span>
            </div>
          ) : (
            /* 4 FSRS Rating Buttons */
            <div className="space-y-2 animate-in fade-in duration-150">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {/* 1: Again */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleRate(Rating.Again)}
                  className="
                    flex flex-col items-center justify-center p-3 rounded-[var(--radius-md)]
                    bg-[var(--bg-surface)] hover:bg-rose-500/10 text-[var(--text-primary)]
                    border border-[var(--border-subtle)] hover:border-rose-500/40
                    transition-all duration-150 cursor-pointer min-h-[58px]
                    active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-rose-500
                  "
                >
                  <span className="text-xs font-bold text-rose-500">Again</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">
                    {nextIntervals?.[Rating.Again]?.intervalLabel ?? '1m'}
                  </span>
                  <span className="text-[9px] text-[var(--text-tertiary)] font-mono opacity-60">1</span>
                </button>

                {/* 2: Hard */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleRate(Rating.Hard)}
                  className="
                    flex flex-col items-center justify-center p-3 rounded-[var(--radius-md)]
                    bg-[var(--bg-surface)] hover:bg-amber-500/10 text-[var(--text-primary)]
                    border border-[var(--border-subtle)] hover:border-amber-500/40
                    transition-all duration-150 cursor-pointer min-h-[58px]
                    active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-amber-500
                  "
                >
                  <span className="text-xs font-bold text-amber-500">Hard</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">
                    {nextIntervals?.[Rating.Hard]?.intervalLabel ?? '10m'}
                  </span>
                  <span className="text-[9px] text-[var(--text-tertiary)] font-mono opacity-60">2</span>
                </button>

                {/* 3: Good */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleRate(Rating.Good)}
                  className="
                    flex flex-col items-center justify-center p-3 rounded-[var(--radius-md)]
                    bg-[var(--accent-subtle)] hover:bg-[var(--accent)] hover:text-[var(--accent-contrast)]
                    text-[var(--text-primary)] border border-[var(--accent)]/30 hover:border-[var(--accent)]
                    transition-all duration-150 cursor-pointer min-h-[58px]
                    active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] shadow-xs
                  "
                >
                  <span className="text-xs font-bold text-[var(--accent)] group-hover:text-inherit">Good</span>
                  <span className="text-[11px] opacity-80 font-mono mt-0.5">
                    {nextIntervals?.[Rating.Good]?.intervalLabel ?? '1d'}
                  </span>
                  <span className="text-[9px] opacity-60 font-mono">3 / Space</span>
                </button>

                {/* 4: Easy */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleRate(Rating.Easy)}
                  className="
                    flex flex-col items-center justify-center p-3 rounded-[var(--radius-md)]
                    bg-[var(--bg-surface)] hover:bg-emerald-500/10 text-[var(--text-primary)]
                    border border-[var(--border-subtle)] hover:border-emerald-500/40
                    transition-all duration-150 cursor-pointer min-h-[58px]
                    active:scale-[0.98] outline-none focus-visible:ring-2 focus-visible:ring-emerald-500
                  "
                >
                  <span className="text-xs font-bold text-emerald-500">Easy</span>
                  <span className="text-[11px] text-[var(--text-tertiary)] font-mono mt-0.5">
                    {nextIntervals?.[Rating.Easy]?.intervalLabel ?? '4d'}
                  </span>
                  <span className="text-[9px] text-[var(--text-tertiary)] font-mono opacity-60">4</span>
                </button>
              </div>

              <div className="text-center text-[10px] text-[var(--text-tertiary)] font-mono pt-1">
                Keyboard shortcuts: 1 (Again), 2 (Hard), 3 (Good), 4 (Easy)
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
