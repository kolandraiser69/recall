import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../db/database';
import { Modal } from '../../../components/Modal';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { Checkbox } from '../../../components/Checkbox';
import { Select } from '../../../components/Select';
import { useToast } from '../../../components/Toast';
import { ankiExportService } from '../../../../services/anki/ankiExportService';
import { Download, CheckCircle2, Loader2, Sparkles } from 'lucide-react';

export interface AnkiExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDeckId?: string;
}

export const AnkiExportModal: React.FC<AnkiExportModalProps> = ({
  isOpen,
  onClose,
  initialDeckId,
}) => {
  const toast = useToast();
  const allDecks = useLiveQuery(() => db.decks.filter((d) => d.deletedAt === null).toArray(), []) ?? [];

  const [selectedDeckId, setSelectedDeckId] = useState<string>(initialDeckId ?? 'all');
  const [includeMedia, setIncludeMedia] = useState<boolean>(true);
  const [includeReviews, setIncludeReviews] = useState<boolean>(true);
  const [customFilename, setCustomFilename] = useState<string>('');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportComplete, setExportComplete] = useState<boolean>(false);

  const deckOptions = [
    { value: 'all', label: `Entire Collection (${allDecks.length} Decks)` },
    ...allDecks.map((d) => ({
      value: d.id,
      label: d.name,
    })),
  ];

  const handleExport = async () => {
    setIsExporting(true);
    setExportComplete(false);

    try {
      const targetDeckId = selectedDeckId === 'all' ? undefined : selectedDeckId;
      const { blob, filename } = await ankiExportService.exportPackage({
        deckId: targetDeckId,
        includeMedia,
        includeReviews,
        filename: customFilename.trim() ? (customFilename.endsWith('.apkg') ? customFilename : `${customFilename}.apkg`) : undefined,
      });

      // Trigger browser download
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup blob url after download
      setTimeout(() => {
        URL.revokeObjectURL(downloadUrl);
      }, 5000);

      setIsExporting(false);
      setExportComplete(true);
      toast.success(`Exported ${filename} successfully!`);
    } catch (err) {
      setIsExporting(false);
      toast.error(
        err instanceof Error ? err.message : 'Failed to export Anki package.'
      );
    }
  };

  const handleClose = () => {
    if (isExporting) return;
    setExportComplete(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Export to Anki (.apkg)"
      maxWidth="md"
    >
      <div className="space-y-5">
        {exportComplete ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-[var(--success-subtle)] text-[var(--success)] flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                Package Exported!
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Your download has started. This .apkg file can be imported into Anki desktop, mobile, or shared with peers.
              </p>
            </div>

            <div className="pt-2">
              <Button variant="primary" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Target Deck Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Select Scope to Export
              </label>
              <Select
                options={deckOptions}
                value={selectedDeckId}
                onChange={(e) => setSelectedDeckId(e.target.value)}
              />
              <span className="text-[11px] text-[var(--text-tertiary)] block">
                Selecting a parent deck automatically includes all nested subdecks.
              </span>
            </div>

            {/* Export Options */}
            <div className="space-y-2.5 pt-2 border-t border-[var(--divider)]">
              <label className="text-xs font-semibold text-[var(--text-primary)] block">
                Export Options
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <Checkbox
                  checked={includeMedia}
                  onChange={(e) => setIncludeMedia(e.target.checked)}
                />
                <span className="text-[var(--text-primary)]">
                  Include media assets (images, audio)
                </span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <Checkbox
                  checked={includeReviews}
                  onChange={(e) => setIncludeReviews(e.target.checked)}
                />
                <span className="text-[var(--text-primary)]">
                  Include review history logs
                </span>
              </label>
            </div>

            {/* Custom Filename */}
            <div className="space-y-1.5 pt-2 border-t border-[var(--divider)]">
              <label className="text-xs font-semibold text-[var(--text-primary)]">
                Custom Filename (Optional)
              </label>
              <Input
                placeholder="e.g. My_Recall_Collection.apkg"
                value={customFilename}
                onChange={(e) => setCustomFilename(e.target.value)}
              />
            </div>

            {/* Info notice */}
            <div className="p-3 rounded-[var(--radius-md)] bg-[var(--bg-subtle)] text-xs text-[var(--text-secondary)] flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-[var(--accent)] shrink-0 mt-0.5" />
              <p className="text-[11px] leading-relaxed">
                Exported packages adhere to universal Anki Schema 11. They are fully compatible with Anki 2.0, 2.1, AnkiMobile iOS, AnkiDroid, and AnkiWeb.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--divider)]">
              <Button variant="secondary" onClick={handleClose} disabled={isExporting}>
                Cancel
              </Button>
              <Button
                variant="primary"
                leftIcon={isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                onClick={handleExport}
                disabled={isExporting}
              >
                {isExporting ? 'Generating Package...' : 'Download .apkg'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
