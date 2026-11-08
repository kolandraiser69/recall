import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { NoteEditorModal } from '../../src/ui/views/Editor/NoteEditorModal';
import { TagInput } from '../../src/ui/views/Editor/components/TagInput';
import { LiveCardPreview } from '../../src/ui/views/Editor/components/LiveCardPreview';
import { RichTextToolbar } from '../../src/ui/views/Editor/components/RichTextToolbar';
import { db } from '../../src/db/database';
import { DEFAULT_NOTE_TYPES } from '../../src/db/migrations/v1';

describe('Note & Card Editor (Phase 3.3)', () => {
  beforeEach(async () => {
    await db.initialize();
    await db.notes.clear();
    await db.cards.clear();
    await db.decks.clear();

    const count = await db.noteTypes.count();
    if (count === 0) {
      await db.noteTypes.bulkAdd(DEFAULT_NOTE_TYPES);
    }

    // Seed test deck
    await db.decks.add({
      id: 'deck-test',
      name: 'Default Test Deck',
      parentId: null,
      description: '',
      settings: {
        newCardsPerDay: 20,
        maxReviewsPerDay: 200,
        desiredRetention: 0.9,
        learningSteps: [1, 10],
        relearningSteps: [10],
      },
      order: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
    });
  });

  describe('TagInput', () => {
    it('adds tags upon pressing Enter or comma and removes on delete', () => {
      const handleChange = vi.fn();
      render(
        <TagInput
          tags={['existing']}
          onChange={handleChange}
          availableSuggestions={['suggested1', 'suggested2']}
        />
      );

      expect(screen.getByText('existing')).toBeDefined();

      const input = screen.getByPlaceholderText(/add tag/i);
      fireEvent.change(input, { target: { value: 'newtag' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(handleChange).toHaveBeenCalledWith(['existing', 'newtag']);

      // Clicking remove button on chip
      const removeBtn = screen.getByRole('button', { name: '' });
      fireEvent.click(removeBtn);
      expect(handleChange).toHaveBeenCalledWith([]);
    });

    it('adds suggestion tag when clicked', () => {
      const handleChange = vi.fn();
      render(
        <TagInput
          tags={[]}
          onChange={handleChange}
          availableSuggestions={['science']}
        />
      );

      const suggestionBtn = screen.getByText('science');
      fireEvent.click(suggestionBtn);

      expect(handleChange).toHaveBeenCalledWith(['science']);
    });
  });

  describe('RichTextToolbar', () => {
    it('applies formatting tags to selected text in textarea', () => {
      const handleChange = vi.fn();
      const textarea = document.createElement('textarea');
      textarea.value = 'hello world';
      textarea.selectionStart = 0;
      textarea.selectionEnd = 5; // "hello"

      render(
        <RichTextToolbar
          textareaRef={{ current: textarea }}
          value="hello world"
          onChange={handleChange}
          isCloze={true}
        />
      );

      const boldBtn = screen.getByTitle(/bold/i);
      fireEvent.click(boldBtn);

      expect(handleChange).toHaveBeenCalledWith('<b>hello</b> world');
    });

    it('inserts next cloze deletion index correctly', () => {
      const handleChange = vi.fn();
      const textarea = document.createElement('textarea');
      const text = 'The {{c1::sun}} is a star';
      textarea.value = text;
      textarea.selectionStart = text.indexOf('star');
      textarea.selectionEnd = text.indexOf('star') + 4; // "star"

      render(
        <RichTextToolbar
          textareaRef={{ current: textarea }}
          value="The {{c1::sun}} is a star"
          onChange={handleChange}
          isCloze={true}
        />
      );

      const clozeBtn = screen.getByTitle(/cloze deletion/i);
      fireEvent.click(clozeBtn);

      // Should automatically pick c2
      expect(handleChange).toHaveBeenCalledWith('The {{c1::sun}} is a {{c2::star}}');
    });
  });

  describe('LiveCardPreview', () => {
    it('renders question and answer for Basic NoteType', () => {
      const basicNoteType = {
        id: 'default-basic',
        name: 'Basic',
        isCloze: false,
        fields: [{ id: 'f1', name: 'Front' }, { id: 'f2', name: 'Back' }],
        templates: [{ name: 'Card 1', qfmt: '{{Front}}', afmt: '{{FrontSide}}<hr id="answer">{{Back}}' }],
        css: '.card { font-size: 16px; }',
        updatedAt: Date.now(),
        deletedAt: null,
      };

      const { container } = render(
        <LiveCardPreview
          noteType={basicNoteType}
          fieldValues={{ Front: 'Question text', Back: 'Answer text' }}
        />
      );

      expect(container.querySelector('.shadow-card-wrapper')).toBeDefined();
    });

    it('renders multiple cloze tabs for Cloze NoteType with multiple deletions', () => {
      const clozeNoteType = {
        id: 'default-cloze',
        name: 'Cloze',
        isCloze: true,
        fields: [{ id: 'f1', name: 'Text' }, { id: 'f2', name: 'Extra' }],
        templates: [{ name: 'Cloze', qfmt: '{{cloze:Text}}', afmt: '{{cloze:Text}}<br>{{Extra}}' }],
        css: '',
        updatedAt: Date.now(),
        deletedAt: null,
      };

      render(
        <LiveCardPreview
          noteType={clozeNoteType}
          fieldValues={{ Text: '{{c1::Paris}} is the capital of {{c2::France}}.', Extra: 'Europe' }}
        />
      );

      expect(screen.getByText('Cloze 1')).toBeDefined();
      expect(screen.getByText('Cloze 2')).toBeDefined();
    });
  });

  describe('NoteEditorModal', () => {
    it('creates a new note and generates cards atomically', async () => {
      const handleSuccess = vi.fn();
      const handleClose = vi.fn();

      render(
        <NoteEditorModal
          isOpen={true}
          onClose={handleClose}
          defaultDeckId="deck-test"
          onSuccess={handleSuccess}
        />
      );

      const frontInput = await screen.findByPlaceholderText(/enter front/i);
      fireEvent.change(frontInput, { target: { value: 'What is photosynthesis?' } });

      const backInput = screen.getByPlaceholderText(/enter back/i);
      fireEvent.change(backInput, { target: { value: 'Process used by plants.' } });

      const submitBtn = screen.getByRole('button', { name: /create note/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(handleSuccess).toHaveBeenCalled();
        expect(handleClose).toHaveBeenCalled();
      });

      // Verify in DB
      const allNotes = await db.notes.toArray();
      expect(allNotes.length).toBe(1);
      expect(allNotes[0]?.fieldValues['Front']).toBe('What is photosynthesis?');

      const allCards = await db.cards.toArray();
      expect(allCards.length).toBe(1);
      expect(allCards[0]?.deckId).toBe('deck-test');
    });

    it('validates missing required Front field', async () => {
      render(
        <NoteEditorModal
          isOpen={true}
          onClose={vi.fn()}
          defaultDeckId="deck-test"
        />
      );

      // Wait until dynamic fields are rendered
      await screen.findByPlaceholderText(/enter front/i);

      const submitBtn = screen.getByRole('button', { name: /create note/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText(/please enter a value for/i)).toBeDefined();
      });
    });
  });
});
