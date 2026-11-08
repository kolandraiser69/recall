import React, { useState } from 'react';
import type { NoteWithCards } from '../../../../services/cardService';
import { cardService } from '../../../../services/cardService';
import type { Deck } from '../../../../core/models/deck';
import { CardState } from '../../../../core/models/card';
import { TemplateRenderer } from '../../../../core/templates/templateRenderer';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import { Select } from '../../../components/Select';
import { ShadowCardContainer } from '../../../components/ShadowCardContainer';
import { useToast } from '../../../components/Toast';
import {
  Flag,
  PauseCircle,
  PlayCircle,
  Trash2,
  Edit2,
  Clock,
  Sparkles,
  Layers,
} from 'lucide-react';

export interface CollectionCardDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  item: NoteWithCards | null;
  allDecks: Deck[];
  onEditNote: () => void;
  onRefresh?: () => void;
}

export const CollectionCardDrawer: React.FC<CollectionCardDrawerProps> = ({
  isOpen,
  onClose,
  item,
  allDecks,
  onEditNote,
  onRefresh,
}) => {
  const { success, error: toastError } = useToast();
  const [selectedCardIdx, setSelectedCardIdx] = useState(0);

  if (!item) return null;

  const { note, cards, noteType } = item;
  const currentCard = cards[selectedCardIdx < cards.length ? selectedCardIdx : 0];

  const handleToggleSuspend = async (cardId: string, currentStatus: boolean) => {
    try {
      await cardService.setCardSuspended(cardId, !currentStatus);
      success(`Card ${!currentStatus ? 'suspended' : 'unsuspended'}.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to update card status.');
    }
  };

  const handleToggleFlag = async (cardId: string, currentStatus: boolean) => {
    try {
      await cardService.setCardFlagged(cardId, !currentStatus);
      success(`Card flag ${!currentStatus ? 'set' : 'cleared'}.`);
      if (onRefresh) onRefresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to update flag.');
    }
  };

  const handleMoveCard = async (cardId: string, targetDeckId: string) => {
    try {
      await cardService.moveCard(cardId, targetDeckId);
      success('Card moved to new deck.');
      if (onRefresh) onRefresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to move card.');
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    if (!window.confirm('Are you sure you want to delete this individual card?')) return;
    try {
      await cardService.deleteCard(cardId);
      success('Card soft-deleted.');
      if (onRefresh) onRefresh();
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Failed to delete card.');
    }
  };

  // Render question & answer for current card
  let renderedContent = { questionHtml: '', answerHtml: '' };
  if (currentCard) {
    const template = noteType.templates[currentCard.templateIndex] || noteType.templates[0];
    if (template) {
      const clozeIdx = noteType.isCloze ? currentCard.templateIndex + 1 : 1;
      renderedContent = TemplateRenderer.render(template, note.fieldValues, { clozeIndex: clozeIdx });
    }
  }

  const deckOptions = allDecks.map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Note Details &amp; Cards</span>
          <Badge variant="neutral">{noteType.name}</Badge>
        </div>
      }
      description={`ID: ${note.id} · Updated: ${formatDate(note.updatedAt)}`}
      maxWidth="xl"
    >
      <div className="space-y-5">
        {/* Note Tags & Primary Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)]">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-[var(--text-tertiary)] font-medium mr-1">Tags:</span>
            {note.tags.length > 0 ? (
              note.tags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] font-mono text-[11px]"
                >
                  #{t}
                </span>
              ))
            ) : (
              <span className="text-[var(--text-tertiary)] italic">No tags</span>
            )}
          </div>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              onClose();
              onEditNote();
            }}
            leftIcon={<Edit2 className="w-3.5 h-3.5" />}
          >
            Edit Note
          </Button>
        </div>

        {/* Card Tabs if Note has multiple cards */}
        {cards.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[var(--divider)]">
            <span className="text-xs text-[var(--text-tertiary)] flex items-center gap-1 shrink-0">
              <Layers className="w-3.5 h-3.5" />
              <span>Cards ({cards.length}):</span>
            </span>
            {cards.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCardIdx(i)}
                className={`
                  px-3 py-1.5 text-xs font-medium rounded-[var(--radius-sm)] transition-colors cursor-pointer shrink-0 flex items-center gap-1.5
                  ${
                    selectedCardIdx === i
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-xs font-semibold'
                      : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)]'
                  }
                `}
              >
                <span>Card {i + 1}</span>
                {c.isSuspended && <PauseCircle className="w-3 h-3 text-[var(--warning)]" />}
                {c.isFlagged && <Flag className="w-3 h-3 text-amber-400 fill-amber-400" />}
              </button>
            ))}
          </div>
        )}

        {/* Selected Card Details */}
        {currentCard ? (
          <div className="space-y-4">
            {/* Card Status & Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    currentCard.state === CardState.New
                      ? 'accent'
                      : currentCard.state === CardState.Review
                      ? 'success'
                      : 'warning'
                  }
                >
                  {currentCard.state === CardState.New
                    ? 'New Card'
                    : currentCard.state === CardState.Review
                    ? 'Review State'
                    : 'Learning State'}
                </Badge>

                {currentCard.isSuspended && (
                  <Badge variant="warning" icon={<PauseCircle className="w-3 h-3" />}>
                    Suspended
                  </Badge>
                )}

                {currentCard.isFlagged && (
                  <Badge variant="neutral" icon={<Flag className="w-3 h-3 text-amber-500 fill-amber-500" />}>
                    Flagged
                  </Badge>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleToggleFlag(currentCard.id, Boolean(currentCard.isFlagged))}
                  leftIcon={
                    <Flag
                      className={`w-3.5 h-3.5 ${
                        currentCard.isFlagged ? 'text-amber-500 fill-amber-500' : ''
                      }`}
                    />
                  }
                >
                  {currentCard.isFlagged ? 'Unflag' : 'Flag'}
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => handleToggleSuspend(currentCard.id, Boolean(currentCard.isSuspended))}
                  leftIcon={
                    currentCard.isSuspended ? (
                      <PlayCircle className="w-3.5 h-3.5 text-[var(--success)]" />
                    ) : (
                      <PauseCircle className="w-3.5 h-3.5 text-[var(--warning)]" />
                    )
                  }
                >
                  {currentCard.isSuspended ? 'Unsuspend' : 'Suspend'}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteCard(currentCard.id)}
                  className="text-[var(--danger)] hover:bg-[var(--danger-subtle)]"
                  title="Soft-delete this card"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Deck Assignment for this specific card */}
            <div className="max-w-xs">
              <Select
                label="Card Deck Assignment"
                value={currentCard.deckId}
                onChange={(e) => handleMoveCard(currentCard.id, e.target.value)}
                options={deckOptions}
              />
            </div>

            {/* FSRS Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs">
              <div className="space-y-0.5">
                <span className="text-[var(--text-tertiary)] flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>Due Date</span>
                </span>
                <span className="font-medium text-[var(--text-primary)] block">
                  {formatDate(currentCard.due)}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[var(--text-tertiary)] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-[var(--accent)]" />
                  <span>Stability</span>
                </span>
                <span className="font-mono font-medium text-[var(--text-primary)] block">
                  {currentCard.fsrs.stability > 0 ? `${currentCard.fsrs.stability.toFixed(1)} days` : '0 days'}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[var(--text-tertiary)]">Difficulty</span>
                <span className="font-mono font-medium text-[var(--text-primary)] block">
                  {currentCard.fsrs.difficulty > 0 ? `${currentCard.fsrs.difficulty.toFixed(1)} / 10` : '—'}
                </span>
              </div>

              <div className="space-y-0.5">
                <span className="text-[var(--text-tertiary)]">Reps / Lapses</span>
                <span className="font-mono font-medium text-[var(--text-primary)] block">
                  {currentCard.fsrs.reps} / {currentCard.fsrs.lapses}
                </span>
              </div>
            </div>

            {/* Rendered Card Preview */}
            <div className="space-y-3 pt-2">
              <div>
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">
                  Front (Question)
                </span>
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <ShadowCardContainer html={renderedContent.questionHtml} css={noteType.css} />
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-1">
                  Back (Answer)
                </span>
                <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <ShadowCardContainer html={renderedContent.answerHtml} css={noteType.css} />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-[var(--text-tertiary)] italic">
            No active cards associated with this note.
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-[var(--divider)]">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
