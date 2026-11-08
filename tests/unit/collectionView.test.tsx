import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CollectionView } from '../../src/ui/views/Collection/CollectionView';
import { CollectionCardDrawer } from '../../src/ui/views/Collection/components/CollectionCardDrawer';
import { ToastProvider } from '../../src/ui/components/Toast';
import { NavigationProvider } from '../../src/ui/navigation/NavigationContext';
import { db } from '../../src/db/database';
import { cardService } from '../../src/services/cardService';
import { DEFAULT_NOTE_TYPES } from '../../src/db/migrations/v1';
import { DEFAULT_DECK_SETTINGS } from '../../src/core/models/deck';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <ToastProvider>
      <NavigationProvider>{ui}</NavigationProvider>
    </ToastProvider>
  );
};

describe('Collection Browser & Card Management (Phase 3.4)', () => {
  beforeEach(async () => {
    await db.initialize();
    await db.notes.clear();
    await db.cards.clear();
    await db.decks.clear();

    const count = await db.noteTypes.count();
    if (count === 0) {
      await db.noteTypes.bulkAdd(DEFAULT_NOTE_TYPES);
    }

    // Seed test decks
    await db.decks.bulkAdd([
      {
        id: 'deck-vocab',
        name: 'Vocabulary',
        parentId: null,
        description: 'Language vocab',
        settings: DEFAULT_DECK_SETTINGS,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      },
      {
        id: 'deck-science',
        name: 'Science',
        parentId: null,
        description: 'Physics & Bio',
        settings: DEFAULT_DECK_SETTINGS,
        order: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
      },
    ]);
  });

  it('renders empty state when collection contains zero notes', async () => {
    renderWithProviders(<CollectionView />);

    await waitFor(() => {
      expect(screen.getByText('No Flashcards in Collection')).toBeDefined();
    });
    expect(screen.getByRole('button', { name: /create your first note/i })).toBeDefined();
  });

  it('renders notes list with front/back snippets, note types, and decks', async () => {
    // Seed notes
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-vocab',
      fieldValues: {
        Front: 'Hola',
        Back: 'Hello in Spanish',
      },
      tags: ['spanish', 'greetings'],
    });

    await cardService.createNoteWithCards({
      noteTypeId: 'default-cloze',
      deckId: 'deck-science',
      fieldValues: {
        Text: 'Water boils at {{c1::100}} degrees Celsius.',
        Extra: 'Under standard pressure',
      },
      tags: ['physics'],
    });

    renderWithProviders(<CollectionView />);

    await waitFor(() => {
      expect(screen.getByText('Hola')).toBeDefined();
      expect(screen.getByText('Hello in Spanish')).toBeDefined();
      expect(screen.getByText(/water boils at/i)).toBeDefined();
    });

    expect(screen.getAllByText('Vocabulary').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Science').length).toBeGreaterThan(0);
    expect(screen.getByText('spanish')).toBeDefined();
    expect(screen.getByText('physics')).toBeDefined();
  });

  it('filters notes using fulltext search across fields and tags', async () => {
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-vocab',
      fieldValues: {
        Front: 'Bonjour',
        Back: 'Hello in French',
      },
      tags: ['french'],
    });

    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-vocab',
      fieldValues: {
        Front: 'Guten Tag',
        Back: 'Good day in German',
      },
      tags: ['german'],
    });

    renderWithProviders(<CollectionView />);

    await waitFor(() => {
      expect(screen.getByText('Bonjour')).toBeDefined();
      expect(screen.getByText('Guten Tag')).toBeDefined();
    });

    // Search for "French"
    const searchInput = screen.getByPlaceholderText(/search front, back, tags/i);
    fireEvent.change(searchInput, { target: { value: 'french' } });

    await waitFor(() => {
      expect(screen.getByText('Bonjour')).toBeDefined();
      expect(screen.queryByText('Guten Tag')).toBeNull();
    });
  });

  it('filters notes by deck selection', async () => {
    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-vocab',
      fieldValues: { Front: 'Card In Vocab', Back: 'Vocab Back' },
      tags: [],
    });

    await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-science',
      fieldValues: { Front: 'Card In Science', Back: 'Science Back' },
      tags: [],
    });

    renderWithProviders(<CollectionView />);

    await waitFor(() => {
      expect(screen.getByText('Card In Vocab')).toBeDefined();
      expect(screen.getByText('Card In Science')).toBeDefined();
    });

    // Find the deck select (it contains 'All Decks')
    const selects = screen.getAllByRole('combobox');
    const deckSelect = selects.find((s) => (s as HTMLSelectElement).value === 'all');
    expect(deckSelect).toBeDefined();

    fireEvent.change(deckSelect!, { target: { value: 'deck-science' } });

    await waitFor(() => {
      expect(screen.queryByText('Card In Vocab')).toBeNull();
      expect(screen.getByText('Card In Science')).toBeDefined();
    });
  });

  it('toggles flagged status on card from collection list', async () => {
    const { cards } = await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-vocab',
      fieldValues: { Front: 'Flag Test Note', Back: 'Flag Test Back' },
      tags: [],
    });

    expect(Boolean(cards[0]?.isFlagged)).toBe(false);

    renderWithProviders(<CollectionView />);

    await waitFor(() => {
      expect(screen.getByText('Flag Test Note')).toBeDefined();
    });

    const flagButton = screen.getByRole('button', { name: /flag card/i });
    fireEvent.click(flagButton);

    await waitFor(async () => {
      const updated = await db.cards.get(cards[0]!.id);
      expect(updated?.isFlagged).toBe(true);
    });
  });

  it('deletes a note and its cards cleanly through confirm dialog', async () => {
    const { note, cards } = await cardService.createNoteWithCards({
      noteTypeId: 'default-basic',
      deckId: 'deck-vocab',
      fieldValues: { Front: 'Note to be deleted', Back: 'Back content' },
      tags: [],
    });

    renderWithProviders(<CollectionView />);

    await waitFor(() => {
      expect(screen.getByText('Note to be deleted')).toBeDefined();
    });

    // Open dropdown menu
    const moreButton = screen.getByRole('button', { name: /note actions/i });
    fireEvent.click(moreButton);

    const deleteMenuItem = screen.getByText('Delete Note');
    fireEvent.click(deleteMenuItem);

    // Confirm dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/are you sure you want to delete this note/i)).toBeDefined();
    });

    const confirmButtons = screen.getAllByRole('button', { name: /delete note/i });
    const modalConfirmBtn = confirmButtons[confirmButtons.length - 1]!;
    fireEvent.click(modalConfirmBtn);

    await waitFor(async () => {
      const deletedNote = await db.notes.get(note.id);
      expect(deletedNote?.deletedAt).not.toBeNull();
      const deletedCard = await db.cards.get(cards[0]!.id);
      expect(deletedCard?.deletedAt).not.toBeNull();
    });
  });

  describe('CollectionCardDrawer', () => {
    it('displays card level metrics and allows toggling suspend', async () => {
      const { note, cards } = await cardService.createNoteWithCards({
        noteTypeId: 'default-basic',
        deckId: 'deck-vocab',
        fieldValues: { Front: 'Drawer Front', Back: 'Drawer Back' },
        tags: ['test'],
      });

      const noteType = (await db.noteTypes.get('default-basic'))!;
      const deck = (await db.decks.get('deck-vocab'))!;

      const handleClose = vi.fn();
      const handleEdit = vi.fn();
      const handleRefresh = vi.fn();

      renderWithProviders(
        <CollectionCardDrawer
          isOpen={true}
          onClose={handleClose}
          item={{
            note,
            cards,
            noteType,
            decks: [deck],
          }}
          allDecks={[deck]}
          onEditNote={handleEdit}
          onRefresh={handleRefresh}
        />
      );

      expect(screen.getByText('New Card')).toBeDefined();
      expect(screen.getByText('Card Deck Assignment')).toBeDefined();

      const suspendButton = screen.getByRole('button', { name: /suspend/i });
      fireEvent.click(suspendButton);

      await waitFor(async () => {
        const updated = await db.cards.get(cards[0]!.id);
        expect(updated?.isSuspended).toBe(true);
      });
    });
  });
});
