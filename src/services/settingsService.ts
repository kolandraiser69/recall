import type { DeckSettings } from '../core/models/deck';
import { DEFAULT_DECK_SETTINGS } from '../core/models/deck';

const STORAGE_KEY = 'recall_global_study_settings';

export interface GlobalStudySettings extends DeckSettings {
  dayCutoffHour: number; // e.g. 4 for 4:00 AM day boundary
}

export const DEFAULT_GLOBAL_STUDY_SETTINGS: GlobalStudySettings = {
  ...DEFAULT_DECK_SETTINGS,
  dayCutoffHour: 4,
};

export class SettingsService {
  getSettings(): GlobalStudySettings {
    if (typeof window === 'undefined') return DEFAULT_GLOBAL_STUDY_SETTINGS;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return DEFAULT_GLOBAL_STUDY_SETTINGS;
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_GLOBAL_STUDY_SETTINGS,
        ...parsed,
      };
    } catch {
      return DEFAULT_GLOBAL_STUDY_SETTINGS;
    }
  }

  saveSettings(settings: Partial<GlobalStudySettings>): GlobalStudySettings {
    const current = this.getSettings();
    const updated: GlobalStudySettings = {
      ...current,
      ...settings,
    };
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (err) {
        console.error('Failed to save settings to localStorage:', err);
      }
    }
    return updated;
  }
}

export const settingsService = new SettingsService();
