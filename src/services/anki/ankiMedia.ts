import type { MediaRepository } from '../../db/repositories/mediaRepository';

const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  bmp: 'image/bmp',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  ogv: 'video/ogg',
};

export function getMimeType(filename: string): string {
  const parts = filename.split('.');
  if (parts.length > 1) {
    const ext = (parts[parts.length - 1] ?? '').toLowerCase();
    return MIME_TYPES[ext] || 'application/octet-stream';
  }
  return 'application/octet-stream';
}

export class AnkiMediaHandler {
  /**
   * Extracts media files from unzipped .apkg files and persists them via MediaRepository.
   *
   * @param zipFiles Unzipped files record
   * @param mediaMap Mapping of numeric zip filename -> real filename (from `media` json)
   * @param mediaRepo Target MediaRepository instance
   * @param onProgress Optional progress callback (current, total)
   */
  static async importMedia(
    zipFiles: Record<string, Uint8Array>,
    mediaMap: Record<string, string>,
    mediaRepo: MediaRepository,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ savedCount: number; warnings: string[] }> {
    const warnings: string[] = [];
    const entries = Object.entries(mediaMap);
    const total = entries.length;
    let savedCount = 0;

    for (let i = 0; i < total; i++) {
      const entry = entries[i];
      if (!entry) continue;
      const [zipKey, realFilename] = entry;
      const rawBytes = zipFiles[zipKey];

      if (!rawBytes) {
        warnings.push(`Media file "${realFilename}" (key: ${zipKey}) was missing in archive.`);
        continue;
      }

      try {
        const mimeType = getMimeType(realFilename);
        const blob = new Blob([new Uint8Array(rawBytes)], { type: mimeType });

        // Save into IndexedDB MediaRepository
        await mediaRepo.save({
          filename: realFilename,
          mimeType,
          data: blob,
        });

        savedCount++;
      } catch (err) {
        warnings.push(
          `Failed to save media "${realFilename}": ${err instanceof Error ? err.message : String(err)}`
        );
      }

      if (onProgress && (i % 10 === 0 || i === total - 1)) {
        onProgress(i + 1, total);
      }
    }

    return { savedCount, warnings };
  }
}
