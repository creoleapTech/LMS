/**
 * Storage provider abstraction.
 * Currently supports local filesystem and Google Drive.
 * Designed to be swapped for S3/Azure Blob in the future.
 */

export interface StorageProvider {
  /** Fetch file contents as a Buffer */
  getFile(key: string): Promise<Buffer>;

  /** Check if a file exists in this storage */
  exists(key: string): Promise<boolean>;
}

/**
 * Storage key format:
 *   "drive:<FILE_ID>"         → Google Drive
 *   "uploads/..."             → Local filesystem (backward compat)
 *   "local:uploads/..."       → Local filesystem (explicit)
 *
 * Future:
 *   "s3:<bucket>/<key>"       → AWS S3
 */
export type StorageKeyPrefix = "drive" | "local" | "s3";

export function parseStorageKey(key: string): { provider: StorageKeyPrefix; path: string } {
  if (key.startsWith("drive:")) {
    return { provider: "drive", path: key.slice("drive:".length) };
  }
  if (key.startsWith("local:")) {
    return { provider: "local", path: key.slice("local:".length) };
  }
  if (key.startsWith("s3:")) {
    return { provider: "s3", path: key.slice("s3:".length) };
  }
  // Default: treat as local path (backward compat for existing "uploads/..." keys)
  return { provider: "local", path: key };
}
