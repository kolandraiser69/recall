export type ThemeSetting = 'light' | 'dark' | 'system';
export type LanguageSetting = 'en' | 'de';

export interface AppSettings {
  // Study & FSRS Parameters
  desiredRetention: number; // 0.80 - 0.97 (default 0.90)
  newCardsPerDay: number;
  maxReviewsPerDay: number;
  learningSteps: number[]; // in minutes, e.g. [1, 10]
  relearningSteps: number[]; // in minutes, e.g. [10]
  dayCutoffHour: number; // 0 - 23 (default 4 AM)
  autoRevealAnswer: boolean;
  showTimer: boolean;

  // General & Accessibility
  language: LanguageSetting;
  theme: ThemeSetting;
  compactDensity: boolean;
  reducedMotion: boolean;
  confirmDestructive: boolean;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  desiredRetention: 0.90,
  newCardsPerDay: 20,
  maxReviewsPerDay: 200,
  learningSteps: [1, 10],
  relearningSteps: [10],
  dayCutoffHour: 4,
  autoRevealAnswer: false,
  showTimer: true,
  language: 'en',
  theme: 'system',
  compactDensity: false,
  reducedMotion: false,
  confirmDestructive: true,
};
