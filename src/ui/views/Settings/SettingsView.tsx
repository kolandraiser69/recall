import React, { useEffect, useState, useRef } from 'react';
import {
  Sun,
  Moon,
  Laptop,
  HardDrive,
  Keyboard,
  Sparkles,
  Save,
  Upload,
  Download,
  Package,
  FileArchive,
  AlertTriangle,
  RotateCcw,
  Check,
  ShieldAlert,
} from 'lucide-react';
import { useTheme, type Theme } from '../../theme/ThemeProvider';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SectionContainer } from '../../components/SectionContainer';
import { Badge } from '../../components/Badge';
import { useKeyboardShortcuts } from '../../keyboard/KeyboardShortcutsProvider';
import { useToast } from '../../components/Toast';
import { getStorageStatus, type StorageStatus } from '../../../db/storagePersistence';
import { settingsService } from '../../../services/settingsService';
import { backupService, type RecallBackup } from '../../../services/backupService';
import type { AppSettings } from '../../../core/models/settings';
import { AnkiImportModal } from './components/AnkiImportModal';
import { AnkiExportModal } from './components/AnkiExportModal';
import { PwaSettingsSection } from './components/PwaSettingsSection';
import { SupabaseSyncSection } from './components/SupabaseSyncSection';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { toggleHelp } = useKeyboardShortcuts();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);

  // App Settings State
  const [settings, setSettings] = useState<AppSettings>(() => settingsService.getSettings());
  const [learningStepsInput, setLearningStepsInput] = useState(() =>
    settings.learningSteps.join(', ')
  );
  const [relearningStepsInput, setRelearningStepsInput] = useState(() =>
    settings.relearningSteps.join(', ')
  );

  // Anki Import & Export Modals
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Backup & Restore State
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<RecallBackup | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');
  const [isRestoring, setIsRestoring] = useState(false);

  // Factory Reset State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    getStorageStatus().then(setStorageStatus);
    const unsubscribe = settingsService.subscribe((updated) => {
      setSettings(updated);
    });
    return () => unsubscribe();
  }, []);

  const themeOptions: { value: Theme; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: 'Light', icon: <Sun className="w-3.5 h-3.5" /> },
    { value: 'dark', label: 'Dark', icon: <Moon className="w-3.5 h-3.5" /> },
    { value: 'system', label: 'System', icon: <Laptop className="w-3.5 h-3.5" /> },
  ];

  const handleExportFullBackup = async () => {
    setIsExportingBackup(true);
    try {
      const backup = await backupService.exportBackup(true);
      backupService.downloadBackupFile(backup);
      toast.success('Recall backup archive downloaded successfully.');
    } catch (err) {
      console.error('Backup export failed:', err);
      toast.error('Failed to generate collection backup archive.');
    } finally {
      setIsExportingBackup(false);
    }
  };

  const handleFileSelectedForRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = await backupService.parseAndValidateBackup(text);
      setPendingBackup(backup);
    } catch (err: unknown) {
      console.error('Failed to parse backup:', err);
      const msg = err instanceof Error ? err.message : 'Invalid backup JSON file';
      toast.error(`Invalid backup: ${msg}`);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const executeRestore = async () => {
    if (!pendingBackup) return;
    setIsRestoring(true);
    try {
      const result = await backupService.restoreBackup(pendingBackup, restoreMode);
      toast.success(
        `Restored ${result.decksRestored} decks, ${result.notesRestored} notes, and ${result.cardsRestored} cards.`
      );
      setPendingBackup(null);
      // Refresh local settings state
      setSettings(settingsService.getSettings());
    } catch (err) {
      console.error('Restore error:', err);
      toast.error('Failed to restore backup snapshot.');
    } finally {
      setIsRestoring(false);
    }
  };

  const executeFactoryReset = async () => {
    if (resetConfirmText.trim().toUpperCase() !== 'RESET') {
      toast.error('Please type RESET to confirm factory reset.');
      return;
    }
    setIsResetting(true);
    try {
      await backupService.factoryReset();
      toast.success('Recall database has been reset to defaults.');
      setIsResetModalOpen(false);
      setResetConfirmText('');
      setSettings(settingsService.getSettings());
    } catch (err) {
      console.error('Factory reset failed:', err);
      toast.error('Failed to reset database.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Header */}
      <div className="border-b border-[var(--divider)] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">Settings</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          General preferences, FSRS defaults, backups, and data management
        </p>
      </div>

      {/* General & Appearance Section */}
      <SectionContainer title="Appearance &amp; General" description="Customize interface theme and behavior">
        <Card variant="standard" padding="md" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-sm font-semibold text-[var(--text-primary)]">Interface Theme</span>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Automatically adjusts with your operating system or locks to light or dark mode.
              </p>
            </div>
            <SegmentedControl
              options={themeOptions}
              value={theme}
              onChange={(val) => {
                setTheme(val);
                settingsService.saveSettings({ theme: val });
                toast.info(`Theme set to ${val}`);
              }}
            />
          </div>

          <div className="pt-3 border-t border-[var(--divider)] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">Interface Language</label>
              <select
                value={settings.language}
                onChange={(e) => {
                  const lang = e.target.value as 'en' | 'de';
                  const updated = settingsService.saveSettings({ language: lang });
                  setSettings(updated);
                  toast.success(`Language set to ${lang === 'en' ? 'English' : 'Deutsch'}`);
                }}
                className="w-full h-8 px-2.5 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              >
                <option value="en">English (US)</option>
                <option value="de">Deutsch</option>
              </select>
              <span className="text-[11px] text-[var(--text-tertiary)] block">
                Primary UI localization language.
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.compactDensity}
                  onChange={(e) => {
                    const updated = settingsService.saveSettings({ compactDensity: e.target.checked });
                    setSettings(updated);
                  }}
                  className="rounded border-[var(--border-subtle)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="text-xs text-[var(--text-primary)] font-medium">Compact Density</span>
              </label>
              <p className="text-[11px] text-[var(--text-tertiary)] pl-5">
                Reduces padding and table row heights for dense displays.
              </p>

              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={settings.reducedMotion}
                  onChange={(e) => {
                    const updated = settingsService.saveSettings({ reducedMotion: e.target.checked });
                    setSettings(updated);
                  }}
                  className="rounded border-[var(--border-subtle)] text-[var(--accent)] focus:ring-[var(--accent)]"
                />
                <span className="text-xs text-[var(--text-primary)] font-medium">Reduced Motion</span>
              </label>
              <p className="text-[11px] text-[var(--text-tertiary)] pl-5">
                Minimizes animations and transitions across the application.
              </p>
            </div>
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
                  FSRS-4.5 calculates optimal review intervals based on memory stability and difficulty. Individual deck settings take priority over these defaults.
                </p>
              </div>
            </div>
            <Badge variant="accent">FSRS-4.5</Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border-subtle)]">
            {/* Target Retention */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--text-primary)]">
                Desired Retention ({Math.round(settings.desiredRetention * 100)}%)
              </label>
              <input
                type="range"
                min="0.80"
                max="0.97"
                step="0.01"
                value={settings.desiredRetention}
                onChange={(e) =>
                  setSettings((prev) => ({
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
                value={settings.dayCutoffHour}
                onChange={(e) =>
                  setSettings((prev) => ({
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
                value={settings.newCardsPerDay}
                onChange={(e) =>
                  setSettings((prev) => ({
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
                value={settings.maxReviewsPerDay}
                onChange={(e) =>
                  setSettings((prev) => ({
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
                Comma-separated minutes when a card lapses (e.g. 10).
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.showTimer}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    showTimer: e.target.checked,
                  }))
                }
                className="rounded border-[var(--border-subtle)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-xs text-[var(--text-primary)]">
                Show review response timer during study
              </span>
            </label>

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
                  ...settings,
                  learningSteps: validLearning.length > 0 ? validLearning : [1, 10],
                  relearningSteps: validRelearning.length > 0 ? validRelearning : [10],
                });
                setSettings(updated);
                toast.success('Study and FSRS preferences saved.');
              }}
            >
              Save Study Defaults
            </Button>
          </div>
        </Card>
      </SectionContainer>

      {/* Backup & Restore Section */}
      <SectionContainer
        title="Backup &amp; Restore"
        description="Lossless snapshot archives of all decks, notes, cards, media, and configurations"
      >
        <Card variant="standard" padding="md" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-[var(--radius-md)] bg-[var(--accent-subtle)] text-[var(--accent)] mt-0.5">
                <FileArchive className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  Recall JSON Archive (.json)
                </span>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Export complete collection state including media attachments and preferences, or restore previous backups safely with integrity validation.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={handleExportFullBackup}
                disabled={isExportingBackup}
              >
                {isExportingBackup ? 'Exporting...' : 'Export Backup'}
              </Button>

              <input
                type="file"
                ref={fileInputRef}
                accept=".json"
                className="hidden"
                onChange={handleFileSelectedForRestore}
              />
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => fileInputRef.current?.click()}
              >
                Restore Backup
              </Button>
            </div>
          </div>
        </Card>
      </SectionContainer>

      {/* Anki Import & Export Section */}
      <SectionContainer
        title="Anki Interoperability"
        description="Migrate decks, flashcards, media assets, and review history between Anki and Recall"
      >
        <Card variant="standard" padding="md" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] mt-0.5">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-[var(--text-primary)]">
                  Anki Package Archives (.apkg)
                </span>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Import existing packages with media and FSRS mapping, or export your collections to universal Schema-11 .apkg files.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Upload className="w-3.5 h-3.5" />}
                onClick={() => setIsImportModalOpen(true)}
              >
                Import .apkg
              </Button>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => setIsExportModalOpen(true)}
              >
                Export .apkg
              </Button>
            </div>
          </div>
        </Card>
      </SectionContainer>
 
      {/* PWA & Installation */}
      <PwaSettingsSection />

      {/* Cloud Sync (Supabase) */}
      <SupabaseSyncSection />

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

      {/* Danger Zone: Factory Reset */}
      <SectionContainer title="Danger Zone" description="Irreversible database wipe and factory reset">
        <Card variant="standard" padding="md" className="border-red-500/20 bg-red-500/5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-[var(--radius-md)] bg-red-500/10 text-red-500 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                  Reset Recall Database
                </span>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Permanently erase all decks, flashcards, review histories, and media. Default note types will be restored.
                </p>
              </div>
            </div>
            <Button
              variant="destructive"
              size="sm"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => {
                setResetConfirmText('');
                setIsResetModalOpen(true);
              }}
            >
              Reset Database
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

      {/* Restore Confirmation Modal */}
      {pendingBackup && (
        <Modal
          isOpen={true}
          onClose={() => setPendingBackup(null)}
          title="Restore Collection Backup"
          description="Review archive contents and select restoration mode"
          maxWidth="lg"
        >
          <div className="space-y-5">
            <div className="p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] space-y-2 text-xs">
              <div className="flex items-center justify-between font-mono text-[var(--text-secondary)]">
                <span>Backup Timestamp:</span>
                <span>{new Date(pendingBackup.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between font-mono text-[var(--text-secondary)]">
                <span>Recall Version:</span>
                <span>v{pendingBackup.metadata?.appVersion || '0.1.0'} (Payload v{pendingBackup.version})</span>
              </div>
              <div className="pt-2 border-t border-[var(--border-subtle)] grid grid-cols-3 gap-2 text-center">
                <div className="p-2 rounded bg-[var(--bg-surface)]">
                  <span className="text-base font-bold text-[var(--text-primary)] block">
                    {pendingBackup.decks.length}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Decks</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-surface)]">
                  <span className="text-base font-bold text-[var(--text-primary)] block">
                    {pendingBackup.notes.length}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Notes</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-surface)]">
                  <span className="text-base font-bold text-[var(--text-primary)] block">
                    {pendingBackup.cards.length}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Cards</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-tertiary)] pt-1">
                <span>{pendingBackup.reviews.length} review logs</span>
                <span>{pendingBackup.media ? pendingBackup.media.length : 0} media assets</span>
              </div>
            </div>

            {/* Restore Mode Radio / Select */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Restoration Mode:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  className={`p-3 rounded-[var(--radius-md)] border cursor-pointer transition-colors ${
                    restoreMode === 'replace'
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="replace"
                      checked={restoreMode === 'replace'}
                      onChange={() => setRestoreMode('replace')}
                      className="text-[var(--accent)]"
                    />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Replace (Clean Restore)
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1 pl-5">
                    Wipes existing tables and restores exact archive snapshot.
                  </p>
                </label>

                <label
                  className={`p-3 rounded-[var(--radius-md)] border cursor-pointer transition-colors ${
                    restoreMode === 'merge'
                      ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-surface)]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="restoreMode"
                      value="merge"
                      checked={restoreMode === 'merge'}
                      onChange={() => setRestoreMode('merge')}
                      className="text-[var(--accent)]"
                    />
                    <span className="text-xs font-semibold text-[var(--text-primary)]">
                      Merge (Keep Existing)
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-tertiary)] mt-1 pl-5">
                    Upserts incoming items without deleting unrelated decks.
                  </p>
                </label>
              </div>
            </div>

            {restoreMode === 'replace' && (
              <div className="flex items-start gap-2 p-3 rounded-[var(--radius-md)] bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Warning: Replace mode will overwrite your current database. Ensure you have exported a recent backup if needed.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--divider)]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingBackup(null)}
                disabled={isRestoring}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Check className="w-3.5 h-3.5" />}
                onClick={executeRestore}
                disabled={isRestoring}
              >
                {isRestoring ? 'Restoring Snapshot...' : 'Confirm Restore'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Factory Reset Modal */}
      <Modal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Reset Entire Database"
        description="This action cannot be undone."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 rounded-[var(--radius-md)] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs leading-relaxed">
            All decks, notes, cards, review logs, and media attachments will be permanently deleted from this browser&apos;s IndexedDB storage.
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[var(--text-primary)]">
              Type <strong className="font-mono text-red-600 dark:text-red-400">RESET</strong> to confirm:
            </label>
            <Input
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              placeholder="RESET"
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--divider)]">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsResetModalOpen(false)}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              leftIcon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={executeFactoryReset}
              disabled={isResetting || resetConfirmText.trim().toUpperCase() !== 'RESET'}
            >
              {isResetting ? 'Resetting...' : 'Permanently Reset'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Anki Modals */}
      <AnkiImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
      <AnkiExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
      />
    </div>
  );
};
