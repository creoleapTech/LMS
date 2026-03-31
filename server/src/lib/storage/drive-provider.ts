import type { StorageProvider } from "./types";

/**
 * Google Drive storage provider.
 *
 * Works with files shared as "Anyone with the link".
 * The file ID is the only thing stored in the DB — the full Drive URL
 * is never exposed to the client.
 *
 * For large files (>100MB), Google may show a virus scan warning page.
 * This provider handles that by following the confirm redirect.
 */
export class GoogleDriveProvider implements StorageProvider {
  private buildDownloadUrl(fileId: string): string {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  async getFile(fileId: string): Promise<Buffer> {
    const url = this.buildDownloadUrl(fileId);

    let response = await fetch(url, { redirect: "follow" });

    // Google may return an HTML page with a confirmation link for large files
    if (
      response.ok &&
      response.headers.get("content-type")?.includes("text/html")
    ) {
      const confirmUrl = `https://drive.google.com/uc?export=download&confirm=t&id=${fileId}`;
      response = await fetch(confirmUrl, { redirect: "follow" });
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch from Google Drive (${response.status}): ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exists(fileId: string): Promise<boolean> {
    try {
      // HEAD request to check if the file is accessible
      const url = this.buildDownloadUrl(fileId);
      const response = await fetch(url, { method: "HEAD", redirect: "follow" });
      return response.ok;
    } catch {
      return false;
    }
  }
}
