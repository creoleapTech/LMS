import type { StorageProvider } from "./types";
import { parseStorageKey } from "./types";
import { LocalStorageProvider } from "./local-provider";
import { GoogleDriveProvider } from "./drive-provider";

export { parseStorageKey } from "./types";
export type { StorageProvider, StorageKeyPrefix } from "./types";

const localProvider = new LocalStorageProvider();
const driveProvider = new GoogleDriveProvider();

/**
 * Resolve the correct storage provider and path from a storage key.
 *
 * Key formats:
 *   "drive:1A2B3C4D5E6F"     → Google Drive file ID
 *   "uploads/content/..."     → Local file (backward compat)
 *   "local:uploads/..."       → Local file (explicit)
 */
export function resolveStorage(key: string): {
  provider: StorageProvider;
  path: string;
} {
  const { provider, path } = parseStorageKey(key);

  switch (provider) {
    case "drive":
      return { provider: driveProvider, path };
    case "local":
      return { provider: localProvider, path };
    case "s3":
      throw new Error("S3 storage provider not yet implemented");
    default:
      return { provider: localProvider, path };
  }
}

/**
 * Fetch a file buffer from any supported storage backend.
 * This is the main entry point — pass a storage key and get bytes back.
 */
export async function getFileFromStorage(key: string): Promise<Buffer> {
  const { provider, path } = resolveStorage(key);
  return provider.getFile(path);
}

/**
 * Check if a file exists in any supported storage backend.
 */
export async function fileExistsInStorage(key: string): Promise<boolean> {
  const { provider, path } = resolveStorage(key);
  return provider.exists(path);
}
