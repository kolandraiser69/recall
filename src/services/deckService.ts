import { db, type RecallDatabase } from '../db/database';
import type { Deck, DeckSettings, DeckCardCounts, DeckWithStats, DeckDeleteOptions } from '../core/models/deck';
import { DEFAULT_DECK_SETTINGS } from '../core/models/deck';
import { CardState } from '../core/models/card';
import { deckSchema } from '../core/validation/deck.schema';
import { generateId } from '../utils/id';

export class DeckService {
  constructor(private database: RecallDatabase = db) {}

  /**
   * Creates a new deck with validation for empty names, sibling duplicates, and parent existence.
   */
  async createDeck(params: {
    name: string;
    parentId?: string | null;
    description?: string;
    settings?: Partial<DeckSettings>;
    order?: number;
  }): Promise<Deck> {
    const trimmedName = params.name ? params.name.trim() : '';
    if (!trimmedName) {
      throw new Error('Deck name cannot be empty');
    }

    const targetParentId = params.parentId ?? null;

    // Validate parent if provided
    if (targetParentId !== null) {
      const parent = await this.database.decks.get(targetParentId);
      if (!parent || parent.deletedAt !== null) {
        throw new Error('Parent deck not found or deleted');
      }
    }

    // Check for sibling name duplicates under the same parent
    const existingSiblings = await this.database.decks
      .filter((d) => d.deletedAt === null && d.parentId === targetParentId)
      .toArray();

    const isDuplicate = existingSiblings.some(
      (s) => s.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      throw new Error(`A deck with the name "${trimmedName}" already exists in this folder.`);
    }

    // Determine order
    let order = params.order;
    if (order === undefined) {
      order = existingSiblings.length > 0
        ? Math.max(...existingSiblings.map((s) => s.order)) + 1
        : 0;
    }

    const now = Date.now();
    const newDeck: Deck = {
      id: generateId(),
      name: trimmedName,
      parentId: targetParentId,
      description: params.description ? params.description.trim() : '',
      settings: { ...DEFAULT_DECK_SETTINGS, ...params.settings },
      order,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const validated = deckSchema.parse(newDeck);
    await this.database.decks.add(validated);
    return validated;
  }

  /**
   * Updates an existing deck's name, description, settings, or order.
   */
  async updateDeck(
    deckId: string,
    updates: {
      name?: string;
      description?: string;
      settings?: Partial<DeckSettings>;
      order?: number;
    }
  ): Promise<Deck> {
    const existing = await this.database.decks.get(deckId);
    if (!existing || existing.deletedAt !== null) {
      throw new Error(`Deck with id ${deckId} not found or deleted`);
    }

    let updatedName = existing.name;
    if (updates.name !== undefined) {
      const trimmed = updates.name.trim();
      if (!trimmed) {
        throw new Error('Deck name cannot be empty');
      }

      // Check siblings for duplicate if name is changing
      if (trimmed.toLowerCase() !== existing.name.trim().toLowerCase()) {
        const siblings = await this.database.decks
          .filter((d) => d.deletedAt === null && d.parentId === existing.parentId && d.id !== deckId)
          .toArray();

        if (siblings.some((s) => s.name.trim().toLowerCase() === trimmed.toLowerCase())) {
          throw new Error(`A deck with the name "${trimmed}" already exists in this folder.`);
        }
      }
      updatedName = trimmed;
    }

    const updated: Deck = {
      ...existing,
      name: updatedName,
      description: updates.description !== undefined ? updates.description.trim() : existing.description,
      settings: updates.settings ? { ...existing.settings, ...updates.settings } : existing.settings,
      order: updates.order !== undefined ? updates.order : existing.order,
      updatedAt: Date.now(),
    };

    const validated = deckSchema.parse(updated);
    await this.database.decks.put(validated);
    return validated;
  }

  /**
   * Moves a deck to a new parent or to the root level.
   * Prevents self-references, circular references, moving into own subdecks, and name duplicates in destination.
   */
  async moveDeck(deckId: string, newParentId: string | null): Promise<Deck> {
    const deck = await this.database.decks.get(deckId);
    if (!deck || deck.deletedAt !== null) {
      throw new Error(`Deck with id ${deckId} not found or deleted`);
    }

    if (newParentId === deckId) {
      throw new Error('A deck cannot be moved into itself.');
    }

    if (newParentId !== null) {
      const targetParent = await this.database.decks.get(newParentId);
      if (!targetParent || targetParent.deletedAt !== null) {
        throw new Error('Target parent deck not found or deleted');
      }

      // Cycle prevention: newParentId cannot be a descendant of deckId
      const descendantIds = await this.getSubdeckIds(deckId);
      if (descendantIds.includes(newParentId)) {
        throw new Error('Cannot move a deck into one of its own subdecks (circular hierarchy).');
      }
    }

    // Check duplicate name in target parent
    const targetSiblings = await this.database.decks
      .filter((d) => d.deletedAt === null && d.parentId === newParentId && d.id !== deckId)
      .toArray();

    if (targetSiblings.some((s) => s.name.trim().toLowerCase() === deck.name.trim().toLowerCase())) {
      throw new Error(`A deck with the name "${deck.name}" already exists in the destination.`);
    }

    // Calculate order in new parent
    const order = targetSiblings.length > 0
      ? Math.max(...targetSiblings.map((s) => s.order)) + 1
      : 0;

    const updated: Deck = {
      ...deck,
      parentId: newParentId,
      order,
      updatedAt: Date.now(),
    };

    const validated = deckSchema.parse(updated);
    await this.database.decks.put(validated);
    return validated;
  }

  /**
   * Updates order values for an array of deck IDs inside a single transaction.
   */
  async reorderDecks(orderedDeckIds: string[]): Promise<void> {
    await this.database.transaction('rw', [this.database.decks], async () => {
      const now = Date.now();
      for (let i = 0; i < orderedDeckIds.length; i++) {
        const id = orderedDeckIds[i];
        if (!id) continue;
        const deck = await this.database.decks.get(id);
        if (deck && deck.deletedAt === null) {
          deck.order = i;
          deck.updatedAt = now;
          await this.database.decks.put(deck);
        }
      }
    });
  }

  /**
   * Recursively collects all active descendant subdeck IDs for a given deck.
   */
  async getSubdeckIds(deckId: string, includeSelf = false): Promise<string[]> {
    const allActiveDecks = await this.database.decks
      .filter((d) => d.deletedAt === null)
      .toArray();

    const childrenMap = new Map<string, string[]>();
    for (const d of allActiveDecks) {
      if (d.parentId) {
        const list = childrenMap.get(d.parentId) ?? [];
        list.push(d.id);
        childrenMap.set(d.parentId, list);
      }
    }

    const result: string[] = includeSelf ? [deckId] : [];
    const queue = [...(childrenMap.get(deckId) ?? [])];

    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      const nextChildren = childrenMap.get(current);
      if (nextChildren) {
        queue.push(...nextChildren);
      }
    }

    return result;
  }

  /**
   * Traces upwards to construct the full path from root to the given deck.
   * e.g. [Languages, German, A1]
   */
  async getDeckPath(deckId: string): Promise<Deck[]> {
    const path: Deck[] = [];
    let currentId: string | null = deckId;

    while (currentId !== null) {
      const deck: Deck | undefined = await this.database.decks.get(currentId);
      if (!deck || deck.deletedAt !== null) {
        break;
      }
      path.unshift(deck);
      currentId = deck.parentId;
    }

    return path;
  }

  /**
   * Atomically deletes a deck with explicit strategy for cards and subdecks:
   * - cardAction 'move': moves active cards to targetDeckId (preserving card IDs, FSRS data, ReviewLogs).
   * - cardAction 'delete': soft-deletes active cards (deletedAt timestamp, ReviewLogs and Notes preserved).
   * - subdeckAction 'reparent': moves direct children up to deck's parent.
   * - subdeckAction 'delete': cascades soft-deletion down to all subdecks.
   */
  async deleteDeck(deckId: string, options: DeckDeleteOptions): Promise<void> {
    await this.database.transaction('rw', [this.database.decks, this.database.cards], async () => {
      const deck = await this.database.decks.get(deckId);
      if (!deck || deck.deletedAt !== null) {
        throw new Error(`Deck with id ${deckId} not found or already deleted`);
      }

      const allDescendantIds = await this.getSubdeckIds(deckId);

      // Validate targetDeckId if cards are being moved
      if (options.cardAction === 'move') {
        const targetDeckId = options.targetDeckId;
        if (!targetDeckId) {
          throw new Error('A target deck must be specified when moving cards.');
        }
        if (targetDeckId === deckId) {
          throw new Error('Target deck cannot be the deck being deleted.');
        }

        const targetDeck = await this.database.decks.get(targetDeckId);
        if (!targetDeck || targetDeck.deletedAt !== null) {
          throw new Error('Target deck for moving cards does not exist or is deleted.');
        }

        if (options.subdeckAction === 'delete' && allDescendantIds.includes(targetDeckId)) {
          throw new Error('Target deck cannot be a subdeck that is also scheduled for deletion.');
        }
      }

      const now = Date.now();

      // Handle Subdecks
      const decksToDelete: string[] = [deckId];

      if (options.subdeckAction === 'reparent') {
        // Direct subdecks get moved to deck.parentId
        const directChildren = await this.database.decks
          .where('parentId')
          .equals(deckId)
          .filter((d) => d.deletedAt === null)
          .toArray();

        for (const child of directChildren) {
          child.parentId = deck.parentId;
          child.updatedAt = now;
          await this.database.decks.put(child);
        }
      } else {
        // subdeckAction === 'delete'
        decksToDelete.push(...allDescendantIds);
      }

      // Handle Cards of the decks being deleted
      const affectedCards = await this.database.cards
        .filter((c) => c.deletedAt === null && decksToDelete.includes(c.deckId))
        .toArray();

      if (options.cardAction === 'move') {
        for (const card of affectedCards) {
          card.deckId = options.targetDeckId!;
          card.updatedAt = now;
        }
        await this.database.cards.bulkPut(affectedCards);
      } else {
        // cardAction === 'delete' -> Soft delete cards
        for (const card of affectedCards) {
          card.deletedAt = now;
          card.updatedAt = now;
        }
        await this.database.cards.bulkPut(affectedCards);
      }

      // Soft-delete the decks
      for (const dId of decksToDelete) {
        const d = await this.database.decks.get(dId);
        if (d) {
          d.deletedAt = now;
          d.updatedAt = now;
          await this.database.decks.put(d);
        }
      }
    });
  }

  /**
   * Returns the entire deck tree with aggregated statistics (direct & total including subdecks).
   */
  async getDeckHierarchy(now = Date.now()): Promise<DeckWithStats[]> {
    const [allDecks, allCards] = await Promise.all([
      this.database.decks.filter((d) => d.deletedAt === null).toArray(),
      this.database.cards.filter((c) => c.deletedAt === null).toArray(),
    ]);

    // Compute direct card counts per deck
    const directCounts = new Map<string, DeckCardCounts>();
    for (const d of allDecks) {
      directCounts.set(d.id, { total: 0, newCount: 0, dueCount: 0 });
    }

    for (const card of allCards) {
      const counts = directCounts.get(card.deckId);
      if (counts) {
        counts.total++;
        if (!card.isSuspended) {
          if (card.state === CardState.New) {
            counts.newCount++;
          } else if (card.due <= now) {
            counts.dueCount++;
          }
        }
      }
    }

    // Index decks by ID and group children by parentId
    const deckMap = new Map<string, Deck>();
    const childrenByParent = new Map<string, Deck[]>();

    for (const d of allDecks) {
      deckMap.set(d.id, d);
      const parentKey = d.parentId ?? '__ROOT__';
      const siblings = childrenByParent.get(parentKey) ?? [];
      siblings.push(d);
      childrenByParent.set(parentKey, siblings);
    }

    // Sort helper: order ascending, then name ascending
    const sortDecks = (decks: Deck[]) => {
      return decks.sort((a, b) => {
        if (a.order !== b.order) {
          return a.order - b.order;
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      });
    };

    // Recursive tree constructor
    const buildNode = (deck: Deck, level: number): DeckWithStats => {
      const direct = directCounts.get(deck.id) ?? { total: 0, newCount: 0, dueCount: 0 };
      const rawChildren = childrenByParent.get(deck.id) ?? [];
      const sortedChildren = sortDecks(rawChildren);
      const children = sortedChildren.map((child) => buildNode(child, level + 1));

      const totalCounts: DeckCardCounts = {
        total: direct.total + children.reduce((sum, c) => sum + c.totalCounts.total, 0),
        newCount: direct.newCount + children.reduce((sum, c) => sum + c.totalCounts.newCount, 0),
        dueCount: direct.dueCount + children.reduce((sum, c) => sum + c.totalCounts.dueCount, 0),
      };

      return {
        ...deck,
        directCounts: direct,
        totalCounts,
        children,
        level,
      };
    };

    // Root decks: parentId is null OR parentId points to a non-existent/deleted deck
    const rootDecks: Deck[] = [];
    for (const d of allDecks) {
      if (d.parentId === null || !deckMap.has(d.parentId)) {
        rootDecks.push(d);
      }
    }

    const sortedRoots = sortDecks(rootDecks);
    return sortedRoots.map((root) => buildNode(root, 0));
  }

  /**
   * Retrieves card counts for a specific deck (both direct and total including subdecks).
   */
  async getDeckStats(deckId: string, now = Date.now()): Promise<{ direct: DeckCardCounts; total: DeckCardCounts }> {
    const hierarchy = await this.getDeckHierarchy(now);

    const findNode = (nodes: DeckWithStats[]): DeckWithStats | undefined => {
      for (const node of nodes) {
        if (node.id === deckId) return node;
        const found = findNode(node.children);
        if (found) return found;
      }
      return undefined;
    };

    const targetNode = findNode(hierarchy);
    if (!targetNode) {
      return {
        direct: { total: 0, newCount: 0, dueCount: 0 },
        total: { total: 0, newCount: 0, dueCount: 0 },
      };
    }

    return {
      direct: targetNode.directCounts,
      total: targetNode.totalCounts,
    };
  }
}

export const deckService = new DeckService(db);
