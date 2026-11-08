import React, { useEffect, useState } from 'react';
import { Sun, Moon, Laptop, HardDrive, Keyboard } from 'lucide-react';
import { useTheme, type Theme } from '../../theme/ThemeProvider';
import { SegmentedControl } from '../../components/SegmentedControl';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { SectionContainer } from '../../components/SectionContainer';
import { Badge } from '../../components/Badge';
import { useKeyboardShortcuts } from '../../keyboard/KeyboardShortcutsProvider';
import { useToast } from '../../components/Toast';
import { getStorageStatus, type StorageStatus } from '../../../db/storagePersistence';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { toggleHelp } = useKeyboardShortcuts();
  const toast = useToast();
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);

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
