import React from 'react';
import type { DeckWithStats } from '../../../../core/models/deck';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Dropdown } from '../../../components/Dropdown';
import {
  ChevronRight,
  ChevronDown,
  Layers,
  MoreVertical,
  Plus,
  Edit2,
  FolderInput,
  ArrowUp,
  ArrowDown,
  Trash2,
  BookOpen,
  PlusCircle,
  Library,
} from 'lucide-react';

export interface DeckTreeItemProps {
  node: DeckWithStats;
  isExpanded: boolean;
  onToggleExpand: (deckId: string) => void;
  onStudy: (deckId: string) => void;
  onAddNote?: (deckId: string) => void;
  onBrowseCards?: (deckId: string) => void;
  onAddSubdeck: (parentId: string) => void;
  onEdit: (deck: DeckWithStats) => void;
  onMove: (deck: DeckWithStats) => void;
  onDelete: (deck: DeckWithStats) => void;
  onMoveUp?: (deckId: string) => void;
  onMoveDown?: (deckId: string) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export const DeckTreeItem: React.FC<DeckTreeItemProps> = ({
  node,
  isExpanded,
  onToggleExpand,
  onStudy,
  onAddNote,
  onBrowseCards,
  onAddSubdeck,
  onEdit,
  onMove,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
}) => {
  const hasChildren = node.children.length > 0;
  const indentPadding = Math.min(node.level * 20, 100);

  const direct = node.directCounts;
  const total = node.totalCounts;
  const hasSubdeckCounts = hasChildren && total.total !== direct.total;

  const dropdownItems = [
    {
      id: 'study',
      label: 'Study Deck',
      icon: <BookOpen className="w-3.5 h-3.5 text-[var(--accent)]" />,
      onClick: () => onStudy(node.id),
      disabled: total.total === 0,
    },
    ...(onAddNote
      ? [
          {
            id: 'add-note',
            label: 'Add Note',
            icon: <PlusCircle className="w-3.5 h-3.5 text-[var(--accent)]" />,
            onClick: () => onAddNote(node.id),
          },
        ]
      : []),
    ...(onBrowseCards
      ? [
          {
            id: 'browse-cards',
            label: 'Browse Cards',
            icon: <Library className="w-3.5 h-3.5" />,
            onClick: () => onBrowseCards(node.id),
          },
        ]
      : []),
    {
      id: 'add-subdeck',
      label: 'Add Subdeck',
      icon: <Plus className="w-3.5 h-3.5" />,
      onClick: () => onAddSubdeck(node.id),
    },
    {
      id: 'edit',
      label: 'Edit Settings',
      icon: <Edit2 className="w-3.5 h-3.5" />,
      onClick: () => onEdit(node),
    },
    {
      id: 'move',
      label: 'Move Deck',
      icon: <FolderInput className="w-3.5 h-3.5" />,
      onClick: () => onMove(node),
    },
    ...(onMoveUp
      ? [
          {
            id: 'move-up',
            label: 'Move Up',
            icon: <ArrowUp className="w-3.5 h-3.5" />,
            onClick: () => onMoveUp(node.id),
            disabled: !canMoveUp,
          },
        ]
      : []),
    ...(onMoveDown
      ? [
          {
            id: 'move-down',
            label: 'Move Down',
            icon: <ArrowDown className="w-3.5 h-3.5" />,
            onClick: () => onMoveDown(node.id),
            disabled: !canMoveDown,
          },
        ]
      : []),
    {
      id: 'delete',
      label: 'Delete Deck',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      onClick: () => onDelete(node),
      isDestructive: true,
    },
  ];

  return (
    <div
      className={`
        group flex items-center justify-between gap-3 px-3 py-2.5 rounded-[var(--radius-md)]
        transition-colors duration-150 border border-transparent
        hover:bg-[var(--bg-surface-elevated)] hover:border-[var(--border-subtle)]
      `}
      style={{ paddingLeft: `${12 + indentPadding}px` }}
    >
      {/* Left side: Expand button, Icon, Name, and Info */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggleExpand(node.id)}
            aria-label={isExpanded ? 'Collapse subdecks' : 'Expand subdecks'}
            className="w-5 h-5 -ml-1 flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
        ) : (
          <div className="w-5 h-5 -ml-1 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-tertiary)]/30" />
          </div>
        )}

        <div className="w-6 h-6 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] flex items-center justify-center shrink-0 border border-[var(--border-subtle)]">
          <Layers className="w-3.5 h-3.5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
              {node.name}
            </span>
            {hasChildren && (
              <span className="text-[10px] font-medium text-[var(--text-tertiary)] px-1.5 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-subtle)] shrink-0">
                {node.children.length} subdeck{node.children.length > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {node.description && (
            <p className="text-xs text-[var(--text-tertiary)] truncate mt-0.5">
              {node.description}
            </p>
          )}
        </div>
      </div>

      {/* Right side: Card Stats & Actions */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Statistics Pill Badges */}
        <div className="flex items-center gap-1.5 text-xs">
          {/* New Cards Badge */}
          {total.newCount > 0 ? (
            <Badge
              variant="accent"
              title={
                hasSubdeckCounts
                  ? `Direct: ${direct.newCount} new · Total incl. subdecks: ${total.newCount} new`
                  : `${direct.newCount} new cards`
              }
            >
              {hasSubdeckCounts ? `${direct.newCount} (${total.newCount}) new` : `${total.newCount} new`}
            </Badge>
          ) : (
            <span className="hidden sm:inline text-[11px] text-[var(--text-tertiary)] px-1.5">
              0 new
            </span>
          )}

          {/* Due Cards Badge */}
          {total.dueCount > 0 ? (
            <Badge
              variant="neutral"
              className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
              title={
                hasSubdeckCounts
                  ? `Direct: ${direct.dueCount} due · Total incl. subdecks: ${total.dueCount} due`
                  : `${direct.dueCount} cards due`
              }
            >
              {hasSubdeckCounts ? `${direct.dueCount} (${total.dueCount}) due` : `${total.dueCount} due`}
            </Badge>
          ) : (
            <span className="hidden sm:inline text-[11px] text-[var(--text-tertiary)] px-1.5">
              0 due
            </span>
          )}

          {/* Total Cards Count */}
          <span
            className="text-[11px] text-[var(--text-secondary)] font-mono ml-1 hidden md:inline"
            title={
              hasSubdeckCounts
                ? `Direct: ${direct.total} · Total incl. subdecks: ${total.total}`
                : `${total.total} total cards`
            }
          >
            {hasSubdeckCounts ? `${direct.total} (${total.total}) cards` : `${total.total} cards`}
          </span>
        </div>

        {/* Study Quick Action */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onStudy(node.id)}
          className="hidden sm:inline-flex"
          disabled={total.total === 0}
        >
          Study
        </Button>

        {/* Overflow Context Menu */}
        <Dropdown
          align="right"
          trigger={
            <div className="w-8 h-8 rounded-[var(--radius-md)] flex items-center justify-center text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors">
              <MoreVertical className="w-4 h-4" />
            </div>
          }
          items={dropdownItems}
        />
      </div>
    </div>
  );
};
