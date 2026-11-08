import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecallDatabase } from '../../src/db/database';
import { DeckService } from '../../src/services/deckService';
import { CardState, Rating } from '../../src/core/models/card';
import { generateId } from '../../src/utils/id';

describe('DeckService Unit Tests', () => {
  let testDb: RecallDatabase;
  let service: DeckService;

  beforeEach(async () => {
    testDb = new RecallDatabase(`TestDeckServiceDB_${Date.now()}_${Math.random()}`);
    await testDb.initialize();
    service = new DeckService(testDb);
  });

  afterEach(async () => {
    await testDb.delete();
  });

  describe('Deck Creation', () => {
    it('creates a root deck with default settings and order', async () => {
      const deck = await service.createDeck({
        name: 'Languages',
        description: 'All language learning decks',
      });

      expect(deck.id).toBeDefined();
      expect(deck.name).toBe('Languages');
      expect(deck.parentId).toBeNull();
      expect(deck.order).toBe(0);
      expect(deck.settings.desiredRetention).toBe(0.9);
      expect(deck.deletedAt).toBeNull();

      const fetched = await testDb.decks.get(deck.id);
      expect(fetched?.name).toBe('Languages');
    });

    it('creates a child deck with valid parentId and auto-incremented order', async () => {
      const parent = await service.createDeck({ name: 'Languages' });
      const child1 = await service.createDeck({ name: 'Spanish', parentId: parent.id });
      const child2 = await service.createDeck({ name: 'Japanese', parentId: parent.id });

      expect(child1.parentId).toBe(parent.id);
      expect(child1.order).toBe(0);
      expect(child2.parentId).toBe(parent.id);
      expect(child2.order).toBe(1);
    });

    it('rejects empty or whitespace-only deck names', async () => {
      await expect(service.createDeck({ name: '' })).rejects.toThrow('Deck name cannot be empty');
      await expect(service.createDeck({ name: '   ' })).rejects.toThrow('Deck name cannot be empty');
    });

    it('rejects non-existent or deleted parent decks', async () => {
      await expect(
        service.createDeck({ name: 'Subdeck', parentId: 'non-existent-id' })
      ).rejects.toThrow('Parent deck not found or deleted');

      const parent = await service.createDeck({ name: 'Parent' });
      await testDb.decks.update(parent.id, { deletedAt: Date.now() });

      await expect(
        service.createDeck({ name: 'Subdeck', parentId: parent.id })
      ).rejects.toThrow('Parent deck not found or deleted');
    });

    it('rejects duplicate deck names under the same parent (case-insensitive)', async () => {
      const parent = await service.createDeck({ name: 'Languages' });
      await service.createDeck({ name: 'German', parentId: parent.id });

      await expect(
        service.createDeck({ name: 'german', parentId: parent.id })
      ).rejects.toThrow('already exists in this folder');
    });

    it('allows duplicate deck names under different parents', async () => {
      const parentA = await service.createDeck({ name: 'School' });
      const parentB = await service.createDeck({ name: 'Work' });

      const childA = await service.createDeck({ name: 'Vocabulary', parentId: parentA.id });
      const childB = await service.createDeck({ name: 'Vocabulary', parentId: parentB.id });

      expect(childA.name).toBe('Vocabulary');
      expect(childB.name).toBe('Vocabulary');
    });
  });

  describe('Deck Updates & Renaming', () => {
    it('updates deck name, description, and settings', async () => {
      const deck = await service.createDeck({ name: 'Old Name' });
      const updated = await service.updateDeck(deck.id, {
        name: 'New Name',
        description: 'Updated notes',
        settings: { desiredRetention: 0.95 },
      });

      expect(updated.name).toBe('New Name');
      expect(updated.description).toBe('Updated notes');
      expect(updated.settings.desiredRetention).toBe(0.95);
    });

    it('rejects renaming to empty name or duplicate sibling name', async () => {
      const parent = await service.createDeck({ name: 'Sciences' });
      const deck1 = await service.createDeck({ name: 'Biology', parentId: parent.id });
      const deck2 = await service.createDeck({ name: 'Chemistry', parentId: parent.id });

      await expect(service.updateDeck(deck1.id, { name: '' })).rejects.toThrow('Deck name cannot be empty');
      await expect(service.updateDeck(deck1.id, { name: '  chemistry ' })).rejects.toThrow('already exists in this folder');

      // Renaming to its own existing name must succeed
      const same = await service.updateDeck(deck2.id, { name: 'Chemistry' });
      expect(same.name).toBe('Chemistry');
    });
  });

  describe('Moving Decks & Cycle Prevention', () => {
    it('moves a deck between parents and to root level', async () => {
      const parentA = await service.createDeck({ name: 'Folder A' });
      const parentB = await service.createDeck({ name: 'Folder B' });
      const child = await service.createDeck({ name: 'Item', parentId: parentA.id });

      // Move to parentB
      const moved1 = await service.moveDeck(child.id, parentB.id);
      expect(moved1.parentId).toBe(parentB.id);

      // Move to Root
      const moved2 = await service.moveDeck(child.id, null);
      expect(moved2.parentId).toBeNull();
    });

    it('prevents self-reference when moving', async () => {
      const deck = await service.createDeck({ name: 'Self Move' });
      await expect(service.moveDeck(deck.id, deck.id)).rejects.toThrow('cannot be moved into itself');
    });

    it('prevents moving a parent into its own direct or indirect subdeck (cycles)', async () => {
      const grandParent = await service.createDeck({ name: 'Level 0' });
      const parent = await service.createDeck({ name: 'Level 1', parentId: grandParent.id });
      const child = await service.createDeck({ name: 'Level 2', parentId: parent.id });

      // Cannot move grandParent into child
      await expect(service.moveDeck(grandParent.id, child.id)).rejects.toThrow('circular hierarchy');

      // Cannot move grandParent into parent
      await expect(service.moveDeck(grandParent.id, parent.id)).rejects.toThrow('circular hierarchy');

      // Cannot move parent into child
      await expect(service.moveDeck(parent.id, child.id)).rejects.toThrow('circular hierarchy');
    });

    it('prevents moving if destination parent already contains a deck with identical name', async () => {
      const targetParent = await service.createDeck({ name: 'Target' });
      await service.createDeck({ name: 'Grammar', parentId: targetParent.id });

      const otherDeck = await service.createDeck({ name: 'Grammar' }); // at root
      await expect(service.moveDeck(otherDeck.id, targetParent.id)).rejects.toThrow('already exists in the destination');
    });
  });

  describe('Path & Subdeck Traversal', () => {
    it('computes subdeck IDs correctly', async () => {
      const root = await service.createDeck({ name: 'Root' });
      const sub1 = await service.createDeck({ name: 'Sub1', parentId: root.id });
      const sub2 = await service.createDeck({ name: 'Sub2', parentId: root.id });
      const deep = await service.createDeck({ name: 'Deep', parentId: sub1.id });

      const descendants = await service.getSubdeckIds(root.id, false);
      expect(descendants).toEqual(expect.arrayContaining([sub1.id, sub2.id, deep.id]));
      expect(descendants.length).toBe(3);

      const withSelf = await service.getSubdeckIds(root.id, true);
      expect(withSelf).toContain(root.id);
      expect(withSelf.length).toBe(4);
    });

    it('computes deck path from root down to deck', async () => {
      const root = await service.createDeck({ name: 'Languages' });
      const german = await service.createDeck({ name: 'German', parentId: root.id });
      const a1 = await service.createDeck({ name: 'A1', parentId: german.id });

      const path = await service.getDeckPath(a1.id);
      expect(path.map((d) => d.name)).toEqual(['Languages', 'German', 'A1']);
    });
  });

  describe('Deck Deletion & Data Integrity', () => {
    it('deletes an empty deck', async () => {
      const deck = await service.createDeck({ name: 'Empty Deck' });
      await service.deleteDeck(deck.id, {
        cardAction: 'delete',
        subdeckAction: 'reparent',
      });

      const fetched = await testDb.decks.get(deck.id);
      expect(fetched?.deletedAt).not.toBeNull();
    });

    it('Option A: moves active cards to another deck upon deletion while preserving FSRS and review history', async () => {
      const deckA = await service.createDeck({ name: 'Deck A' });
      const deckB = await service.createDeck({ name: 'Deck B' });

      const now = Date.now();
      const cardId = generateId();

      await testDb.cards.add({
        id: cardId,
        noteId: 'note-1',
        deckId: deckA.id,
        templateIndex: 0,
        state: CardState.Review,
        due: now + 50000,
        fsrs: {
          stability: 4.5,
          difficulty: 5.0,
          elapsed_days: 3,
          scheduled_days: 5,
          reps: 2,
          lapses: 0,
          state: CardState.Review,
        },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      // Record a review log
      await testDb.reviews.add({
        id: generateId(),
        cardId,
        rating: Rating.Good,
        state: CardState.Review,
        due: now + 50000,
        stability: 4.5,
        difficulty: 5.0,
        elapsedDays: 3,
        lastElapsedDays: 0,
        scheduledDays: 5,
        reviewTime: now,
        durationMs: 1500,
        deletedAt: null,
      });

      // Delete deckA and move cards to deckB
      await service.deleteDeck(deckA.id, {
        cardAction: 'move',
        targetDeckId: deckB.id,
        subdeckAction: 'reparent',
      });

      // Verify card was moved, not deleted
      const card = await testDb.cards.get(cardId);
      expect(card).toBeDefined();
      expect(card?.deckId).toBe(deckB.id);
      expect(card?.deletedAt).toBeNull();
      expect(card?.fsrs.stability).toBe(4.5);

      // Verify ReviewLog is still present and intact
      const reviews = await testDb.reviews.where('cardId').equals(cardId).toArray();
      expect(reviews.length).toBe(1);
      expect(reviews[0]?.rating).toBe(Rating.Good);

      // Verify deckA is soft-deleted
      const deletedDeck = await testDb.decks.get(deckA.id);
      expect(deletedDeck?.deletedAt).not.toBeNull();
    });

    it('Option B: soft-deletes cards upon deck deletion without touching ReviewLogs or Notes', async () => {
      const deck = await service.createDeck({ name: 'To Soft Delete' });
      const cardId = generateId();
      const noteId = generateId();
      const now = Date.now();

      await testDb.notes.add({
        id: noteId,
        noteTypeId: 'default-basic',
        fieldValues: { Front: 'Q', Back: 'A' },
        tags: [],
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      await testDb.cards.add({
        id: cardId,
        noteId,
        deckId: deck.id,
        templateIndex: 0,
        state: CardState.New,
        due: now,
        fsrs: {
          stability: 0,
          difficulty: 0,
          elapsed_days: 0,
          scheduled_days: 0,
          reps: 0,
          lapses: 0,
          state: CardState.New,
        },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      await service.deleteDeck(deck.id, {
        cardAction: 'delete',
        subdeckAction: 'reparent',
      });

      // Card is soft-deleted
      const card = await testDb.cards.get(cardId);
      expect(card?.deletedAt).not.toBeNull();

      // Note remains active
      const note = await testDb.notes.get(noteId);
      expect(note?.deletedAt).toBeNull();
    });

    it('subdeckAction "reparent" promotes children to parent level', async () => {
      const grandparent = await service.createDeck({ name: 'Grandparent' });
      const parent = await service.createDeck({ name: 'Parent', parentId: grandparent.id });
      const child = await service.createDeck({ name: 'Child', parentId: parent.id });

      await service.deleteDeck(parent.id, {
        cardAction: 'delete',
        subdeckAction: 'reparent',
      });

      const updatedChild = await testDb.decks.get(child.id);
      expect(updatedChild?.deletedAt).toBeNull();
      expect(updatedChild?.parentId).toBe(grandparent.id);
    });

    it('subdeckAction "delete" cascades soft-deletion down to all subdecks', async () => {
      const parent = await service.createDeck({ name: 'Parent' });
      const child1 = await service.createDeck({ name: 'Child 1', parentId: parent.id });
      const grandchild = await service.createDeck({ name: 'Grandchild', parentId: child1.id });

      await service.deleteDeck(parent.id, {
        cardAction: 'delete',
        subdeckAction: 'delete',
      });

      expect((await testDb.decks.get(parent.id))?.deletedAt).not.toBeNull();
      expect((await testDb.decks.get(child1.id))?.deletedAt).not.toBeNull();
      expect((await testDb.decks.get(grandchild.id))?.deletedAt).not.toBeNull();
    });
  });

  describe('Statistics & Card Aggregation', () => {
    it('aggregates direct and recursive total card counts correctly', async () => {
      const parent = await service.createDeck({ name: 'Languages' });
      const child = await service.createDeck({ name: 'German', parentId: parent.id });
      const now = Date.now();

      // Add 1 New card to Parent
      await testDb.cards.add({
        id: generateId(),
        noteId: 'n1',
        deckId: parent.id,
        templateIndex: 0,
        state: CardState.New,
        due: now,
        fsrs: { stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, state: CardState.New },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      // Add 1 Due card to Child (due in the past)
      await testDb.cards.add({
        id: generateId(),
        noteId: 'n2',
        deckId: child.id,
        templateIndex: 0,
        state: CardState.Review,
        due: now - 3600000,
        fsrs: { stability: 2, difficulty: 5, elapsed_days: 1, scheduled_days: 1, reps: 1, lapses: 0, state: CardState.Review },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      // Add 1 Future (not due) card to Child
      await testDb.cards.add({
        id: generateId(),
        noteId: 'n3',
        deckId: child.id,
        templateIndex: 0,
        state: CardState.Review,
        due: now + 86400000,
        fsrs: { stability: 5, difficulty: 5, elapsed_days: 2, scheduled_days: 4, reps: 2, lapses: 0, state: CardState.Review },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      // Add 1 Suspended card (should not count as new or due)
      await testDb.cards.add({
        id: generateId(),
        noteId: 'n4',
        deckId: child.id,
        templateIndex: 0,
        state: CardState.New,
        due: now,
        isSuspended: true,
        fsrs: { stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, state: CardState.New },
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });

      // Add 1 Soft-deleted card (should not be counted at all)
      await testDb.cards.add({
        id: generateId(),
        noteId: 'n5',
        deckId: child.id,
        templateIndex: 0,
        state: CardState.New,
        due: now,
        deletedAt: now,
        fsrs: { stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, reps: 0, lapses: 0, state: CardState.New },
        createdAt: now,
        updatedAt: now,
      });

      const hierarchy = await service.getDeckHierarchy(now);
      expect(hierarchy.length).toBe(1); // 1 root

      const parentNode = hierarchy[0]!;
      expect(parentNode.name).toBe('Languages');
      expect(parentNode.directCounts).toEqual({
        total: 1,
        newCount: 1,
        dueCount: 0,
      });

      // Child node
      expect(parentNode.children.length).toBe(1);
      const childNode = parentNode.children[0]!;
      expect(childNode.name).toBe('German');
      expect(childNode.directCounts).toEqual({
        total: 3, // 1 due + 1 future + 1 suspended (deleted excluded)
        newCount: 0, // suspended new card excluded
        dueCount: 1,
      });

      // Parent node totalCounts (aggregated over self + child)
      expect(parentNode.totalCounts).toEqual({
        total: 4, // 1 + 3
        newCount: 1, // 1 + 0
        dueCount: 1, // 0 + 1
      });
    });
  });
});
