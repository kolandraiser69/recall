import React, { useEffect, useState } from 'react';
import { Sun, Moon, Laptop, HardDrive, Keyboard, Sparkles, Save } from 'lucide-react';
import { useTheme, type Theme } from '../../theme/ThemeProvider';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { SectionContainer } from '../../components/SectionContainer';
import { Badge } from '../../components/Badge';
import { useKeyboardShortcuts } from '../../keyboard/KeyboardShortcutsProvider';
import { useToast } from '../../components/Toast';
import { getStorageStatus, type StorageStatus } from '../../../db/storagePersistence';
import { settingsService, type GlobalStudySettings } from '../../../services/settingsService';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { toggleHelp } = useKeyboardShortcuts();
  const toast = useToast();
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);

  // Global Study Settings State
  const [studySettings, setStudySettings] = useState<GlobalStudySettings>(() =>
    settingsService.getSettings()
  );
  const [learningStepsInput, setLearningStepsInput] = useState(() =>
    studySettings.learningSteps.join(', ')
  );
  const [relearningStepsInput, setRelearningStepsInput] = useState(() =>
    studySettings.relearningSteps.join(', ')
  );

  useEffect(() => {
    getStorageStatus().then(setStorageStatus);
  }, []);

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
    { value: 'system', label: 'System', icon: <Laptop className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="border-b border-[var(--divider)] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Settings</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Appearance, local storage persistence, and application preferences
        </p>
      </div>

      {/* Appearance Section */}
      <SectionContainer title="Appearance" description="Choose your preferred color theme">
        <Card variant="standard" padding="md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">Interface Theme</span>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Automatically adjusts with your system or locks to light or dark mode.
              </p>
            </div>
            <SegmentedControl
              options={themeOptions}
              value={theme}
              onChange={(val) => {
                setTheme(val);
                toast.info(`Theme set to ${val}`);
              }}
            />
          </div>
        </Card>
      </SectionContainer>

      {/* Study & FSRS Scheduling Defaults */}
      <SectionContainer
        title="Study &amp; FSRS-4.5 Defaults"
        description="Global parameters for spaced repetition scheduling and daily limits"
      >
        <Card variant="standard" padding="md" className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-[var(--radius-md)] bg-[var(--accent-subtle)] text-[var(--accent)] mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">FSRS Algorithm Engine</span>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  FSRS-4.5 calculates optimal review intervals based on memory stability and difficulty. Deck settings take priority over these defaults.
                </p>
              </div>
            </div>
            <Badge variant="accent">FSRS-4.5</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-subtle)]">
            {/* Target Retention */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Desired Retention ({Math.round(studySettings.desiredRetention * 100)}%)
              </label>
              <input
                type="range"
                min="0.80"
                max="0.97"
                step="0.01"
                value={studySettings.desiredRetention}
                onChange={(e) =>
                  setStudySettings((prev) => ({
                    ...prev,
                    desiredRetention: parseFloat(e.target.value),
                  }))
                }
                className="w-full accent-[var(--accent)] cursor-pointer"
              />
              <span className="text-[11px] text-[var(--text-tertiary)] block">
                Recommended: 90%. Higher values increase reviews to minimize forgetting.
              </span>
            </div>

            {/* Day Cutoff Hour */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Day Roll-Over Hour (00:00 - 23:00)
              </label>
              <Input
                type="number"
                min="0"
                max="23"
                value={studySettings.dayCutoffHour}
                onChange={(e) =>
                  setStudySettings((prev) => ({
                    ...prev,
                    dayCutoffHour: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
              <span className="text-[11px] text-[var(--text-tertiary)] block">
                Hour of the morning when daily new &amp; review counters reset (default 4 AM).
              </span>
            </div>

            {/* Default New Cards per day */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Default New Cards / Day
              </label>
              <Input
                type="number"
                min="0"
                max="500"
                value={studySettings.newCardsPerDay}
                onChange={(e) =>
                  setStudySettings((prev) => ({
                    ...prev,
                    newCardsPerDay: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </div>

            {/* Default Max Reviews per day */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Default Max Reviews / Day
              </label>
              <Input
                type="number"
                min="0"
                max="2000"
                value={studySettings.maxReviewsPerDay}
                onChange={(e) =>
                  setStudySettings((prev) => ({
                    ...prev,
                    maxReviewsPerDay: parseInt(e.target.value, 10) || 0,
                  }))
                }
              />
            </div>

            {/* Learning steps */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Learning Steps (minutes)
              </label>
              <Input
                value={learningStepsInput}
                onChange={(e) => setLearningStepsInput(e.target.value)}
                placeholder="1, 10"
              />
              <span className="text-[11px] text-[var(--text-tertiary)] block">
                Comma-separated minutes for cards in initial learning (e.g. 1, 10).
              </span>
            </div>

            {/* Relearning steps */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Relearning Steps (minutes)
              </label>
              <Input
                value={relearningStepsInput}
                onChange={(e) => setRelearningStepsInput(e.target.value)}
                placeholder="10"
              />
              <span className="text-[11px] text-[var(--text-tertiary)] block">
                Comma-separated minutes when a card is lapsed (e.g. 10).
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end pt-3 border-t border-[var(--divider)]">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Save className="w-3.5 h-3.5" />}
              onClick={() => {
                const parseSteps = (str: string) =>
                  str
                    .split(',')
                    .map((s) => parseInt(s.trim(), 10))
                    .filter((n) => !isNaN(n) && n > 0);

                const validLearning = parseSteps(learningStepsInput);
                const validRelearning = parseSteps(relearningStepsInput);

                const updated = settingsService.saveSettings({
                  ...studySettings,
                  learningSteps: validLearning.length > 0 ? validLearning : [1, 10],
                  relearningSteps: validRelearning.length > 0 ? validRelearning : [10],
                });
                setStudySettings(updated);
                toast.success('Study and FSRS preferences saved.');
              }}
            >
              Save Study Defaults
            </Button>
          </div>
        </Card>
      </SectionContainer>

      {/* Storage & Local-First Health */}
      <SectionContainer title="Storage &amp; Local Persistence" description="IndexedDB health and device quota">
        <Card variant="standard" padding="md" className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] mt-0.5">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">Client Storage Status</span>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {storageStatus?.statusMessage || 'Inspecting IndexedDB sandbox...'}
                </p>
              </div>
            </div>
            <Badge variant={storageStatus?.isPersisted ? 'success' : 'neutral'}>
              {storageStatus?.isPersisted ? 'Persistent Storage' : 'Best-Effort'}
            </Badge>
          </div>

          {storageStatus?.quotaBytes && (
            <div className="pt-3 border-t border-[var(--divider)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Allocated Quota</span>
              <span className="font-mono">
                {Math.round((storageStatus.usageBytes || 0) / (1024 * 1024))} MB / {Math.round(storageStatus.quotaBytes / (1024 * 1024))} MB
              </span>
            </div>
          )}
        </Card>
      </SectionContainer>

      {/* Keyboard Shortcuts */}
      <SectionContainer title="Keyboard Navigation" description="Desktop accelerators and chords">
        <Card variant="standard" padding="md">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
                <Keyboard className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</span>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Quickly navigate with key chords like <kbd className="font-mono bg-[var(--bg-muted)] px-1 rounded text-[10px]">G</kbd> <kbd className="font-mono bg-[var(--bg-muted)] px-1 rounded text-[10px]">H</kbd>
                </p>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={toggleHelp}>
              View Shortcuts
            </Button>
          </div>
        </Card>
      </SectionContainer>

      {/* About Section */}
      <SectionContainer title="About Recall">
        <Card variant="standard" padding="md" className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-[var(--text-primary)]">Recall</span>
            <span className="text-xs font-mono text-[var(--text-tertiary)]">Version 0.1.0</span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Recall is a free, modern, offline-first spaced repetition learning app powered by FSRS-4.5 and IndexedDB. Designed with visual clarity, privacy, and long-term data integrity.
          </p>
        </Card>
      </SectionContainer>
    </div>
  );
};
