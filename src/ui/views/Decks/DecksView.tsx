import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/database';
import { deckService } from '../../../services/deckService';
import type { Deck, DeckWithStats, DeckDeleteOptions, DeckSettings } from '../../../core/models/deck';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SearchInput } from '../../components/SearchInput';
import { Badge } from '../../components/Badge';
import { useToast } from '../../components/Toast';
import { useNavigation } from '../../navigation/NavigationContext';
import { DeckTreeItem } from './components/DeckTreeItem';
import { CreateEditDeckModal } from './components/CreateEditDeckModal';
import { MoveDeckModal } from './components/MoveDeckModal';
import { DeleteDeckModal } from './components/DeleteDeckModal';
import { NoteEditorModal } from '../Editor/NoteEditorModal';
import { AnkiImportModal } from '../Settings/components/AnkiImportModal';
import { AnkiExportModal } from '../Settings/components/AnkiExportModal';
import { Plus, Layers, ChevronDown, ChevronRight, Upload, Download } from 'lucide-react';

export const DecksView: React.FC = () => {
  const { navigateTo } = useNavigation();
  const { success, error: toastError } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedDeckIds, setExpandedDeckIds] = useState<Set<string>>(new Set());

  // Anki Import & Export Modals
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [exportDeckId, setExportDeckId] = useState<string | undefined>(undefined);

  // Modal States
  const [isCreateEditOpen, setIsCreateEditOpen] = useState(false);
  const [deckToEdit, setDeckToEdit] = useState<Deck | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [deckToMove, setDeckToMove] = useState<Deck | null>(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deckToDelete, setDeckToDelete] = useState<DeckWithStats | null>(null);

  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [noteEditorDeckId, setNoteEditorDeckId] = useState<string | undefined>(undefined);

  const [activeDescendantIds, setActiveDescendantIds] = useState<string[]>([]);

  // Live queries
  const deckHierarchy = useLiveQuery(() => deckService.getDeckHierarchy(), []);
  const allDecks = useLiveQuery(() => db.decks.filter((d) => d.deletedAt === null).toArray(), []) ?? [];

  // Toggle node expansion
  const handleToggleExpand = (deckId: string) => {
    setExpandedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) {
        next.delete(deckId);
      } else {
        next.add(deckId);
      }
      return next;
    });
  };

  const handleExpandAll = () => {
    if (!allDecks) return;
    setExpandedDeckIds(new Set(allDecks.map((d) => d.id)));
  };

  const handleCollapseAll = () => {
    setExpandedDeckIds(new Set());
  };

  // Open Add Note Modal
  const handleOpenAddNote = (deckId?: string) => {
    setNoteEditorDeckId(deckId);
    setIsNoteEditorOpen(true);
  };

  // Open Create Modal
  const handleOpenCreate = (parentId: string | null = null) => {
    setDeckToEdit(null);
    setDefaultParentId(parentId);
    setActiveDescendantIds([]);
    setIsCreateEditOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = async (deck: DeckWithStats) => {
    const descendants = await deckService.getSubdeckIds(deck.id);
    setDeckToEdit(deck);
    setDefaultParentId(null);
    setActiveDescendantIds(descendants);
    setIsCreateEditOpen(true);
  };

  // Open Move Modal
  const handleOpenMove = async (deck: DeckWithStats) => {
    const descendants = await deckService.getSubdeckIds(deck.id);
    setDeckToMove(deck);
    setActiveDescendantIds(descendants);
    setIsMoveOpen(true);
  };

  // Open Delete Modal
  const handleOpenDelete = async (deck: DeckWithStats) => {
    const descendants = await deckService.getSubdeckIds(deck.id);
    setDeckToDelete(deck);
    setActiveDescendantIds(descendants);
    setIsDeleteOpen(true);
  };

  // Handle Create or Edit submission
  const handleSaveDeck = async (data: {
    name: string;
    description: string;
    parentId: string | null;
    settings: DeckSettings;
  }) => {
    if (deckToEdit) {
      await deckService.updateDeck(deckToEdit.id, {
        name: data.name,
        description: data.description,
        settings: data.settings,
      });

      // If parent changed, move deck
      if (data.parentId !== deckToEdit.parentId) {
        await deckService.moveDeck(deckToEdit.id, data.parentId);
      }

      success(`Deck "${data.name}" updated successfully.`);
    } else {
      const created = await deckService.createDeck({
        name: data.name,
        description: data.description,
        parentId: data.parentId,
        settings: data.settings,
      });

      // If created as child, auto-expand parent
      if (data.parentId) {
        setExpandedDeckIds((prev) => new Set([...prev, data.parentId!]));
      }

      success(`Deck "${created.name}" created successfully.`);
    }
  };

  // Handle Move
  const handleMoveDeck = async (deckId: string, newParentId: string | null) => {
    const moved = await deckService.moveDeck(deckId, newParentId);
    if (newParentId) {
      setExpandedDeckIds((prev) => new Set([...prev, newParentId]));
    }
    success(`Moved "${moved.name}" successfully.`);
  };

  // Handle Delete
  const handleDeleteDeck = async (deckId: string, options: DeckDeleteOptions) => {
    await deckService.deleteDeck(deckId, options);
    success('Deck deleted successfully.');
  };

  // Handle Sibling Reordering (Move Up / Down)
  const handleMoveSibling = async (deckId: string, direction: 'up' | 'down') => {
    try {
      const targetDeck = allDecks.find((d) => d.id === deckId);
      if (!targetDeck) return;

      const siblings = allDecks
        .filter((d) => d.parentId === targetDeck.parentId)
        .sort((a, b) => a.order - b.order);

      const currentIndex = siblings.findIndex((d) => d.id === deckId);
      if (currentIndex === -1) return;

      const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (swapIndex < 0 || swapIndex >= siblings.length) return;

      // Swap elements
      const newSiblings = [...siblings];
      const temp = newSiblings[currentIndex]!;
      newSiblings[currentIndex] = newSiblings[swapIndex]!;
      newSiblings[swapIndex] = temp;

      await deckService.reorderDecks(newSiblings.map((s) => s.id));
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to reorder deck.');
    }
  };

  // Filter hierarchy by search query
  const filteredTree = useMemo(() => {
    if (!deckHierarchy) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return deckHierarchy;

    // Filter tree matching query in node name or any of its children
    const filterNodes = (nodes: DeckWithStats[]): DeckWithStats[] => {
      const result: DeckWithStats[] = [];

      for (const node of nodes) {
        const matchesSelf = node.name.toLowerCase().includes(query);
        const filteredChildren = filterNodes(node.children);

        if (matchesSelf || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren,
          });
        }
      }

      return result;
    };

    return filterNodes(deckHierarchy);
  }, [deckHierarchy, searchQuery]);

  // Recursively render tree nodes
  const renderTree = (nodes: DeckWithStats[], siblingList: DeckWithStats[]): React.ReactNode => {
    return nodes.map((node, index) => {
      const isExpanded = searchQuery.trim().length > 0 || expandedDeckIds.has(node.id);
      const canMoveUp = index > 0;
      const canMoveDown = index < siblingList.length - 1;

      return (
        <React.Fragment key={node.id}>
          <DeckTreeItem
            node={node}
            isExpanded={isExpanded}
            onToggleExpand={handleToggleExpand}
            onStudy={(dId) => navigateTo('study', { deckId: dId })}
            onAddNote={(dId) => handleOpenAddNote(dId)}
            onBrowseCards={(dId) => navigateTo('collection', { deckId: dId })}
            onAddSubdeck={(pId) => handleOpenCreate(pId)}
            onEdit={handleOpenEdit}
            onMove={handleOpenMove}
            onDelete={handleOpenDelete}
            onMoveUp={(dId) => handleMoveSibling(dId, 'up')}
            onMoveDown={(dId) => handleMoveSibling(dId, 'down')}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
          />
          {node.children.length > 0 && isExpanded && (
            <div className="space-y-0.5">
              {renderTree(node.children, node.children)}
            </div>
          )}
        </React.Fragment>
      );
    });
  };

  const isLoading = deckHierarchy === undefined;
  const totalDeckCount = allDecks.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--divider)]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
              Decks
            </h1>
            <Badge variant="neutral">
              {totalDeckCount} {totalDeckCount === 1 ? 'Deck' : 'Decks'}
            </Badge>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Organize your cards into hierarchical study collections.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setIsImportOpen(true)}
            leftIcon={<Upload className="w-4 h-4" />}
          >
            Import .apkg
          </Button>
          {totalDeckCount > 0 && (
            <Button
              variant="secondary"
              onClick={() => {
                setExportDeckId(undefined);
                setIsExportOpen(true);
              }}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Export
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={() => handleOpenAddNote()}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Add Note
          </Button>
          <Button
            variant="primary"
            onClick={() => handleOpenCreate(null)}
            leftIcon={<Plus className="w-4 h-4" />}
          >
            Create Deck
          </Button>
        </div>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <div className="py-16 text-center text-xs text-[var(--text-secondary)]">
          Loading decks...
        </div>
      ) : totalDeckCount === 0 ? (
        /* Empty State */
        <Card variant="standard" padding="lg" className="text-center py-16">
          <div className="w-12 h-12 mx-auto mb-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] border border-[var(--border-subtle)] flex items-center justify-center">
            <Layers className="w-6 h-6" />
          </div>

          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            No Decks Created Yet
          </h2>

          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto mt-1 mb-6 leading-relaxed">
            Create your first deck to start adding flashcards, or import an existing Anki collection (.apkg) with your notes, media, and review history.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="secondary"
              onClick={() => setIsImportOpen(true)}
              leftIcon={<Upload className="w-4 h-4" />}
            >
              Import Anki Deck (.apkg)
            </Button>
            <Button
              variant="primary"
              onClick={() => handleOpenCreate(null)}
              leftIcon={<Plus className="w-4 h-4" />}
            >
              Create Your First Deck
            </Button>
          </div>
        </Card>
      ) : (
        /* Deck List View */
        <div className="space-y-4">
          {/* Toolbar: Search & Expand/Collapse */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="max-w-sm flex-1">
              <SearchInput
                placeholder="Search decks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClear={() => setSearchQuery('')}
              />
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-auto text-xs text-[var(--text-secondary)]">
              <button
                type="button"
                onClick={handleExpandAll}
                className="px-2.5 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer flex items-center gap-1"
              >
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Expand All</span>
              </button>
              <span className="text-[var(--text-tertiary)]">·</span>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="px-2.5 py-1.5 rounded-[var(--radius-sm)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer flex items-center gap-1"
              >
                <ChevronRight className="w-3.5 h-3.5" />
                <span>Collapse All</span>
              </button>
            </div>
          </div>

          {/* Hierarchical Deck Tree */}
          <Card variant="standard" padding="none" className="p-2 space-y-0.5">
            {filteredTree.length === 0 ? (
              <div className="py-10 text-center text-xs text-[var(--text-tertiary)]">
                No decks matched "{searchQuery}".
              </div>
            ) : (
              renderTree(filteredTree, filteredTree)
            )}
          </Card>
        </div>
      )}

      {/* Modals */}
      <CreateEditDeckModal
        isOpen={isCreateEditOpen}
        onClose={() => setIsCreateEditOpen(false)}
        deckToEdit={deckToEdit}
        defaultParentId={defaultParentId}
        allDecks={allDecks}
        descendantIdsOfEditDeck={activeDescendantIds}
        onSubmit={handleSaveDeck}
      />

      <MoveDeckModal
        isOpen={isMoveOpen}
        onClose={() => setIsMoveOpen(false)}
        deck={deckToMove}
        allDecks={allDecks}
        descendantIds={activeDescendantIds}
        onMove={handleMoveDeck}
      />

      <DeleteDeckModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        deck={deckToDelete}
        allDecks={allDecks}
        descendantIds={activeDescendantIds}
        onDelete={handleDeleteDeck}
      />

      <NoteEditorModal
        isOpen={isNoteEditorOpen}
        onClose={() => setIsNoteEditorOpen(false)}
        defaultDeckId={noteEditorDeckId}
      />

      <AnkiImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
      />

      <AnkiExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        initialDeckId={exportDeckId}
      />
    </div>
  );
};
