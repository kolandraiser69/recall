import React, { useState, useRef } from 'react';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { Badge } from '../../../components/Badge';
import { ProgressBar } from '../../../components/ProgressBar';
import { Checkbox } from '../../../components/Checkbox';
import { SegmentedControl } from '../../../components/SegmentedControl';
import { ankiImportService } from '../../../../services/anki/ankiImportService';
import type {
  AnkiPackageManifest,
  AnkiImportOptions,
  AnkiImportProgress,
  AnkiImportResult,
} from '../../../../services/anki/types';
import {
  Upload,
  FileArchive,
  Layers,
  FileText,
  CreditCard,
  Image as ImageIcon,
  History,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

export interface AnkiImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type ModalStep = 'upload' | 'inspecting' | 'preview' | 'importing' | 'success' | 'error';

export const AnkiImportModal: React.FC<AnkiImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<ModalStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [manifest, setManifest] = useState<AnkiPackageManifest | null>(null);
  const [selectedDeckIds, setSelectedDeckIds] = useState<Set<string>>(new Set());
  const [isDragOver, setIsDragOver] = useState(false);

  // Import options
  const [options, setOptions] = useState<AnkiImportOptions>({
    importMedia: true,
    importReviews: true,
    importScheduling: true,
    conflictStrategy: 'rename',
  });

  // Progress state
  const [progress, setProgress] = useState<AnkiImportProgress>({
    stage: 'reading',
    progress: 0,
    currentStep: 'Preparing import...',
    importedDecks: 0,
    importedNotes: 0,
    importedCards: 0,
    importedMedia: 0,
    importedReviews: 0,
  });

  const [importResult, setImportResult] = useState<AnkiImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const handleReset = () => {
    setStep('upload');
    setSelectedFile(null);
    setManifest(null);
    setSelectedDeckIds(new Set());
    setImportResult(null);
    setErrorMessage('');
    setProgress({
      stage: 'reading',
      progress: 0,
      currentStep: 'Preparing import...',
      importedDecks: 0,
      importedNotes: 0,
      importedCards: 0,
      importedMedia: 0,
      importedReviews: 0,
    });
  };

  const handleClose = () => {
    if (step === 'importing') return; // Prevent closing mid-import
    handleReset();
    onClose();
  };

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.apkg') && !file.name.toLowerCase().endsWith('.zip')) {
      setErrorMessage('Please select a valid Anki package (.apkg).');
      setStep('error');
      return;
    }

    setSelectedFile(file);
    setStep('inspecting');
    setErrorMessage('');

    try {
      const inspectedManifest = await ankiImportService.inspectPackage(file, file.name);
      setManifest(inspectedManifest);
      // Pre-select all decks
      setSelectedDeckIds(new Set(inspectedManifest.decks.map((d) => String(d.id))));
      setStep('preview');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to inspect Anki archive. The file might be corrupted.'
      );
      setStep('error');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    }
  };

  const handleToggleDeck = (deckId: string) => {
    setSelectedDeckIds((prev) => {
      const next = new Set(prev);
      if (next.has(deckId)) {
        next.delete(deckId);
      } else {
        next.add(deckId);
      }
      return next;
    });
  };

  const handleToggleAllDecks = () => {
    if (!manifest) return;
    if (selectedDeckIds.size === manifest.decks.length) {
      setSelectedDeckIds(new Set());
    } else {
      setSelectedDeckIds(new Set(manifest.decks.map((d) => String(d.id))));
    }
  };

  const handleStartImport = async () => {
    if (!selectedFile || !manifest) return;

    setStep('importing');
    setErrorMessage('');

    try {
      const result = await ankiImportService.executeImport(
        selectedFile,
        {
          ...options,
          selectedDeckIds: Array.from(selectedDeckIds),
        },
        (p) => {
          setProgress(p);
        }
      );

      setImportResult(result);
      setStep('success');
      onSuccess?.();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred during import.'
      );
      setStep('error');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Anki Package (.apkg)"
      maxWidth="lg"
    >
      <div className="space-y-5">
        {/* Step 1: Upload / Dropzone */}
        {step === 'upload' && (
          <div className="space-y-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-[var(--radius-lg)] p-8 text-center cursor-pointer transition-colors duration-200 ${
                isDragOver
                  ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                  : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] bg-[var(--bg-subtle)]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".apkg,.zip"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-[var(--bg-surface)] text-[var(--accent)] shadow-xs flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Drag and drop your .apkg file here
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                or click to browse from your device
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Badge variant="neutral">Anki 2.0 / 2.1 Compatible</Badge>
                <Badge variant="accent">Local SQLite Processing</Badge>
              </div>
            </div>

            <div className="rounded-[var(--radius-md)] bg-[var(--bg-subtle)] p-3 text-xs text-[var(--text-secondary)] space-y-1">
              <span className="font-semibold text-[var(--text-primary)] block">
                Local-First &amp; Private:
              </span>
              <p>
                Your deck files are parsed directly inside your browser using WebAssembly. No data is sent to external cloud servers.
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Inspecting */}
        {step === 'inspecting' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 mx-auto text-[var(--accent)] animate-spin" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Inspecting Anki Package...
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Reading SQLite schemas, deck hierarchy, and media manifests
            </p>
          </div>
        )}

        {/* Step 3: Preview & Options */}
        {step === 'preview' && manifest && (
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Header / Summary Card */}
            <div className="p-4 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] border border-[var(--border-subtle)] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileArchive className="w-4 h-4 text-[var(--accent)]" />
                  <span className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-xs">
                    {manifest.fileName}
                  </span>
                </div>
                <Badge variant="neutral">
                  {(manifest.fileSize / (1024 * 1024)).toFixed(2)} MB
                </Badge>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2 border-t border-[var(--divider)] text-center">
                <div className="p-2 rounded bg-[var(--bg-surface)]">
                  <Layers className="w-3.5 h-3.5 mx-auto text-[var(--text-secondary)] mb-1" />
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    {manifest.decks.length}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Decks</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-surface)]">
                  <FileText className="w-3.5 h-3.5 mx-auto text-[var(--text-secondary)] mb-1" />
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    {manifest.noteCount}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Notes</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-surface)]">
                  <CreditCard className="w-3.5 h-3.5 mx-auto text-[var(--text-secondary)] mb-1" />
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    {manifest.cardCount}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Cards</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-surface)]">
                  <ImageIcon className="w-3.5 h-3.5 mx-auto text-[var(--text-secondary)] mb-1" />
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    {manifest.mediaCount}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Media</span>
                </div>
                <div className="p-2 rounded bg-[var(--bg-surface)]">
                  <History className="w-3.5 h-3.5 mx-auto text-[var(--text-secondary)] mb-1" />
                  <span className="text-xs font-bold text-[var(--text-primary)] block">
                    {manifest.revlogCount}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)]">Reviews</span>
                </div>
              </div>
            </div>

            {/* Warnings Alert */}
            {(manifest.warnings.length > 0 || manifest.unsupportedFeatures.length > 0) && (
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--warning-subtle)] border border-[var(--warning)]/30 text-xs text-[var(--text-primary)] space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-[var(--warning)]">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Compatibility Notices</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] opacity-90 pl-1">
                  {manifest.unsupportedFeatures.map((w, idx) => (
                    <li key={`u_${idx}`}>{w}</li>
                  ))}
                  {manifest.warnings.map((w, idx) => (
                    <li key={`w_${idx}`}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Deck Selection List */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--text-primary)]">
                  Select Decks to Import ({selectedDeckIds.size}/{manifest.decks.length})
                </label>
                <button
                  type="button"
                  onClick={handleToggleAllDecks}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {selectedDeckIds.size === manifest.decks.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] divide-y divide-[var(--divider)]">
                {manifest.decks.map((deck) => {
                  const idStr = String(deck.id);
                  const isChecked = selectedDeckIds.has(idStr);
                  return (
                    <div
                      key={idStr}
                      onClick={() => handleToggleDeck(idStr)}
                      className="flex items-center justify-between p-2.5 hover:bg-[var(--bg-subtle)] cursor-pointer text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isChecked}
                          onChange={() => handleToggleDeck(idStr)}
                        />
                        <span className="font-medium text-[var(--text-primary)] font-mono text-[11px]">
                          {deck.name}
                        </span>
                      </div>
                      <span className="text-[11px] text-[var(--text-secondary)]">
                        {deck.cardCount} cards
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Import Configuration Options */}
            <div className="space-y-3 pt-2 border-t border-[var(--divider)]">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Import Settings
              </label>

              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.importMedia}
                    onChange={(e) => setOptions((prev) => ({ ...prev, importMedia: e.target.checked }))}
                  />
                  <span className="text-[var(--text-primary)]">
                    Import media items ({manifest.mediaCount} images and sounds)
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.importScheduling}
                    onChange={(e) => setOptions((prev) => ({ ...prev, importScheduling: e.target.checked }))}
                  />
                  <span className="text-[var(--text-primary)]">
                    Map scheduling state into FSRS stability &amp; difficulty
                  </span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={options.importReviews}
                    onChange={(e) => setOptions((prev) => ({ ...prev, importReviews: e.target.checked }))}
                  />
                  <span className="text-[var(--text-primary)]">
                    Import historical review logs ({manifest.revlogCount} logs)
                  </span>
                </label>
              </div>

              {/* Conflict Strategy */}
              <div className="pt-2">
                <span className="text-[11px] text-[var(--text-secondary)] block mb-1.5 font-medium">
                  When a deck name matches an existing Recall deck:
                </span>
                <SegmentedControl
                  options={[
                    { value: 'rename', label: 'Rename (e.g. Deck (1))' },
                    { value: 'merge', label: 'Merge into existing' },
                  ]}
                  value={options.conflictStrategy}
                  onChange={(val) =>
                    setOptions((prev) => ({
                      ...prev,
                      conflictStrategy: val as 'rename' | 'merge',
                    }))
                  }
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--divider)]">
              <Button variant="secondary" onClick={handleReset}>
                Choose Another File
              </Button>
              <Button
                variant="primary"
                disabled={selectedDeckIds.size === 0}
                onClick={handleStartImport}
              >
                Import {selectedDeckIds.size} Deck{selectedDeckIds.size === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Progress */}
        {step === 'importing' && (
          <div className="py-8 space-y-4">
            <div className="text-center space-y-1">
              <Loader2 className="w-8 h-8 mx-auto text-[var(--accent)] animate-spin mb-2" />
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                Importing Anki Collection...
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                {progress.currentStep}
              </p>
            </div>

            <ProgressBar value={progress.progress} color="accent" />

            <div className="grid grid-cols-3 gap-2 text-center text-xs text-[var(--text-secondary)] pt-2">
              <div className="p-2 rounded bg-[var(--bg-subtle)]">
                <span className="font-bold text-[var(--text-primary)] block">
                  {progress.importedDecks}
                </span>
                <span className="text-[10px]">Decks</span>
              </div>
              <div className="p-2 rounded bg-[var(--bg-subtle)]">
                <span className="font-bold text-[var(--text-primary)] block">
                  {progress.importedNotes}
                </span>
                <span className="text-[10px]">Notes</span>
              </div>
              <div className="p-2 rounded bg-[var(--bg-subtle)]">
                <span className="font-bold text-[var(--text-primary)] block">
                  {progress.importedCards}
                </span>
                <span className="text-[10px]">Cards</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Success */}
        {step === 'success' && importResult && (
          <div className="py-6 text-center space-y-5">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--success-subtle)] text-[var(--success)] flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Import Completed Successfully!
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Imported in {(importResult.durationMs / 1000).toFixed(1)} seconds
              </p>
            </div>

            {/* Results Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)]">
                <span className="text-base font-bold text-[var(--text-primary)] block">
                  {importResult.decks.length}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)]">Decks Added</span>
              </div>
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)]">
                <span className="text-base font-bold text-[var(--text-primary)] block">
                  {importResult.notes.length}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)]">Notes Added</span>
              </div>
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)]">
                <span className="text-base font-bold text-[var(--text-primary)] block">
                  {importResult.cards.length}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)]">Cards Added</span>
              </div>
              <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)]">
                <span className="text-base font-bold text-[var(--text-primary)] block">
                  {importResult.mediaExtracted}
                </span>
                <span className="text-[11px] text-[var(--text-secondary)]">Media Extracted</span>
              </div>
            </div>

            <Button variant="primary" onClick={handleClose} className="w-full sm:w-auto">
              Done &amp; View Decks
            </Button>
          </div>
        )}

        {/* Step 6: Error */}
        {step === 'error' && (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--danger-subtle)] text-[var(--danger)] flex items-center justify-center">
              <XCircle className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Import Failed
              </h3>
              <p className="text-xs text-[var(--danger)] max-w-sm mx-auto leading-relaxed">
                {errorMessage}
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleReset}>
                Try Another Package
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
