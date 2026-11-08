import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/database';
import { cardService, type NoteWithCards } from '../../../services/cardService';
import type { NoteType } from '../../../core/models/noteType';
import type { Note } from '../../../core/models/note';
import { CardState } from '../../../core/models/card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { SearchInput } from '../../components/SearchInput';
import { Select } from '../../components/Select';
import { Dropdown } from '../../components/Dropdown';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { useToast } from '../../components/Toast';
import { useNavigation } from '../../navigation/NavigationContext';
import { NoteEditorModal } from '../Editor/NoteEditorModal';
import { CollectionCardDrawer } from './components/CollectionCardDrawer';
import {
  Plus,
  Filter,
  ArrowUpDown,
  Layers,
  Flag,
  PauseCircle,
  MoreVertical,
  Edit2,
  Trash2,
  Eye,
  RotateCcw,
  Tag as TagIcon,
} from 'lucide-react';

export type StatusFilterOption = 'all' | 'new' | 'due' | 'review' | 'suspended' | 'flagged';
export type SortOption = 'updated-desc' | 'created-desc' | 'front-asc' | 'front-desc' | 'cards-desc';

/**
 * Strips HTML tags and collapses spaces for clean snippet display.
 */
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Returns the primary (front) and secondary (back) text snippets of a note.
 */
function getNoteFieldSnippets(note: Note, noteType?: NoteType): { frontText: string; backText: string } {
  if (!noteType || noteType.fields.length === 0) {
    const keys = Object.keys(note.fieldValues);
    return {
      frontText: stripHtml(note.fieldValues[keys[0] ?? ''] ?? ''),
      backText: stripHtml(note.fieldValues[keys[1] ?? ''] ?? ''),
    };
  }

  const firstFieldName = noteType.fields[0]?.name ?? '';
  const secondFieldName = noteType.fields[1]?.name ?? '';

  return {
    frontText: stripHtml(note.fieldValues[firstFieldName] ?? Object.values(note.fieldValues)[0] ?? ''),
    backText: stripHtml(note.fieldValues[secondFieldName] ?? Object.values(note.fieldValues)[1] ?? ''),
  };
}

export const CollectionView: React.FC = () => {
  const { routeParams } = useNavigation();
  const { success, error: toastError } = useToast();

  // Search, Filters & Sorting state
  const [searchQuery, setSearchQuery] = useState('');
  const [deckFilter, setDeckFilter] = useState<string>(routeParams.deckId ?? 'all');
  const [noteTypeFilter, setNoteTypeFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilterOption>('all');
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc');

  // Modal / Drawer state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [noteToEdit, setNoteToEdit] = useState<Note | null>(null);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerItem, setDrawerItem] = useState<NoteWithCards | null>(null);

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<NoteWithCards | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Live queries
  const collectionItems = useLiveQuery(() => cardService.getCollectionItems(), []);
  const allDecks = useLiveQuery(() => db.decks.filter((d) => d.deletedAt === null).toArray(), []) ?? [];
  const allNoteTypes = useLiveQuery(() => db.noteTypes.filter((nt) => nt.deletedAt === null).toArray(), []) ?? [];

  // Extract all unique tags across all notes
  const availableTags = useMemo(() => {
    if (!collectionItems) return [];
    const set = new Set<string>();
    for (const item of collectionItems) {
      for (const t of item.note.tags) {
        if (t.trim()) set.add(t.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [collectionItems]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    deckFilter !== 'all' ||
    noteTypeFilter !== 'all' ||
    tagFilter !== 'all' ||
    statusFilter !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setDeckFilter('all');
    setNoteTypeFilter('all');
    setTagFilter('all');
    setStatusFilter('all');
  };

  // Filter & Sort Logic
  const filteredAndSortedItems = useMemo(() => {
    if (!collectionItems) return [];

    const now = Date.now();
    const query = searchQuery.trim().toLowerCase();

    const filtered = collectionItems.filter((item) => {
      // 1. Search Query Filter
      if (query) {
        const matchesField = Object.values(item.note.fieldValues).some((val) =>
          stripHtml(String(val)).toLowerCase().includes(query)
        );
        const matchesTag = item.note.tags.some((t) => t.toLowerCase().includes(query));
        const matchesNoteType = item.noteType.name.toLowerCase().includes(query);
        const matchesDeck = item.decks.some((d) => d.name.toLowerCase().includes(query));

        if (!matchesField && !matchesTag && !matchesNoteType && !matchesDeck) {
          return false;
        }
      }

      // 2. Deck Filter
      if (deckFilter !== 'all') {
        const inDeck = item.cards.some((c) => c.deckId === deckFilter);
        if (!inDeck) return false;
      }

      // 3. NoteType Filter
      if (noteTypeFilter !== 'all') {
        if (item.note.noteTypeId !== noteTypeFilter) return false;
      }

      // 4. Tag Filter
      if (tagFilter !== 'all') {
        if (!item.note.tags.includes(tagFilter)) return false;
      }

      // 5. Status Filter
      if (statusFilter !== 'all') {
        switch (statusFilter) {
          case 'new':
            if (!item.cards.some((c) => c.state === CardState.New)) return false;
            break;
          case 'due':
            if (!item.cards.some((c) => !c.isSuspended && c.due <= now && c.state !== CardState.New)) return false;
            break;
          case 'review':
            if (!item.cards.some((c) => c.state === CardState.Review)) return false;
            break;
          case 'suspended':
            if (!item.cards.some((c) => c.isSuspended)) return false;
            break;
          case 'flagged':
            if (!item.cards.some((c) => c.isFlagged)) return false;
            break;
        }
      }

      return true;
    });

    // Sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'updated-desc':
          return b.note.updatedAt - a.note.updatedAt;
        case 'created-desc':
          return b.note.createdAt - a.note.createdAt;
        case 'front-asc': {
          const aFront = getNoteFieldSnippets(a.note, a.noteType).frontText;
          const bFront = getNoteFieldSnippets(b.note, b.noteType).frontText;
          return aFront.localeCompare(bFront);
        }
        case 'front-desc': {
          const aFront = getNoteFieldSnippets(a.note, a.noteType).frontText;
          const bFront = getNoteFieldSnippets(b.note, b.noteType).frontText;
          return bFront.localeCompare(aFront);
        }
        case 'cards-desc':
          return b.cards.length - a.cards.length;
        default:
          return 0;
      }
    });
  }, [collectionItems, searchQuery, deckFilter, noteTypeFilter, tagFilter, statusFilter, sortBy]);

  // Action Handlers
  const handleOpenAddNote = () => {
    setNoteToEdit(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditNote = (item: NoteWithCards) => {
    setNoteToEdit(item.note);
    setIsEditorOpen(true);
    setIsDrawerOpen(false);
  };

  const handleOpenDrawer = (item: NoteWithCards) => {
    setDrawerItem(item);
    setIsDrawerOpen(true);
  };

  const handlePromptDeleteNote = (item: NoteWithCards) => {
    setNoteToDelete(item);
    setIsConfirmDeleteOpen(true);
  };

  const handleConfirmDeleteNote = async () => {
    if (!noteToDelete) return;
    setIsDeleting(true);
    try {
      await cardService.deleteNoteAndCards(noteToDelete.note.id);
      success('Note and associated cards deleted.');
      setIsConfirmDeleteOpen(false);
      setIsDrawerOpen(false);
      setNoteToDelete(null);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete note.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleNoteFlag = async (item: NoteWithCards, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const anyFlagged = item.cards.some((c) => c.isFlagged);
      const nextFlag = !anyFlagged;
      for (const card of item.cards) {
        await cardService.setCardFlagged(card.id, nextFlag);
      }
      success(nextFlag ? 'Flagged all cards in note.' : 'Unflagged all cards in note.');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to update flag.');
    }
  };

  const handleToggleNoteSuspend = async (item: NoteWithCards, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const anySuspended = item.cards.some((c) => c.isSuspended);
      const nextSuspend = !anySuspended;
      for (const card of item.cards) {
        await cardService.setCardSuspended(card.id, nextSuspend);
      }
      success(nextSuspend ? 'Suspended cards in note.' : 'Unsuspended cards in note.');
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to update suspension.');
    }
  };

  const isLoading = collectionItems === undefined;
  const totalCount = collectionItems?.length ?? 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--divider)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Collection
            </h1>
            <Badge variant="neutral">
              {totalCount} {totalCount === 1 ? 'Note' : 'Notes'}
            </Badge>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Browse, search, edit, and organize all flashcards and notes in your repository.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            onClick={handleOpenAddNote}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Note
          </Button>
        </div>
      </div>

      {/* Main View Area */}
      {isLoading ? (
        <div className="py-20 text-center text-xs text-[var(--text-secondary)]">
          Loading collection...
        </div>
      ) : totalCount === 0 ? (
        /* Empty State: Zero Notes in Entire DB */
        <Card variant="standard" padding="lg" className="text-center py-16">
          <div className="w-12 h-12 mx-auto mb-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>

          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            No Flashcards in Collection
          </h2>

          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto mt-1 mb-6 leading-relaxed">
            Your collection is completely empty. Create your first note with Basic or Cloze deletion cards to begin your study journey.
          </p>

          <Button
            variant="primary"
            onClick={handleOpenAddNote}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Your First Note
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Controls: Search, Filters & Sorting */}
          <div className="flex flex-col gap-3">
            {/* Top row: Search input + Sort selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex-1 max-w-md">
                <SearchInput
                  placeholder="Search front, back, tags, decks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onClear={() => setSearchQuery('')}
                />
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1">
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  Sort:
                </span>
                <div className="w-44">
                  <Select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    options={[
                      { value: 'updated-desc', label: 'Recently Modified' },
                      { value: 'created-desc', label: 'Date Created' },
                      { value: 'front-asc', label: 'Front (A to Z)' },
                      { value: 'front-desc', label: 'Front (Z to A)' },
                      { value: 'cards-desc', label: 'Card Count' },
                    ]}
                  />
                </div>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
              <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] pr-1">
                <Filter className="w-3.5 h-3.5" />
                <span>Filters:</span>
              </div>

              {/* Deck Filter */}
              <div className="w-36">
                <Select
                  value={deckFilter}
                  onChange={(e) => setDeckFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Decks' },
                    ...allDecks.map((d) => ({ value: d.id, label: d.name })),
                  ]}
                />
              </div>

              {/* NoteType Filter */}
              <div className="w-36">
                <Select
                  value={noteTypeFilter}
                  onChange={(e) => setNoteTypeFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Note Types' },
                    ...allNoteTypes.map((nt) => ({ value: nt.id, label: nt.name })),
                  ]}
                />
              </div>

              {/* Tag Filter */}
              <div className="w-32">
                <Select
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  options={[
                    { value: 'all', label: 'All Tags' },
                    ...availableTags.map((t) => ({ value: t, label: `#${t}` })),
                  ]}
                />
              </div>

              {/* Status Filter */}
              <div className="w-36">
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as StatusFilterOption)}
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'new', label: 'Status: New' },
                    { value: 'due', label: 'Status: Due' },
                    { value: 'review', label: 'Status: In Review' },
                    { value: 'suspended', label: 'Suspended' },
                    { value: 'flagged', label: 'Flagged' },
                  ]}
                />
              </div>

              {/* Reset Filters CTA */}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="ml-auto text-xs text-[var(--text-tertiary)] hover:text-[var(--accent)] flex items-center gap-1 px-2 py-1 rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Filters</span>
                </button>
              )}
            </div>
          </div>

          {/* Results Count & Status Summary */}
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] px-1">
            <span>
              Showing {filteredAndSortedItems.length} of {totalCount} {totalCount === 1 ? 'note' : 'notes'}
            </span>
            {hasActiveFilters && (
              <span className="text-[var(--text-tertiary)]">Filtered view</span>
            )}
          </div>

          {/* Notes List / Table */}
          {filteredAndSortedItems.length === 0 ? (
            /* Empty Filter Match */
            <Card variant="standard" padding="lg" className="text-center py-12">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                No matching notes found
              </p>
              <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto mt-1 mb-4">
                No notes match the current search query or filter configuration.
              </p>
              <Button variant="secondary" size="sm" onClick={handleResetFilters} leftIcon={<RotateCcw className="w-3.5 h-3.5" />}>
                Clear All Filters
              </Button>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredAndSortedItems.map((item) => {
                const { frontText, backText } = getNoteFieldSnippets(item.note, item.noteType);
                const isAnyFlagged = item.cards.some((c) => c.isFlagged);
                const isAnySuspended = item.cards.some((c) => c.isSuspended);
                const isAnyDue = item.cards.some(
                  (c) => !c.isSuspended && c.due <= Date.now() && c.state !== CardState.New
                );

                const dropdownItems = [
                  {
                    id: 'inspect',
                    label: 'Inspect Details',
                    icon: <Eye className="w-3.5 h-3.5" />,
                    onClick: () => handleOpenDrawer(item),
                  },
                  {
                    id: 'edit',
                    label: 'Edit Note',
                    icon: <Edit2 className="w-3.5 h-3.5" />,
                    onClick: () => handleOpenEditNote(item),
                  },
                  {
                    id: 'toggle-flag',
                    label: isAnyFlagged ? 'Unflag Note' : 'Flag Note',
                    icon: <Flag className="w-3.5 h-3.5 text-amber-500" />,
                    onClick: () => {
                      const anyFlagged = item.cards.some((c) => c.isFlagged);
                      const nextFlag = !anyFlagged;
                      Promise.all(item.cards.map((c) => cardService.setCardFlagged(c.id, nextFlag))).catch(console.error);
                    },
                  },
                  {
                    id: 'toggle-suspend',
                    label: isAnySuspended ? 'Unsuspend Note' : 'Suspend Note',
                    icon: <PauseCircle className="w-3.5 h-3.5" />,
                    onClick: () => {
                      const anySuspended = item.cards.some((c) => c.isSuspended);
                      const nextSuspend = !anySuspended;
                      Promise.all(item.cards.map((c) => cardService.setCardSuspended(c.id, nextSuspend))).catch(console.error);
                    },
                  },
                  {
                    id: 'delete',
                    label: 'Delete Note',
                    icon: <Trash2 className="w-3.5 h-3.5" />,
                    onClick: () => handlePromptDeleteNote(item),
                    isDestructive: true,
                  },
                ];

                return (
                  <Card
                    key={item.note.id}
                    variant="interactive"
                    padding="md"
                    onClick={() => handleOpenDrawer(item)}
                    className="group relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-colors"
                  >
                    {/* Left: Content Preview & Badges */}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        {/* Note Type Badge */}
                        <Badge variant="neutral" className="text-[10px] uppercase font-mono tracking-wider">
                          {item.noteType.name}
                        </Badge>

                        {/* Deck Names */}
                        {item.decks.map((deck) => (
                          <Badge
                            key={deck.id}
                            variant="neutral"
                            className="text-[11px] bg-[var(--bg-subtle)]"
                          >
                            <Layers className="w-3 h-3 mr-1 text-[var(--accent)]" />
                            {deck.name}
                          </Badge>
                        ))}

                        {/* Card Count Pill */}
                        <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
                          {item.cards.length} {item.cards.length === 1 ? 'card' : 'cards'}
                        </span>

                        {/* Status Badges */}
                        {isAnyDue && (
                          <Badge variant="accent" className="text-[10px]">
                            Due
                          </Badge>
                        )}
                        {isAnySuspended && (
                          <Badge variant="neutral" className="text-[10px] opacity-75">
                            Suspended
                          </Badge>
                        )}
                      </div>

                      {/* Front and Back previews */}
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
                          {frontText || <span className="italic text-[var(--text-tertiary)]">(Empty Front)</span>}
                        </div>
                        {backText && (
                          <div className="text-xs text-[var(--text-secondary)] truncate">
                            {backText}
                          </div>
                        )}
                      </div>

                      {/* Tags */}
                      {item.note.tags.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          {item.note.tags.map((tag) => (
                            <span
                              key={tag}
                              className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] px-1.5 py-0.5 rounded-[var(--radius-sm)] flex items-center gap-0.5"
                            >
                              <TagIcon className="w-2.5 h-2.5" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Right: Quick actions & dropdown menu */}
                    <div
                      className="flex items-center gap-2 self-end sm:self-center shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Flag quick toggle button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleNoteFlag(item, e)}
                        aria-label={isAnyFlagged ? 'Unflag card' : 'Flag card'}
                        className={`p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                          isAnyFlagged
                            ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <Flag className="w-4 h-4" />
                      </button>

                      {/* Suspend quick toggle button */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleNoteSuspend(item, e)}
                        aria-label={isAnySuspended ? 'Unsuspend card' : 'Suspend card'}
                        className={`p-1.5 rounded-[var(--radius-sm)] transition-colors cursor-pointer ${
                          isAnySuspended
                            ? 'text-[var(--accent)] bg-[var(--accent-subtle)] hover:bg-[var(--accent-subtle)]/80'
                            : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <PauseCircle className="w-4 h-4" />
                      </button>

                      {/* More Menu Dropdown */}
                      <Dropdown
                        items={dropdownItems}
                        trigger={
                          <button
                            type="button"
                            aria-label="Note actions"
                            className="p-1.5 rounded-[var(--radius-sm)] text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        }
                      />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Note Editor Modal (Create or Edit) */}
      <NoteEditorModal
        isOpen={isEditorOpen}
        onClose={() => {
          setIsEditorOpen(false);
          setNoteToEdit(null);
        }}
        noteToEdit={noteToEdit}
        defaultDeckId={deckFilter !== 'all' ? deckFilter : undefined}
        onSuccess={() => {
          setIsEditorOpen(false);
          setNoteToEdit(null);
          // If drawer was open, refresh its data
          if (drawerItem) {
            cardService.getCollectionItems().then((items) => {
              const updated = items.find((it) => it.note.id === drawerItem.note.id);
              if (updated) setDrawerItem(updated);
            });
          }
        }}
      />

      {/* Card Details / Drawer */}
      <CollectionCardDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        item={drawerItem}
        allDecks={allDecks}
        onEditNote={() => {
          if (drawerItem) handleOpenEditNote(drawerItem);
        }}
        onRefresh={async () => {
          if (!drawerItem) return;
          const items = await cardService.getCollectionItems();
          const refreshed = items.find((i) => i.note.id === drawerItem.note.id);
          if (refreshed) {
            setDrawerItem(refreshed);
          } else {
            setIsDrawerOpen(false);
          }
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => {
          setIsConfirmDeleteOpen(false);
          setNoteToDelete(null);
        }}
        onConfirm={handleConfirmDeleteNote}
        title="Delete Note"
        message={`Are you sure you want to delete this note and its ${noteToDelete?.cards.length ?? 0} flashcards? Note contents and cards will be removed from your active review queues. (Past review statistics remain permanently safeguarded).`}
        confirmLabel="Delete Note"
        isDestructive
        isLoading={isDeleting}
      />
    </div>
  );
};
