import type { RecallDatabase } from '../database';
import type { MediaItem } from '../../core/models/media';
import { mediaItemSchema } from '../../core/validation/media.schema';

export class MediaRepository {
  private activeUrls = new Map<string, string>(); // filename -> objectUrl

  constructor(private db: RecallDatabase) {}

  async getByFilename(filename: string): Promise<MediaItem | undefined> {
    return this.db.media.get(filename);
  }

  async getByHash(hash: string): Promise<MediaItem | undefined> {
    return this.db.media.where('hash').equals(hash).first();
  }

  async getAll(includeDeleted = false): Promise<MediaItem[]> {
    if (includeDeleted) {
      return this.db.media.toArray();
    }
    return this.db.media.filter((m) => m.deletedAt === null).toArray();
  }

  /**
   * Helper to compute SHA-256 hash of a Blob for deduplication.
   */
  async computeHash(blob: Blob): Promise<string> {
    if (typeof crypto !== 'undefined' && crypto.subtle && typeof crypto.subtle.digest === 'function') {
      const buffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    // Fallback simple checksum if crypto.subtle is unavailable
    return `hash_${blob.size}_${blob.type}_${Date.now()}`;
  }

  async save(data: {
    filename: string;
    mimeType: string;
    data: Blob;
    hash?: string;
  }): Promise<MediaItem> {
    const hash = data.hash ?? (await this.computeHash(data.data));
    const now = Date.now();

    const mediaItem: MediaItem = {
      filename: data.filename,
      mimeType: data.mimeType,
      data: data.data,
      hash,
      size: data.data.size,
      updatedAt: now,
      deletedAt: null,
    };

    const validated = mediaItemSchema.parse(mediaItem);
    await this.db.media.put(validated);
    return validated;
  }

  async delete(filename: string, hard = false): Promise<void> {
    this.revokeBlobUrl(filename);
    if (hard) {
      await this.db.media.delete(filename);
    } else {
      const existing = await this.getByFilename(filename);
      if (existing) {
        await this.db.media.update(filename, {
          deletedAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  }

  /**
   * Returns a cached Object URL if already created, or produces a new one.
   * Prevents multiple allocations in the browser memory for the same image/audio asset.
   */
  async getOrCreateBlobUrl(filename: string): Promise<string | null> {
    const existing = this.activeUrls.get(filename);
    if (existing) {
      return existing;
    }

    const item = await this.getByFilename(filename);
    if (!item || item.deletedAt !== null) {
      return null;
    }

    if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const url = URL.createObjectURL(item.data);
      this.activeUrls.set(filename, url);
      return url;
    }

    return null;
  }

  /**
   * Alias for getOrCreateBlobUrl for compatibility.
   */
  async createBlobUrl(filename: string): Promise<string | null> {
    return this.getOrCreateBlobUrl(filename);
  }

  /**
   * Revokes a specific Object URL by filename or URL string and releases browser memory.
   */
  revokeBlobUrl(filenameOrUrl: string): void {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
      return;
    }

    // Filename match
    if (this.activeUrls.has(filenameOrUrl)) {
      const url = this.activeUrls.get(filenameOrUrl)!;
      URL.revokeObjectURL(url);
      this.activeUrls.delete(filenameOrUrl);
      return;
    }

    // URL match
    for (const [name, url] of this.activeUrls.entries()) {
      if (url === filenameOrUrl) {
        URL.revokeObjectURL(url);
        this.activeUrls.delete(name);
        return;
      }
    }

    URL.revokeObjectURL(filenameOrUrl);
  }

  /**
   * Revokes all active Object URLs managed by this repository.
   * Call when navigating away from a study session or unmounting a card viewer.
   */
  revokeAllBlobUrls(): void {
    if (typeof URL === 'undefined' || typeof URL.revokeObjectURL !== 'function') {
      this.activeUrls.clear();
      return;
    }

    for (const url of this.activeUrls.values()) {
      URL.revokeObjectURL(url);
    }
    this.activeUrls.clear();
  }

  getActiveUrlCount(): number {
    return this.activeUrls.size;
  }
}
