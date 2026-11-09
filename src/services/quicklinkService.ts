import { db, type RecallDatabase } from '../db/database';
import type { Quicklink } from '../core/models/quicklink';
import { INITIAL_QUICKLINKS } from '../db/migrations/v2';
import { generateId } from '../utils/id';

export class QuicklinkService {
  constructor(private database: RecallDatabase = db) {}

  /**
   * Returns all active quicklinks ordered by `order` ascending.
   * Auto-populates defaults if none exist.
   */
  async getQuicklinks(): Promise<Quicklink[]> {
    const items = await this.database.quicklinks
      .filter((q) => q.deletedAt === null)
      .sortBy('order');

    if (items.length === 0) {
      await this.database.quicklinks.bulkAdd(INITIAL_QUICKLINKS);
      return [...INITIAL_QUICKLINKS].sort((a, b) => a.order - b.order);
    }

    return items;
  }

  /**
   * Adds a new custom quicklink.
   */
  async addQuicklink(data: {
    title: string;
    url: string;
    category?: string;
    isFavorite?: boolean;
  }): Promise<Quicklink> {
    const now = Date.now();
    let domain = '';
    try {
      const parsed = new URL(data.url);
      domain = parsed.hostname.replace(/^www\./, '');
    } catch {
      domain = data.url;
    }

    // Get max order
    const all = await this.database.quicklinks.toArray();
    const maxOrder = all.reduce((max, item) => Math.max(max, item.order), -1);

    const quicklink: Quicklink = {
      id: generateId(),
      title: data.title.trim(),
      url: data.url.trim(),
      domain,
      isFavorite: Boolean(data.isFavorite),
      order: maxOrder + 1,
      category: data.category?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await this.database.quicklinks.add(quicklink);
    return quicklink;
  }

  /**
   * Updates an existing quicklink.
   */
  async updateQuicklink(id: string, updates: Partial<Pick<Quicklink, 'title' | 'url' | 'category' | 'isFavorite' | 'order'>>): Promise<Quicklink> {
    const existing = await this.database.quicklinks.get(id);
    if (!existing) throw new Error(`Quicklink not found: ${id}`);

    let domain = existing.domain;
    if (updates.url && updates.url !== existing.url) {
      try {
        const parsed = new URL(updates.url);
        domain = parsed.hostname.replace(/^www\./, '');
      } catch {
        domain = updates.url;
      }
    }

    const updated: Quicklink = {
      ...existing,
      ...updates,
      domain,
      updatedAt: Date.now(),
    };

    await this.database.quicklinks.put(updated);
    return updated;
  }

  /**
   * Deletes a quicklink (soft delete with tombstone).
   */
  async deleteQuicklink(id: string): Promise<void> {
    await this.database.quicklinks.update(id, {
      deletedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  /**
   * Toggles the favorite status of a quicklink.
   */
  async toggleFavorite(id: string): Promise<boolean> {
    const existing = await this.database.quicklinks.get(id);
    if (!existing) throw new Error(`Quicklink not found: ${id}`);

    const newFav = !existing.isFavorite;
    await this.database.quicklinks.update(id, {
      isFavorite: newFav,
      updatedAt: Date.now(),
    });
    return newFav;
  }

  /**
   * Reorders quicklinks based on provided ID array.
   */
  async reorderQuicklinks(orderedIds: string[]): Promise<void> {
    const now = Date.now();
    await this.database.transaction('rw', this.database.quicklinks, async () => {
      for (let i = 0; i < orderedIds.length; i++) {
        const id = orderedIds[i];
        if (id) {
          await this.database.quicklinks.update(id, {
            order: i,
            updatedAt: now,
          });
        }
      }
    });
  }

  /**
   * Restores predefined default quicklinks without deleting custom links.
   */
  async restoreDefaultQuicklinks(): Promise<void> {
    const now = Date.now();
    await this.database.transaction('rw', this.database.quicklinks, async () => {
      for (const def of INITIAL_QUICKLINKS) {
        const existing = await this.database.quicklinks.get(def.id);
        if (existing) {
          await this.database.quicklinks.update(def.id, {
            ...def,
            deletedAt: null,
            updatedAt: now,
          });
        } else {
          await this.database.quicklinks.add({
            ...def,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          });
        }
      }
    });
  }
}

export const quicklinkService = new QuicklinkService();
