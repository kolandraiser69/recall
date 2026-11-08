import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StudyView } from '../../src/ui/views/Study/StudyView';
import { ToastProvider } from '../../src/ui/components/Toast';
import { NavigationProvider } from '../../src/ui/navigation/NavigationContext';
import { db } from '../../src/db/database';
import { cardService } from '../../src/services/cardService';
import { DEFAULT_NOTE_TYPES } from '../../src/db/migrations/v1';
import { DEFAULT_DECK_SETTINGS } from '../../src/core/models/deck';
import { Rating } from '../../src/core/models/card';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ToastProvider>
      <NavigationProvider>{ui}</NavigationProvider>
    </ToastProvider>
  );
};

describe('StudyView UI & Study Engine (Phase 4)', () => {
  beforeEach(async () => {
    await db.initialize();
    await db.notes.clear();
    await db.cards.clear();
    await db.decks.clear();
    await db.reviews.clear();

    const count = await db.noteTypes.count();
    if (count === 0) {
      await db.noteTypes.bulkAdd(DEFAULT_NOTE_TYPES);
    }

    // Seed test deck
    await db.decks.add({
      id: 'deck-1',
      name: 'Biology 101',
      parentId: null,
      description: 'Introductory biology',
      settings: DEFAULT_DECK_SETTINGS,
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    });
  });

  it('renders empty deck message when deck contains no cards', async () => {
    renderWithProviders(<StudyView />);

    await waitFor(() => {
      expect(screen.getByText(/no flashcards in deck/i)).toBeDefined();
    });
    expect(screen.getByRole('button', { name: /create flashcard/i })).toBeDefined();
  });

  it('renders flashcard front side and reveals answer on click', async () => {
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-1',
      fieldValues: {
        Front: 'What is the powerhouse of the cell?',
        Back: 'Mitochondria',
      },
      tags: ['biology'],
    });

    renderWithProviders(<StudyView />);

    // Front should be visible initially via ShadowCardContainer
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show answer/i })).toBeDefined();
    });

    // Rating buttons shouldn't be visible before reveal
    expect(screen.queryByText('Again')).toBeNull();

    // Click Show Answer
    const showAnswerBtn = screen.getByRole('button', { name: /show answer/i });
    fireEvent.click(showAnswerBtn);

    // After reveal, all 4 FSRS buttons should appear
    await waitFor(() => {
      expect(screen.getByText('Again')).toBeDefined();
      expect(screen.getByText('Hard')).toBeDefined();
      expect(screen.getByText('Good')).toBeDefined();
      expect(screen.getByText('Easy')).toBeDefined();
    });
  });

  it('submits rating, saves review log, and transitions to completion screen', async () => {
    const { cards } = await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-1',
      fieldValues: {
        Front: 'Question 1',
        Back: 'Answer 1',
      },
    });

    renderWithProviders(<StudyView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show answer/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    await waitFor(() => {
      expect(screen.getByText('Good')).toBeDefined();
    });

    const goodBtn = screen.getByText('Good').closest('button')!;
    fireEvent.click(goodBtn);

    // Card was single item, so session completes!
    await waitFor(() => {
      expect(screen.getByText('Session Completed!')).toBeDefined();
    });

    // Verify ReviewLog in DB
    const logs = await db.reviews.toArray();
    expect(logs.length).toBe(1);
    expect(logs[0]?.rating).toBe(Rating.Good);

    // Verify Card updated in DB
    const updatedCard = await db.cards.get(cards[0]!.id);
    expect(updatedCard?.fsrs.reps).toBe(1);
  });

  it('reverts rating via Undo button', async () => {
    const { cards } = await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-1',
      fieldValues: {
        Front: 'Front to Undo',
        Back: 'Back to Undo',
      },
    });
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-1',
      fieldValues: {
        Front: 'Second Card',
        Back: 'Second Back',
      },
    });

    renderWithProviders(<StudyView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show answer/i })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: /show answer/i }));

    await waitFor(() => {
      expect(screen.getByText('Easy')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Easy').closest('button')!);

    // Now Undo button should be present
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /undo/i })).toBeDefined();
    });

    // Click Undo
    fireEvent.click(screen.getByRole('button', { name: /undo/i }));

    // Should bring back the first card unrated
    await waitFor(async () => {
      const card = await db.cards.get(cards[0]!.id);
      expect(card?.fsrs.reps).toBe(0);
    });
  });

  it('supports keyboard shortcuts for reveal and ratings', async () => {
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-1',
      fieldValues: {
        Front: 'Shortcut Test',
        Back: 'Shortcut Back',
      },
    });

    renderWithProviders(<StudyView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show answer/i })).toBeDefined();
    });

    // Press Space to reveal
    fireEvent.keyDown(window, { code: 'Space' });

    await waitFor(() => {
      expect(screen.getByText('Good')).toBeDefined();
    });

    // Press '3' to rate Good
    fireEvent.keyDown(window, { key: '3' });

    await waitFor(() => {
      expect(screen.getByText('Session Completed!')).toBeDefined();
    });
  });
});
