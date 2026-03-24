import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";

export const saveFile = async (blob: Blob | undefined, parentFolder: string) => {
  try {
    if (!blob) {
      return { ok: false, filename: "" };
    }

    // Preserve original MIME type
    const newBlob = new Blob([blob], {
      type: blob.type || "application/octet-stream",
    });

    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const extension = blob.name.split('.').pop() || 'bin';
    const filename = `uploads/${parentFolder}/${timestamp}-${randomStr}.${extension}`;

    // Ensure directory exists
    const dir = path.join('uploads', parentFolder);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Get array buffer and write file
    const arrayBuffer = await newBlob.arrayBuffer();
    writeFileSync(filename, Buffer.from(arrayBuffer));

    return { ok: true, filename };
  } catch (error) {
    console.error("Error saving file:", error);
    return { ok: false, filename: "" };
  }
};

export const deliverFile = (filename: string) => {
  return `http://localhost:4000/view/${filename}`;
};

export const deleteFile = async (filename: string, parentFolder: string) => {
  try {
    console.log(`Attempting to delete file: ${filename}`);

    // Verify filename format
    const parts = filename.split('/');
    if (parts.length !== 3 || parts[0] !== 'uploads' || parts[1] !== parentFolder) {
      throw new Error(`Invalid filename format: ${filename}`);
    }

    await fs.unlink(filename);
    console.log(`Successfully deleted file: ${filename}`);
    return { ok: true };
  } catch (error) {
    console.error(`Error deleting file ${filename}:`, error);
    return { ok: false };
  }
};
