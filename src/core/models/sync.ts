export type SyncTable = 'decks' | 'notes' | 'cards' | 'noteTypes' | 'reviews' | 'media';

export type SyncAction = 'insert' | 'update' | 'delete';

export interface SyncQueueItem {
  id: string;               // Unique queue item id
  table: SyncTable;         // Entity table name
  entityId: string;         // Target record ID
  action: SyncAction;       // Mutation type
  payload?: unknown;        // Serialized data payload for offline pushes
  timestamp: number;        // UTC millisecond timestamp
}

export interface SyncMetadata {
  lastSyncTimestamp: number | null;
  deviceId: string;
  remoteUserId: string | null;
  autoSyncEnabled: boolean;
}
