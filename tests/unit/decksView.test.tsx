import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DeckTreeItem } from '../../src/ui/views/Decks/components/DeckTreeItem';
import { CreateEditDeckModal } from '../../src/ui/views/Decks/components/CreateEditDeckModal';
import { MoveDeckModal } from '../../src/ui/views/Decks/components/MoveDeckModal';
import { DeleteDeckModal } from '../../src/ui/views/Decks/components/DeleteDeckModal';
import { DecksView } from '../../src/ui/views/Decks/DecksView';
import { ToastProvider } from '../../src/ui/components/Toast';
import { NavigationProvider } from '../../src/ui/navigation/NavigationContext';
import { DEFAULT_DECK_SETTINGS, type DeckWithStats } from '../../src/core/models/deck';
import { db } from '../../src/db/database';

describe('Deck Management UI Components', () => {
  const mockNode: DeckWithStats = {
    id: 'deck-1',
    name: 'Spanish',
    description: 'Spanish vocabulary',
    parentId: null,
    settings: DEFAULT_DECK_SETTINGS,
    order: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    deletedAt: null,
    level: 0,
    directCounts: { total: 10, newCount: 3, dueCount: 2 },
    totalCounts: { total: 25, newCount: 8, dueCount: 5 },
    children: [
      {
        id: 'deck-2',
        name: 'A1 Basics',
        description: '',
        parentId: 'deck-1',
        settings: DEFAULT_DECK_SETTINGS,
        order: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
        level: 1,
        directCounts: { total: 15, newCount: 5, dueCount: 3 },
        totalCounts: { total: 15, newCount: 5, dueCount: 3 },
        children: [],
      },
    ],
  };

  describe('DeckTreeItem', () => {
    it('renders deck name, description, and direct/total card badges', () => {
      const handleToggle = vi.fn();
      const handleStudy = vi.fn();

      render(
        <DeckTreeItem
          node={mockNode}
          isExpanded={false}
          onToggleExpand={handleToggle}
          onStudy={handleStudy}
          onAddSubdeck={vi.fn()}
          onEdit={vi.fn()}
          onMove={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      expect(screen.getByText('Spanish')).toBeDefined();
      expect(screen.getByText('Spanish vocabulary')).toBeDefined();
      expect(screen.getByText('1 subdeck')).toBeDefined();
      // Badges distinguish direct vs total: e.g. "3 (8) new"
      expect(screen.getByText('3 (8) new')).toBeDefined();
      expect(screen.getByText('2 (5) due')).toBeDefined();
    });

    it('triggers expand toggle and study callback', () => {
      const handleToggle = vi.fn();
      const handleStudy = vi.fn();

      render(
        <DeckTreeItem
          node={mockNode}
          isExpanded={false}
          onToggleExpand={handleToggle}
          onStudy={handleStudy}
          onAddSubdeck={vi.fn()}
          onEdit={vi.fn()}
          onMove={vi.fn()}
          onDelete={vi.fn()}
        />
      );

      const expandBtn = screen.getByRole('button', { name: /expand subdecks/i });
      fireEvent.click(expandBtn);
      expect(handleToggle).toHaveBeenCalledWith('deck-1');

      const studyBtn = screen.getByRole('button', { name: /^study$/i });
      fireEvent.click(studyBtn);
      expect(handleStudy).toHaveBeenCalledWith('deck-1');
    });
  });

  describe('CreateEditDeckModal', () => {
    it('renders form and submits new deck data', async () => {
      const handleSubmit = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <CreateEditDeckModal
          isOpen={true}
          onClose={handleClose}
          allDecks={[]}
          onSubmit={handleSubmit}
        />
      );

      expect(screen.getByText('Create New Deck')).toBeDefined();

      const nameInput = screen.getByLabelText(/deck name/i);
      fireEvent.change(nameInput, { target: { value: 'Biology' } });

      const descInput = screen.getByLabelText(/description/i);
      fireEvent.change(descInput, { target: { value: 'Cell biology notes' } });

      const submitBtn = screen.getByRole('button', { name: /create deck/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Biology',
            description: 'Cell biology notes',
            parentId: null,
          })
        );
      });
    });

    it('validates empty deck name', async () => {
      const handleSubmit = vi.fn();

      render(
        <CreateEditDeckModal
          isOpen={true}
          onClose={vi.fn()}
          allDecks={[]}
          onSubmit={handleSubmit}
        />
      );

      const form = screen.getByRole('button', { name: /create deck/i }).closest('form')!;
      fireEvent.submit(form);

      expect(screen.getByText('Please provide a deck name.')).toBeDefined();
      expect(handleSubmit).not.toHaveBeenCalled();
    });
  });

  describe('MoveDeckModal', () => {
    it('filters out self and descendants from available parent destinations', () => {
      const handleMove = vi.fn().mockResolvedValue(undefined);

      const allDecks = [
        mockNode,
        mockNode.children[0]!,
        {
          id: 'deck-3',
          name: 'History',
          parentId: null,
          description: '',
          settings: DEFAULT_DECK_SETTINGS,
          order: 1,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          deletedAt: null,
        },
      ];

      render(
        <MoveDeckModal
          isOpen={true}
          onClose={vi.fn()}
          deck={mockNode}
          allDecks={allDecks}
          descendantIds={['deck-2']}
          onMove={handleMove}
        />
      );

      expect(screen.getByText(/Select a new location for "Spanish"/i)).toBeDefined();

      const select = screen.getByLabelText(/new destination parent/i) as HTMLSelectElement;
      const options = Array.from(select.options).map((o) => o.label);

      // Should contain Root and History, but NOT Spanish (self) or A1 Basics (descendant)
      expect(options).toContain('(None) Top-level root');
      expect(options).toContain('History');
      expect(options).not.toContain('Spanish');
      expect(options).not.toContain('A1 Basics');
    });
  });

  describe('DeleteDeckModal', () => {
    it('shows card and subdeck counts with safe deletion options', async () => {
      const handleDelete = vi.fn().mockResolvedValue(undefined);
      const handleClose = vi.fn();

      render(
        <DeleteDeckModal
          isOpen={true}
          onClose={handleClose}
          deck={mockNode}
          allDecks={[mockNode]}
          descendantIds={['deck-2']}
          onDelete={handleDelete}
        />
      );

      expect(screen.getAllByText(/Delete Deck/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Spanish/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/10/i)).toBeDefined(); // direct cards
      expect(screen.getByText(/1 subdeck/i)).toBeDefined(); // subdeck warning
      expect(screen.getByText('Soft-delete cards')).toBeDefined();
      expect(screen.getByText('Promote subdecks up (Reparent)')).toBeDefined();

      const deleteBtn = screen.getByRole('button', { name: /^delete deck$/i });
      fireEvent.click(deleteBtn);

      await waitFor(() => {
        expect(handleDelete).toHaveBeenCalledWith('deck-1', {
          cardAction: 'delete',
          subdeckAction: 'reparent',
          targetDeckId: undefined,
        });
      });
    });
  });

  describe('DecksView', () => {
    beforeEach(async () => {
      // Clear decks for clean test
      await db.decks.clear();
      await db.cards.clear();
    });

    it('renders empty state when no decks are stored in database', async () => {
      render(
        <NavigationProvider>
          <ToastProvider>
            <DecksView />
          </ToastProvider>
        </NavigationProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('No Decks Created Yet')).toBeDefined();
        expect(screen.getByText('Create Your First Deck')).toBeDefined();
      });
    });
  });
});
