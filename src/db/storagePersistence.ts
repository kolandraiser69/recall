export interface StorageStatus {
  isPersisted: boolean;
  quotaBytes?: number;
  usageBytes?: number;
  percentUsed?: number;
  statusMessage: string;
}

/**
 * Checks whether persistent storage has already been granted by the browser.
 */
export async function isStoragePersisted(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persisted === 'function') {
    try {
      return await navigator.storage.persisted();
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Attempts to request persistent storage from the browser.
 * The application remains 100% functional even if the request is denied or unsupported.
 */
export async function requestStoragePersistence(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.persist === 'function') {
    try {
      const persisted = await navigator.storage.persist();
      return persisted;
    } catch (err) {
      console.warn('Storage persistence request failed gracefully:', err);
      return false;
    }
  }
  return false;
}

/**
 * Returns current storage usage estimates (quota, used bytes, percentage).
 */
export async function getStorageEstimate(): Promise<{ quota: number; usage: number; percentUsed: number } | null> {
  if (typeof navigator !== 'undefined' && navigator.storage && typeof navigator.storage.estimate === 'function') {
    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;
      return { quota, usage, percentUsed };
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Inspects overall storage health.
 */
export async function getStorageStatus(): Promise<StorageStatus> {
  const isPersisted = await isStoragePersisted();
  const estimate = await getStorageEstimate();

  let statusMessage = 'Storage is volatile (standard browser sandbox).';
  if (isPersisted) {
    statusMessage = 'Storage is persistent (protected from eviction).';
  }

  return {
    isPersisted,
    quotaBytes: estimate?.quota,
    usageBytes: estimate?.usage,
    percentUsed: estimate?.percentUsed,
    statusMessage,
  };
}
