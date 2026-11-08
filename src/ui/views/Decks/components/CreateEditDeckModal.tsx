import React, { useState, useEffect } from 'react';
import type { Deck, DeckSettings } from '../../../../core/models/deck';
import { DEFAULT_DECK_SETTINGS } from '../../../../core/models/deck';
import { Modal } from '../../../components/Modal';
import { Input } from '../../../components/Input';
import { Select } from '../../../components/Select';
import { Button } from '../../../components/Button';
import { ChevronDown, ChevronRight, Sliders } from 'lucide-react';

export interface CreateEditDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  deckToEdit?: Deck | null;
  defaultParentId?: string | null;
  allDecks: Deck[];
  descendantIdsOfEditDeck?: string[];
  onSubmit: (data: {
    name: string;
    description: string;
    parentId: string | null;
    settings: DeckSettings;
  }) => Promise<void>;
}

export const CreateEditDeckModal: React.FC<CreateEditDeckModalProps> = ({
  isOpen,
  onClose,
  deckToEdit,
  defaultParentId = null,
  allDecks,
  descendantIdsOfEditDeck = [],
  onSubmit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [newCardsPerDay, setNewCardsPerDay] = useState(DEFAULT_DECK_SETTINGS.newCardsPerDay);
  const [maxReviewsPerDay, setMaxReviewsPerDay] = useState(DEFAULT_DECK_SETTINGS.maxReviewsPerDay);
  const [desiredRetention, setDesiredRetention] = useState(DEFAULT_DECK_SETTINGS.desiredRetention);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (deckToEdit) {
        setName(deckToEdit.name);
        setDescription(deckToEdit.description || '');
        setParentId(deckToEdit.parentId || '');
        setNewCardsPerDay(deckToEdit.settings.newCardsPerDay);
        setMaxReviewsPerDay(deckToEdit.settings.maxReviewsPerDay);
        setDesiredRetention(deckToEdit.settings.desiredRetention);
      } else {
        setName('');
        setDescription('');
        setParentId(defaultParentId || '');
        setNewCardsPerDay(DEFAULT_DECK_SETTINGS.newCardsPerDay);
        setMaxReviewsPerDay(DEFAULT_DECK_SETTINGS.maxReviewsPerDay);
        setDesiredRetention(DEFAULT_DECK_SETTINGS.desiredRetention);
      }
      setShowAdvanced(false);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, deckToEdit, defaultParentId]);

  // Filter available parent decks to prevent cycles and self-selection
  const availableParentDecks = allDecks.filter((d) => {
    if (!deckToEdit) return true;
    if (d.id === deckToEdit.id) return false;
    if (descendantIdsOfEditDeck.includes(d.id)) return false;
    return true;
  });

  const parentOptions = [
    { value: '', label: '(None) Top-level deck' },
    ...availableParentDecks.map((d) => ({
      value: d.id,
      label: d.name,
    })),
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Please provide a deck name.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit({
        name: trimmedName,
        description: description.trim(),
        parentId: parentId ? parentId : null,
        settings: {
          newCardsPerDay: Number(newCardsPerDay) || DEFAULT_DECK_SETTINGS.newCardsPerDay,
          maxReviewsPerDay: Number(maxReviewsPerDay) || DEFAULT_DECK_SETTINGS.maxReviewsPerDay,
          desiredRetention: Number(desiredRetention) || DEFAULT_DECK_SETTINGS.desiredRetention,
          learningSteps: deckToEdit?.settings.learningSteps || DEFAULT_DECK_SETTINGS.learningSteps,
          relearningSteps: deckToEdit?.settings.relearningSteps || DEFAULT_DECK_SETTINGS.relearningSteps,
        },
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving the deck.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={deckToEdit ? 'Edit Deck' : defaultParentId ? 'Create Subdeck' : 'Create New Deck'}
      description={
        deckToEdit
          ? 'Modify deck properties and FSRS scheduling parameters.'
          : 'Organize cards into a dedicated study collection.'
      }
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-xs rounded-[var(--radius-md)] bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/20 animate-in fade-in">
            {error}
          </div>
        )}

        <Input
          label="Deck Name"
          placeholder="e.g. Spanish Vocabulary, Biology"
          value={name}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
          autoFocus
          required
        />

        <Input
          label="Description (Optional)"
          placeholder="Short note or learning goal"
          value={description}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
        />

        <Select
          label="Parent Deck"
          value={parentId}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParentId(e.target.value)}
          options={parentOptions}
        />

        {/* Collapsible Advanced FSRS Settings */}
        <div className="pt-2 border-t border-[var(--divider)]">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer select-none py-1"
          >
            {showAdvanced ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <Sliders className="w-3.5 h-3.5" />
            <span>FSRS Scheduling Parameters</span>
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3 p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] animate-in fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  label="New Cards / Day"
                  type="number"
                  min="0"
                  max="999"
                  value={newCardsPerDay}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewCardsPerDay(parseInt(e.target.value, 10) || 0)}
                />
                <Input
                  label="Max Reviews / Day"
                  type="number"
                  min="0"
                  max="9999"
                  value={maxReviewsPerDay}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setMaxReviewsPerDay(parseInt(e.target.value, 10) || 0)}
                />
              </div>

              <div className="space-y-1">
                <Input
                  label="Target Retention (FSRS)"
                  type="number"
                  step="0.01"
                  min="0.70"
                  max="0.99"
                  value={desiredRetention}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDesiredRetention(parseFloat(e.target.value) || 0.9)}
                />
                <p className="text-[11px] text-[var(--text-tertiary)]">
                  Standard recommended value is 0.90 (90% recall probability).
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : deckToEdit ? 'Save Changes' : 'Create Deck'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
