import React, { useState, useEffect } from 'react';
import type { Deck, DeckWithStats, DeckDeleteOptions } from '../../../../core/models/deck';
import { Modal } from '../../../components/Modal';
import { Select } from '../../../components/Select';
import { Button } from '../../../components/Button';
import { AlertTriangle } from 'lucide-react';

export interface DeleteDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: DeckWithStats | null;
  allDecks: Deck[];
  descendantIds: string[];
  onDelete: (deckId: string, options: DeckDeleteOptions) => Promise<void>;
}

export const DeleteDeckModal: React.FC<DeleteDeckModalProps> = ({
  isOpen,
  onClose,
  deck,
  allDecks,
  descendantIds,
  onDelete,
}) => {
  const [cardAction, setCardAction] = useState<'delete' | 'move'>('delete');
  const [targetDeckId, setTargetDeckId] = useState<string>('');
  const [subdeckAction, setSubdeckAction] = useState<'reparent' | 'delete'>('reparent');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setCardAction('delete');
      setSubdeckAction('reparent');
      setError(null);
      setIsSubmitting(false);

      // Default target deck to first eligible deck if available
      const eligible = allDecks.filter(
        (d) => d.id !== deck?.id && !descendantIds.includes(d.id)
      );
      setTargetDeckId(eligible[0]?.id || '');
    }
  }, [isOpen, deck, allDecks, descendantIds]);

  if (!deck) return null;

  const directCards = deck.directCounts.total;
  const subdeckCount = descendantIds.length;
  const subdeckCards = deck.totalCounts.total - directCards;

  // Destination options for moving cards
  const eligibleMoveTargets = allDecks.filter(
    (d) => d.id !== deck.id && (subdeckAction === 'reparent' || !descendantIds.includes(d.id))
  );

  const targetOptions = eligibleMoveTargets.map((d) => ({
    value: d.id,
    label: d.name,
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cardAction === 'move' && (!targetDeckId || eligibleMoveTargets.length === 0)) {
      setError('Please select a valid destination deck to move cards to.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onDelete(deck.id, {
        cardAction,
        targetDeckId: cardAction === 'move' ? targetDeckId : undefined,
        subdeckAction,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete deck.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-[var(--danger)]">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Delete Deck</span>
        </div>
      }
      description={`Are you sure you want to delete "${deck.name}"?`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs rounded-[var(--radius-md)] bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/20 animate-in fade-in">
            {error}
          </div>
        )}

        {/* Informational notice */}
        <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-xs space-y-1.5 text-[var(--text-secondary)]">
          <p>
            <strong className="text-[var(--text-primary)] font-semibold">{deck.name}</strong> contains{' '}
            <span className="font-mono font-medium text-[var(--text-primary)]">{directCards}</span> direct flashcards.
          </p>
          {subdeckCount > 0 && (
            <p>
              It also has <span className="font-mono font-medium text-[var(--text-primary)]">{subdeckCount}</span> subdeck
              {subdeckCount > 1 ? 's' : ''} containing{' '}
              <span className="font-mono font-medium text-[var(--text-primary)]">{subdeckCards}</span> cards.
            </p>
          )}
          <p className="text-[11px] text-[var(--text-tertiary)] pt-1">
            Note: All past learning logs and review history are permanently preserved.
          </p>
        </div>

        {/* Card Handling Options (if deck or subdecks contain cards) */}
        {directCards > 0 && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[var(--text-primary)]">
              Card Handling
            </label>
            <div className="space-y-2 text-xs">
              <label className="flex items-start gap-2.5 p-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="cardAction"
                  value="delete"
                  checked={cardAction === 'delete'}
                  onChange={() => setCardAction('delete')}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-medium text-[var(--text-primary)]">Soft-delete cards</span>
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    Cards are archived. Associated notes remain intact and ReviewLogs are saved.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="cardAction"
                  value="move"
                  checked={cardAction === 'move'}
                  onChange={() => setCardAction('move')}
                  className="mt-0.5"
                  disabled={eligibleMoveTargets.length === 0}
                />
                <div className="flex-1">
                  <span className="font-medium text-[var(--text-primary)]">Move cards to another deck</span>
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    Keep all cards, FSRS stability, and review intervals by transferring them to another deck.
                  </p>
                  {cardAction === 'move' && (
                    <div className="mt-2.5">
                      <Select
                        label="Destination Deck"
                        value={targetDeckId}
                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTargetDeckId(e.target.value)}
                        options={targetOptions}
                        disabled={eligibleMoveTargets.length === 0}
                      />
                      {eligibleMoveTargets.length === 0 && (
                        <p className="text-[11px] text-[var(--danger)] mt-1">
                          No other deck exists to move cards into.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </label>
            </div>
          </div>
        )}

        {/* Subdeck Handling Options (if subdecks exist) */}
        {subdeckCount > 0 && (
          <div className="space-y-2 pt-2 border-t border-[var(--divider)]">
            <label className="block text-xs font-semibold text-[var(--text-primary)]">
              Subdeck Handling ({subdeckCount} subdecks)
            </label>
            <div className="space-y-2 text-xs">
              <label className="flex items-start gap-2.5 p-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="subdeckAction"
                  value="reparent"
                  checked={subdeckAction === 'reparent'}
                  onChange={() => setSubdeckAction('reparent')}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-medium text-[var(--text-primary)]">
                    Promote subdecks up (Reparent)
                  </span>
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    Keep the subdecks and move them up to this deck's parent level.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-2.5 p-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="subdeckAction"
                  value="delete"
                  checked={subdeckAction === 'delete'}
                  onChange={() => setSubdeckAction('delete')}
                  className="mt-0.5"
                />
                <div>
                  <span className="font-medium text-[var(--danger)]">
                    Delete subdecks recursively
                  </span>
                  <p className="text-[11px] text-[var(--text-tertiary)]">
                    All descendant subdecks will also be deleted.
                  </p>
                </div>
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="destructive"
            disabled={isSubmitting || (cardAction === 'move' && !targetDeckId)}
          >
            {isSubmitting ? 'Deleting...' : 'Delete Deck'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
