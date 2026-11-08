export interface MediaItem {
  filename: string;         // Primary key: e.g. "paste-12345.png" or sanitized filename
  mimeType: string;
  data: Blob;               // Binary payload
  hash: string;             // SHA-256 for deduplication
  size: number;
  updatedAt: number;
  deletedAt: number | null;
}
