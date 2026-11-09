import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { RecallDatabase } from '../../src/db/database';
import { QuicklinkService } from '../../src/services/quicklinkService';
import { DEFAULT_QUICKLINKS } from '../../src/core/models/quicklink';

describe('QuicklinkService Tests', () => {
  const dbName = `TestQuicklinkDB_${Date.now()}_${Math.random()}`;
  let testDb: RecallDatabase;
  let quicklinkService: QuicklinkService;

  beforeEach(async () => {
    testDb = new RecallDatabase(dbName);
    await testDb.initialize();
    quicklinkService = new QuicklinkService(testDb);
  });

  afterEach(async () => {
    await testDb.close();
    await Dexie.delete(dbName);
  });

  it('should initialize with all 11 predefined university quicklinks', async () => {
    const links = await quicklinkService.getQuicklinks();
    expect(links.length).toBe(11);

    const titles = links.map((l) => l.title);
    expect(titles).toContain('THI Lernportal');
    expect(titles).toContain('ChatGPT');
    expect(titles).toContain('Claude');
    expect(titles).toContain('Gemini');
    expect(titles).toContain('Qwen Chat');
    expect(titles).toContain('PDF24 Tools');
    expect(titles).toContain('Learn Anything');
    expect(titles).toContain('Quickref');
    expect(titles).toContain('THI Exams – Wirtschaftsinformatik');
    expect(titles).toContain('THI Quicklinks');
    expect(titles).toContain('Outlook');
  });

  it('should create, update, and toggle favorites for quicklinks', async () => {
    const custom = await quicklinkService.addQuicklink({
      title: 'GitHub Classroom',
      url: 'https://classroom.github.com',
      category: 'Universität',
    });

    expect(custom.id).toBeDefined();
    expect(custom.isFavorite).toBe(false);

    // Toggle favorite
    const isFav = await quicklinkService.toggleFavorite(custom.id);
    expect(isFav).toBe(true);

    const allWithFav = await quicklinkService.getQuicklinks();
    const favItem = allWithFav.find((f) => f.id === custom.id);
    expect(favItem?.isFavorite).toBe(true);

    // Update
    const updated = await quicklinkService.updateQuicklink(custom.id, {
      title: 'GitHub Classroom - Org',
    });
    expect(updated.title).toBe('GitHub Classroom - Org');

    // Delete (soft delete)
    await quicklinkService.deleteQuicklink(custom.id);

    const remaining = await quicklinkService.getQuicklinks();
    expect(remaining.some((l) => l.id === custom.id)).toBe(false);
  });

  it('should restore default quicklinks cleanly', async () => {
    // Delete all current links
    const all = await quicklinkService.getQuicklinks();
    for (const link of all) {
      await quicklinkService.deleteQuicklink(link.id);
    }

    // Directly clear table to simulate complete reset
    await testDb.quicklinks.clear();

    // Restore defaults
    await quicklinkService.restoreDefaultQuicklinks();
    const restored = await quicklinkService.getQuicklinks();
    expect(restored.length).toBe(DEFAULT_QUICKLINKS.length);
    expect(restored.length).toBe(11);
  });

  it('should reorder quicklinks correctly', async () => {
    const links = await quicklinkService.getQuicklinks();
    const reversedIds = links.map((l) => l.id).reverse();

    await quicklinkService.reorderQuicklinks(reversedIds);

    const reordered = await quicklinkService.getQuicklinks();
    expect(reordered[0]!.id).toBe(reversedIds[0]);
    expect(reordered[reordered.length - 1]!.id).toBe(reversedIds[reversedIds.length - 1]);
  });
});
