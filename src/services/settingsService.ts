import type { AppSettings } from '../core/models/settings';
import { DEFAULT_APP_SETTINGS } from '../core/models/settings';
import { appSettingsSchema } from '../core/validation/settings.schema';
import type { DeckSettings } from '../core/models/deck';
import { DEFAULT_DECK_SETTINGS } from '../core/models/deck';

const STORAGE_KEY = 'recall_global_app_settings';
const LEGACY_STORAGE_KEY = 'recall_global_study_settings';

// Backward compatibility alias for Phase 4 services
export type GlobalStudySettings = AppSettings;
export const DEFAULT_GLOBAL_STUDY_SETTINGS: GlobalStudySettings = DEFAULT_APP_SETTINGS;

export type SettingsListener = (settings: AppSettings) => void;

export class SettingsService {
  private listeners = new Set<SettingsListener>();

  /**
   * Retrieves and validates application settings.
   * Falls back to defaults gracefully if stored data is corrupted or missing.
   */
  getSettings(): AppSettings {
    if (typeof window === 'undefined') return { ...DEFAULT_APP_SETTINGS };

    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        // Fallback check for legacy study key from Phase 4
        raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      }

      if (!raw) return { ...DEFAULT_APP_SETTINGS };

      const parsed = JSON.parse(raw);
      // Validate with Zod schema (with defaults for any newly added fields)
      const validated = appSettingsSchema.safeParse({
        ...DEFAULT_APP_SETTINGS,
        ...parsed,
      });

      if (validated.success) {
        return validated.data;
      } else {
        console.warn('Invalid settings found in localStorage; falling back to defaults:', validated.error);
        return { ...DEFAULT_APP_SETTINGS };
      }
    } catch (err) {
      console.error('Failed to parse settings from storage:', err);
      return { ...DEFAULT_APP_SETTINGS };
    }
  }

  /**
   * Saves updated settings to storage and notifies subscribers.
   */
  saveSettings(settings: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const candidate = {
      ...current,
      ...settings,
    };

    const validated = appSettingsSchema.parse(candidate);

    if (typeof window !== 'undefined') {
      try {
        const serialized = JSON.stringify(validated);
        localStorage.setItem(STORAGE_KEY, serialized);
        // Keep legacy key in sync for any external consumer
        localStorage.setItem(LEGACY_STORAGE_KEY, serialized);

        // Dispatch window event for cross-component reactivity
        window.dispatchEvent(new CustomEvent('recall-settings-changed', { detail: validated }));
      } catch (err) {
        console.error('Failed to save settings to localStorage:', err);
      }
    }

    this.notify(validated);
    return validated;
  }

  /**
   * Resets settings back to standard defaults.
   */
  resetSettings(): AppSettings {
    return this.saveSettings(DEFAULT_APP_SETTINGS);
  }

  /**
   * Subscribe to settings changes.
   */
  subscribe(listener: SettingsListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(settings: AppSettings): void {
    for (const listener of this.listeners) {
      try {
        listener(settings);
      } catch (err) {
        console.error('Settings listener threw error:', err);
      }
    }
  }

  /**
   * Resolves effective deck settings by merging global defaults with deck-specific overrides.
   */
  getEffectiveDeckSettings(deckSettings?: Partial<DeckSettings>): DeckSettings {
    const global = this.getSettings();
    return {
      desiredRetention: deckSettings?.desiredRetention ?? global.desiredRetention ?? DEFAULT_DECK_SETTINGS.desiredRetention,
      newCardsPerDay: deckSettings?.newCardsPerDay ?? global.newCardsPerDay ?? DEFAULT_DECK_SETTINGS.newCardsPerDay,
      maxReviewsPerDay: deckSettings?.maxReviewsPerDay ?? global.maxReviewsPerDay ?? DEFAULT_DECK_SETTINGS.maxReviewsPerDay,
      learningSteps: deckSettings?.learningSteps && deckSettings.learningSteps.length > 0 ? deckSettings.learningSteps : global.learningSteps,
      relearningSteps: deckSettings?.relearningSteps && deckSettings.relearningSteps.length > 0 ? deckSettings.relearningSteps : global.relearningSteps,
      fsrsParameters: deckSettings?.fsrsParameters,
    };
  }
}

export const settingsService = new SettingsService();
