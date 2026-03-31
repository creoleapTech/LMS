import { existsSync } from "node:fs";
import type { StorageProvider } from "./types";

export class LocalStorageProvider implements StorageProvider {
  async getFile(filePath: string): Promise<Buffer> {
    const file = Bun.file(filePath);
    if (!(await file.exists())) {
      throw new Error(`Local file not found: ${filePath}`);
    }
    const arrayBuffer = await file.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async exists(filePath: string): Promise<boolean> {
    return existsSync(filePath);
  }
}
