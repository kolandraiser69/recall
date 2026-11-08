import React, { useState, useEffect } from 'react';
import type { Deck } from '../../../../core/models/deck';
import { Modal } from '../../../components/Modal';
import { Select } from '../../../components/Select';
import { Button } from '../../../components/Button';

export interface MoveDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  deck: Deck | null;
  allDecks: Deck[];
  descendantIds: string[];
  onMove: (deckId: string, newParentId: string | null) => Promise<void>;
}

export const MoveDeckModal: React.FC<MoveDeckModalProps> = ({
  isOpen,
  onClose,
  deck,
  allDecks,
  descendantIds,
  onMove,
}) => {
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && deck) {
      setSelectedParentId(deck.parentId || '');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, deck]);

  if (!deck) return null;

  // Filter out self and any descendants
  const validParents = allDecks.filter(
    (d) => d.id !== deck.id && !descendantIds.includes(d.id)
  );

  const parentOptions = [
    { value: '', label: '(None) Top-level root' },
    ...validParents.map((d) => ({
      value: d.id,
      label: d.name,
    })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const targetParent = selectedParentId ? selectedParentId : null;
    if (targetParent === deck.parentId) {
      onClose();
      return;
    }

    try {
      await onMove(deck.id, targetParent);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to move deck.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Move Deck"
      description={`Select a new location for "${deck.name}".`}
      maxWidth="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs rounded-[var(--radius-md)] bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/20 animate-in fade-in">
            {error}
          </div>
        )}

        <Select
          label="New Destination Parent"
          value={selectedParentId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedParentId(e.target.value)}
          options={parentOptions}
        />

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Moving...' : 'Move Deck'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
