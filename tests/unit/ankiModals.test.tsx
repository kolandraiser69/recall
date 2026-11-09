import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AnkiImportModal } from '../../src/ui/views/Settings/components/AnkiImportModal';
import { AnkiExportModal } from '../../src/ui/views/Settings/components/AnkiExportModal';
import { ankiImportService } from '../../src/services/anki/ankiImportService';
import { ankiExportService } from '../../src/services/anki/ankiExportService';

import { ToastProvider } from '../../src/ui/components/Toast';

vi.mock('../../src/services/anki/ankiImportService', () => ({
  ankiImportService: {
    inspectPackage: vi.fn(),
    executeImport: vi.fn(),
  },
}));

vi.mock('../../src/services/anki/ankiExportService', () => ({
  ankiExportService: {
    exportPackage: vi.fn(),
  },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: () => [
    { id: 'deck-1', name: 'Test Deck 1' },
    { id: 'deck-2', name: 'Test Deck 2' },
  ],
}));

describe('AnkiImportModal & AnkiExportModal UI Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AnkiImportModal', () => {
    it('renders upload dropzone when opened', () => {
      render(<AnkiImportModal isOpen={true} onClose={vi.fn()} />);

      expect(screen.getByText('Import Anki Package (.apkg)')).toBeDefined();
      expect(screen.getByText('Drag and drop your .apkg file here')).toBeDefined();
      expect(screen.getByText('Anki 2.0 / 2.1 Compatible')).toBeDefined();
    });

    it('rejects files without .apkg or .zip extension', async () => {
      render(<AnkiImportModal isOpen={true} onClose={vi.fn()} />);

      const invalidFile = new File(['dummy'], 'document.pdf', { type: 'application/pdf' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [invalidFile] } });

      await waitFor(() => {
        expect(screen.getByText('Import Failed')).toBeDefined();
        expect(screen.getByText('Please select a valid Anki package (.apkg).')).toBeDefined();
      });
    });

    it('transitions to preview upon valid package inspection', async () => {
      vi.mocked(ankiImportService.inspectPackage).mockResolvedValueOnce({
        fileName: 'spanish_a1.apkg',
        fileSize: 1024 * 1024 * 2.5,
        schemaVersion: 11,
        decks: [{ id: 1, name: 'Spanish::Basics', cardCount: 15, noteCount: 10 }],
        noteTypes: [{ id: 1, name: 'Basic', fieldCount: 2, templateCount: 1 }],
        noteCount: 10,
        cardCount: 15,
        revlogCount: 25,
        mediaCount: 3,
        mediaFilenames: ['audio.mp3', 'flag.png'],
        warnings: [],
        unsupportedFeatures: [],
      });

      render(<AnkiImportModal isOpen={true} onClose={vi.fn()} />);

      const validFile = new File(['valid'], 'spanish_a1.apkg', { type: 'application/octet-stream' });
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      fireEvent.change(input, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(screen.getByText('spanish_a1.apkg')).toBeDefined();
        expect(screen.getByText('Spanish::Basics')).toBeDefined();
        expect(screen.getByText('Import 1 Deck')).toBeDefined();
      });
    });
  });

  describe('AnkiExportModal', () => {
    it('renders export options and deck choices', () => {
      render(
        <ToastProvider>
          <AnkiExportModal isOpen={true} onClose={vi.fn()} />
        </ToastProvider>
      );

      expect(screen.getByText('Export to Anki (.apkg)')).toBeDefined();
      expect(screen.getByText('Include media assets (images, audio)')).toBeDefined();
      expect(screen.getByText('Include review history logs')).toBeDefined();
      expect(screen.getByText('Download .apkg')).toBeDefined();
    });

    it('triggers export and download when clicking Download .apkg', async () => {
      const mockBlob = new Blob(['mock apkg content'], { type: 'application/zip' });
      vi.mocked(ankiExportService.exportPackage).mockResolvedValueOnce({
        blob: mockBlob,
        filename: 'Recall_Export.apkg',
      });

      render(
        <ToastProvider>
          <AnkiExportModal isOpen={true} onClose={vi.fn()} />
        </ToastProvider>
      );

      const downloadButton = screen.getByText('Download .apkg');
      fireEvent.click(downloadButton);

      await waitFor(() => {
        expect(ankiExportService.exportPackage).toHaveBeenCalled();
        expect(screen.getByText('Package Exported!')).toBeDefined();
      });
    });
  });
});
