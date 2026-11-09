import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Dexie from 'dexie';
import { RecallDatabase } from '../../src/db/database';
import { SupabaseSyncService } from '../../src/services/supabaseSync';
import { pwaService } from '../../src/pwa/pwaService';

describe('PWA & Cloud Sync Integration Tests', () => {
  const dbName = `TestPWASyncDB_${Date.now()}_${Math.random()}`;
  let testDb: RecallDatabase;
  let syncService: SupabaseSyncService;

  beforeEach(async () => {
    testDb = new RecallDatabase(dbName);
    await testDb.initialize();
    syncService = new SupabaseSyncService(testDb);
  });

  afterEach(async () => {
    await testDb.close();
    await Dexie.delete(dbName);
  });

  it('should initialize PWA service with online state and install listeners', () => {
    expect(typeof pwaService.isOnline).toBe('boolean');
    expect(pwaService.isOnline).toBe(true); // jsdom default is online
    expect(pwaService.isInstallable).toBe(false);

    let reportedOnline = false;
    const unsub = pwaService.subscribeNetwork((online) => {
      reportedOnline = online;
    });
    expect(reportedOnline).toBe(true);
    unsub();
  });

  it('should handle unconfigured Supabase gracefully without network errors', async () => {
    const status = syncService.getStatus();
    expect(status.isConnected).toBe(false);
    expect(status.user).toBeNull();
    expect(status.isSyncing).toBe(false);

    // Calling syncNow when unconfigured should throw a descriptive error
    await expect(syncService.syncNow()).rejects.toThrow(
      'Supabase is not connected or user is not logged in.'
    );
  });

  it('should allow configuring and disconnecting Supabase credentials in local storage', () => {
    syncService.configure({
      url: 'https://test-project.supabase.co',
      anonKey: 'fake-test-key-for-unit-testing',
    });

    const statusAfterConfig = syncService.getStatus();
    expect(statusAfterConfig.isConfigured).toBe(true);

    syncService.disconnect();
    const statusAfterDisconnect = syncService.getStatus();
    expect(statusAfterDisconnect.isConfigured).toBe(false);
    expect(statusAfterDisconnect.isConnected).toBe(false);
  });
});
