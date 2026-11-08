import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/database';
import { cardService } from '../../../services/cardService';
import type { Note } from '../../../core/models/note';
import type { Card } from '../../../core/models/card';
import type { NoteType } from '../../../core/models/noteType';
import { ClozeEngine } from '../../../core/templates/clozeEngine';
import { Modal } from '../../components/Modal';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { RichTextToolbar } from './components/RichTextToolbar';
import { TagInput } from './components/TagInput';
import { LiveCardPreview } from './components/LiveCardPreview';
import { Layers, Trash2 } from 'lucide-react';

export interface NoteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  noteToEdit?: Note | null;
  defaultDeckId?: string;
  onSuccess?: (note: Note, cards: Card[]) => void;
}

export const NoteEditorModal: React.FC<NoteEditorModalProps> = ({
  isOpen,
  onClose,
  noteToEdit,
  defaultDeckId,
  onSuccess,
}) => {
  const allNoteTypes = useLiveQuery(() => db.noteTypes.filter((nt) => nt.deletedAt === null).toArray(), []) ?? [];
  const allDecks = useLiveQuery(() => db.decks.filter((d) => d.deletedAt === null).toArray(), []) ?? [];
  const allTags = useLiveQuery(() => db.notes.filter((n) => n.deletedAt === null).toArray(), []) ?? [];

  // Extract unique tag list
  const suggestedTags = React.useMemo(() => {
    const set = new Set<string>();
    for (const n of allTags) {
      for (const t of n.tags) {
        if (t.trim()) set.add(t.trim());
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allTags]);

  const [selectedNoteTypeId, setSelectedNoteTypeId] = useState<string>('');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  // Field textarea refs for rich text formatting
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Initialize or reset state when modal opens or noteToEdit changes
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setIsConfirmingDelete(false);
      setIsSubmitting(false);

      if (noteToEdit) {
        setSelectedNoteTypeId(noteToEdit.noteTypeId);
        setFieldValues({ ...noteToEdit.fieldValues });
        setTags([...noteToEdit.tags]);

        // Load deck of existing cards
        db.cards
          .where('noteId')
          .equals(noteToEdit.id)
          .filter((c) => c.deletedAt === null)
          .first()
          .then((firstCard) => {
            if (firstCard) {
              setSelectedDeckId(firstCard.deckId);
            } else if (defaultDeckId) {
              setSelectedDeckId(defaultDeckId);
            }
          });
      } else {
        // Creating new note
        setSelectedNoteTypeId((prev) => prev || (allNoteTypes[0]?.id ?? 'default-basic'));
        setSelectedDeckId((prev) => prev || defaultDeckId || (allDecks[0]?.id ?? ''));
        setFieldValues({});
        setTags([]);
      }
    }
  }, [isOpen, noteToEdit?.id]);

  // Keep noteType and deck selections synchronized when data loads
  useEffect(() => {
    if (!selectedNoteTypeId && allNoteTypes.length > 0) {
      setSelectedNoteTypeId(allNoteTypes[0]!.id);
    }
  }, [allNoteTypes.length, selectedNoteTypeId]);

  useEffect(() => {
    if (!selectedDeckId) {
      if (defaultDeckId) setSelectedDeckId(defaultDeckId);
      else if (allDecks.length > 0) setSelectedDeckId(allDecks[0]!.id);
    }
  }, [allDecks.length, defaultDeckId, selectedDeckId]);

  const currentNoteType: NoteType | undefined =
    (selectedNoteTypeId ? allNoteTypes.find((nt) => nt.id === selectedNoteTypeId) : undefined) ||
    allNoteTypes[0];

  const effectiveDeckId = selectedDeckId || defaultDeckId || allDecks[0]?.id || '';

  // Handle Note Type switch gracefully
  const handleNoteTypeChange = (newTypeId: string) => {
    setSelectedNoteTypeId(newTypeId);
    // Keep existing fieldValues so that common fields (e.g. Front, Back) are preserved!
  };

  const handleFieldChange = (fieldName: string, value: string) => {
    setFieldValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentNoteType) {
      setError('Please select a valid note type.');
      return;
    }

    if (!effectiveDeckId) {
      setError('Please select a target deck.');
      return;
    }

    // Validate fields
    const firstField = currentNoteType.fields[0]?.name;
    const firstVal = firstField ? (fieldValues[firstField] || '').trim() : '';

    if (!firstVal) {
      setError(`Please enter a value for the "${firstField || 'Front'}" field.`);
      return;
    }

    // If Cloze note type, ensure at least one cloze deletion exists
    if (currentNoteType.isCloze) {
      const clozeText = fieldValues['Text'] || Object.values(fieldValues)[0] || '';
      const indices = ClozeEngine.extractClozeIndices(clozeText);
      if (indices.length === 0) {
        setError('Cloze note must contain at least one cloze deletion (e.g. {{c1::word}}). Use the Cloze button to insert one.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (noteToEdit) {
        // Update existing note & sync cards
        const result = await cardService.updateNoteAndSync(noteToEdit.id, {
          fieldValues,
          tags,
          noteTypeId: currentNoteType.id,
          targetDeckId: effectiveDeckId,
        });
        if (onSuccess) onSuccess(result.note, result.cards);
        onClose();
      } else {
        // Create new note with cards
        const result = await cardService.createNoteWithCards({
          noteTypeId: currentNoteType.id,
          deckId: effectiveDeckId,
          fieldValues,
          tags,
        });
        if (onSuccess) onSuccess(result.note, result.cards);
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while saving the note.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async () => {
    if (!noteToEdit) return;
    setIsSubmitting(true);
    try {
      await cardService.deleteNoteAndCards(noteToEdit.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note.');
      setIsSubmitting(false);
    }
  };

  const noteTypeOptions = allNoteTypes.map((nt) => ({
    value: nt.id,
    label: nt.name,
  }));

  const deckOptions = allDecks.map((d) => ({
    value: d.id,
    label: d.name,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={noteToEdit ? 'Edit Note' : 'Add Note'}
      description={
        noteToEdit
          ? 'Modify note contents. Cards and learning intervals are updated atomically.'
          : 'Create a flashcard note with automated card generation.'
      }
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3 text-xs rounded-[var(--radius-md)] bg-[var(--danger-subtle)] text-[var(--danger)] border border-[var(--danger)]/20 animate-in fade-in">
            {error}
          </div>
        )}

        {/* Top Selectors: Note Type & Target Deck */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <Select
            label="Note Type"
            value={selectedNoteTypeId || currentNoteType?.id || ''}
            onChange={(e) => handleNoteTypeChange(e.target.value)}
            options={noteTypeOptions}
          />

          <Select
            label="Target Deck"
            value={selectedDeckId || effectiveDeckId}
            onChange={(e) => setSelectedDeckId(e.target.value)}
            options={deckOptions}
          />
        </div>

        {/* Dynamic Fields for current NoteType */}
        {currentNoteType && (
          <div className="space-y-4">
            {currentNoteType.fields.map((field) => {
              const isClozeField = currentNoteType.isCloze && (field.name === 'Text' || currentNoteType.fields.length === 1);
              const val = fieldValues[field.name] || '';

              return (
                <div key={field.id} className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold text-[var(--text-primary)]">
                    {field.name}
                  </label>

                  <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] focus-within:border-[var(--accent)] focus-within:ring-2 focus-within:ring-[var(--accent-subtle)] overflow-hidden transition-all bg-[var(--bg-surface)]">
                    <RichTextToolbar
                      textareaRef={{ current: textareaRefs.current[field.name] ?? null }}
                      value={val}
                      onChange={(nextVal) => handleFieldChange(field.name, nextVal)}
                      isCloze={isClozeField}
                    />
                    <textarea
                      ref={(el) => {
                        textareaRefs.current[field.name] = el;
                      }}
                      rows={isClozeField ? 4 : 3}
                      value={val}
                      onChange={(e) => handleFieldChange(field.name, e.target.value)}
                      placeholder={`Enter ${field.name}...`}
                      className="w-full p-3 text-sm bg-transparent text-[var(--text-primary)] placeholder-[var(--text-tertiary)] outline-none resize-y min-h-[75px]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tags Input */}
        <TagInput
          tags={tags}
          onChange={setTags}
          availableSuggestions={suggestedTags}
        />

        {/* Live Card Preview */}
        {currentNoteType && (
          <LiveCardPreview
            noteType={currentNoteType}
            fieldValues={fieldValues}
          />
        )}

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[var(--divider)]">
          {noteToEdit ? (
            <div>
              {isConfirmingDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--danger)] font-medium">Delete note and cards?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteNote}
                    disabled={isSubmitting}
                  >
                    Confirm Delete
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsConfirmingDelete(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsConfirmingDelete(true)}
                  className="text-[var(--danger)] hover:bg-[var(--danger-subtle)]"
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Delete Note
                </Button>
              )}
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <Layers className="w-3.5 h-3.5" />
              <span>Cards are generated automatically from note fields.</span>
            </div>
          )}

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : noteToEdit ? 'Save Changes' : 'Create Note'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
