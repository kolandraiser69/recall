import type { SyncQueueItem, SyncMetadata } from '../../core/models/sync';

export interface SyncPushPayload {
  deviceId: string;
  items: SyncQueueItem[];
  clientTimestamp: number;
}

export interface SyncPullResponse {
  serverTimestamp: number;
  changes: SyncQueueItem[];
  hasMore: boolean;
}

export interface CloudSyncAdapter {
  isAuthenticated(): Promise<boolean>;
  pushMutations(payload: SyncPushPayload): Promise<{ success: boolean; acknowledgedIds: string[] }>;
  pullMutations(sinceTimestamp: number): Promise<SyncPullResponse>;
  uploadMedia(filename: string, blob: Blob): Promise<string>;
  downloadMedia(filename: string): Promise<Blob | null>;
}

export interface SyncOrchestratorService {
  getMetadata(): Promise<SyncMetadata>;
  triggerSync(): Promise<{ pushedCount: number; pulledCount: number }>;
  enqueueChange(item: Omit<SyncQueueItem, 'id' | 'timestamp'>): Promise<void>;
}
