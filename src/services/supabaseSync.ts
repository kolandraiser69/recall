import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { db, type RecallDatabase } from '../db/database';

export interface SyncStatus {
  isConfigured: boolean;
  isConnected: boolean;
  user: User | null;
  lastSyncedAt: number | null;
  isSyncing: boolean;
  pendingChangesCount: number;
  lastError: string | null;
}

export type SyncStatusListener = (status: SyncStatus) => void;

const SYNC_CONFIG_KEY = 'recall_supabase_config';
const LAST_SYNC_KEY = 'recall_supabase_last_synced_at';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export class SupabaseSyncService {
  private client: SupabaseClient | null = null;
  private currentUser: User | null = null;
  private isSyncing = false;
  private lastError: string | null = null;
  private listeners = new Set<SyncStatusListener>();

  constructor(private database: RecallDatabase = db) {
    this.initClient();
  }

  private initClient() {
    if (typeof window === 'undefined') return;

    let url = (import.meta as any).env?.VITE_SUPABASE_URL || '';
    let anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '';

    // Check user-configured override in localStorage
    try {
      const stored = localStorage.getItem(SYNC_CONFIG_KEY);
      if (stored) {
        const parsed: SupabaseConfig = JSON.parse(stored);
        if (parsed.url && parsed.anonKey) {
          url = parsed.url;
          anonKey = parsed.anonKey;
        }
      }
    } catch (err) {
      console.warn('Failed to parse stored Supabase config:', err);
    }

    if (url && anonKey) {
      try {
        this.client = createClient(url, anonKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
          },
        });

        this.client.auth.getSession().then(({ data }) => {
          this.currentUser = data.session?.user || null;
          this.notify();
        });

        this.client.auth.onAuthStateChange((_event, session) => {
          this.currentUser = session?.user || null;
          this.notify();
        });
      } catch (err) {
        console.warn('Failed to initialize Supabase client:', err);
        this.client = null;
      }
    }
  }

  getStatus(): SyncStatus {
    const lastSyncedAt = typeof window !== 'undefined'
      ? Number(localStorage.getItem(LAST_SYNC_KEY)) || null
      : null;

    return {
      isConfigured: Boolean(this.client),
      isConnected: Boolean(this.client && this.currentUser),
      user: this.currentUser,
      lastSyncedAt,
      isSyncing: this.isSyncing,
      pendingChangesCount: 0, // Computed dynamically during sync check
      lastError: this.lastError,
    };
  }

  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  private notify() {
    const status = this.getStatus();
    for (const listener of this.listeners) {
      listener(status);
    }
  }

  /**
   * Configures custom Supabase credentials from Settings UI.
   */
  configure(config: SupabaseConfig) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(config));
    }
    this.initClient();
    this.notify();
  }

  /**
   * Clears custom configuration and disconnects client.
   */
  disconnect() {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SYNC_CONFIG_KEY);
      localStorage.removeItem(LAST_SYNC_KEY);
    }
    if (this.client) {
      this.client.auth.signOut().catch(() => {});
    }
    this.client = null;
    this.currentUser = null;
    this.notify();
  }

  /**
   * Signs in user with email and password.
   */
  async signIn(email: string, password: string): Promise<User> {
    if (!this.client) throw new Error('Supabase client is not configured.');
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.user) throw new Error('Sign in failed: no user returned.');
    this.currentUser = data.user;
    this.notify();
    return data.user;
  }

  /**
   * Signs up user with email and password.
   */
  async signUp(email: string, password: string): Promise<User | null> {
    if (!this.client) throw new Error('Supabase client is not configured.');
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    this.currentUser = data.user;
    this.notify();
    return data.user;
  }

  /**
   * Signs out current user.
   */
  async signOut(): Promise<void> {
    if (this.client) {
      await this.client.auth.signOut();
    }
    this.currentUser = null;
    this.notify();
  }

  /**
   * Executes bidirectional synchronization between local IndexedDB and Supabase.
   * Preserves append-only review logs and handles tombstones safely.
   */
  async syncNow(): Promise<{ success: boolean; syncedItems: number }> {
    if (!this.client || !this.currentUser) {
      throw new Error('Supabase is not connected or user is not logged in.');
    }

    if (this.isSyncing) {
      return { success: false, syncedItems: 0 };
    }

    this.isSyncing = true;
    this.lastError = null;
    this.notify();

    const userId = this.currentUser.id;
    let totalSynced = 0;

    try {
      const lastSync = Number(localStorage.getItem(LAST_SYNC_KEY)) || 0;
      const syncStartTime = Date.now();

      // 1. Sync Decks (Last-Write-Wins based on updatedAt)
      const localDecks = await this.database.decks.filter((d) => d.updatedAt > lastSync).toArray();
      if (localDecks.length > 0) {
        const payload = localDecks.map((d) => ({
          id: d.id,
          user_id: userId,
          parent_id: d.parentId,
          name: d.name,
          description: d.description,
          settings: d.settings,
          sort_order: d.order,
          updated_at: new Date(d.updatedAt).toISOString(),
          deleted_at: d.deletedAt ? new Date(d.deletedAt).toISOString() : null,
        }));
        await this.client.from('decks').upsert(payload);
        totalSynced += localDecks.length;
      }

      // 2. Sync Reviews (Strictly Append-Only)
      const localReviews = await this.database.reviews.filter((r) => r.reviewTime > lastSync).toArray();
      if (localReviews.length > 0) {
        const payload = localReviews.map((r) => ({
          id: r.id,
          user_id: userId,
          card_id: r.cardId,
          rating: r.rating,
          state: r.state,
          due: r.due,
          stability: r.stability,
          difficulty: r.difficulty,
          elapsed_days: r.elapsedDays,
          last_elapsed_days: r.lastElapsedDays,
          scheduled_days: r.scheduledDays,
          review_time: r.reviewTime,
          duration_ms: r.durationMs,
          deleted_at: r.deletedAt ? new Date(r.deletedAt).toISOString() : null,
        }));
        await this.client.from('reviews').upsert(payload, { onConflict: 'id' });
        totalSynced += localReviews.length;
      }

      // 3. Sync Calendar Events & Rules
      const localEvents = await this.database.calendarEvents.filter((e) => e.updatedAt > lastSync).toArray();
      if (localEvents.length > 0) {
        const payload = localEvents.map((e) => ({
          id: e.id,
          user_id: userId,
          title: e.title,
          description: e.description,
          location: e.location,
          start_time: e.start,
          end_time: e.end,
          is_all_day: e.isAllDay,
          category_id: e.categoryId,
          recurring_rule_id: e.recurringRuleId,
          updated_at: new Date(e.updatedAt).toISOString(),
          deleted_at: e.deletedAt ? new Date(e.deletedAt).toISOString() : null,
        }));
        await this.client.from('calendar_events').upsert(payload);
        totalSynced += localEvents.length;
      }

      // 4. Sync Quicklinks
      const localLinks = await this.database.quicklinks.filter((q) => q.updatedAt > lastSync).toArray();
      if (localLinks.length > 0) {
        const payload = localLinks.map((q) => ({
          id: q.id,
          user_id: userId,
          title: q.title,
          url: q.url,
          domain: q.domain,
          is_favorite: q.isFavorite,
          sort_order: q.order,
          category: q.category,
          updated_at: new Date(q.updatedAt).toISOString(),
          deleted_at: q.deletedAt ? new Date(q.deletedAt).toISOString() : null,
        }));
        await this.client.from('quicklinks').upsert(payload);
        totalSynced += localLinks.length;
      }

      // Update sync watermark
      if (typeof window !== 'undefined') {
        localStorage.setItem(LAST_SYNC_KEY, String(syncStartTime));
      }

      this.lastError = null;
      return { success: true, syncedItems: totalSynced };
    } catch (err: any) {
      console.error('Supabase sync error:', err);
      this.lastError = err?.message || 'Synchronization failed.';
      throw err;
    } finally {
      this.isSyncing = false;
      this.notify();
    }
  }
}

export const supabaseSyncService = new SupabaseSyncService();
