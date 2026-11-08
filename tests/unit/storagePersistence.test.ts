import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  isStoragePersisted,
  requestStoragePersistence,
  getStorageEstimate,
  getStorageStatus,
} from '../../src/db/storagePersistence';

describe('Storage Persistence Manager', () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('should gracefully handle missing navigator.storage in unsupported environments', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {},
      configurable: true,
      writable: true,
    });

    const persisted = await isStoragePersisted();
    expect(persisted).toBe(false);

    const requested = await requestStoragePersistence();
    expect(requested).toBe(false);

    const estimate = await getStorageEstimate();
    expect(estimate).toBeNull();

    const status = await getStorageStatus();
    expect(status.isPersisted).toBe(false);
    expect(status.statusMessage).toContain('volatile');
  });

  it('should report persistent when navigator.storage.persist() returns true', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        storage: {
          persisted: vi.fn().mockResolvedValue(true),
          persist: vi.fn().mockResolvedValue(true),
          estimate: vi.fn().mockResolvedValue({ quota: 1000000, usage: 250000 }),
        },
      },
      configurable: true,
      writable: true,
    });

    const persisted = await isStoragePersisted();
    expect(persisted).toBe(true);

    const requested = await requestStoragePersistence();
    expect(requested).toBe(true);

    const estimate = await getStorageEstimate();
    expect(estimate).not.toBeNull();
    expect(estimate?.quota).toBe(1000000);
    expect(estimate?.usage).toBe(250000);
    expect(estimate?.percentUsed).toBe(25);

    const status = await getStorageStatus();
    expect(status.isPersisted).toBe(true);
    expect(status.statusMessage).toContain('persistent');
  });

  it('should gracefully tolerate errors thrown by navigator.storage.persist()', async () => {
    Object.defineProperty(global, 'navigator', {
      value: {
        storage: {
          persist: vi.fn().mockRejectedValue(new Error('Permission denied')),
          persisted: vi.fn().mockRejectedValue(new Error('Inspection failed')),
        },
      },
      configurable: true,
      writable: true,
    });

    const persisted = await isStoragePersisted();
    expect(persisted).toBe(false);

    const requested = await requestStoragePersistence();
    expect(requested).toBe(false);
  });
});
