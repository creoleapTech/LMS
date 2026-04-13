export async function saveFile(
  bucket: R2Bucket,
  blob: Blob | File | undefined,
  parentFolder: string,
): Promise<{ ok: boolean; key: string }> {
  try {
    if (!blob) {
      return { ok: false, key: "" };
    }

    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(2, 8);
    const name = "name" in blob ? (blob as File).name : "file";
    const extension = name.split(".").pop() || "bin";
    const key = `${parentFolder}/${timestamp}-${randomStr}.${extension}`;

    await bucket.put(key, blob);

    return { ok: true, key };
  } catch (error) {
    console.error("Error saving file:", error);
    return { ok: false, key: "" };
  }
}

export async function deleteFile(
  bucket: R2Bucket,
  key: string,
): Promise<{ ok: boolean }> {
  try {
    await bucket.delete(key);
    return { ok: true };
  } catch (error) {
    console.error(`Error deleting file ${key}:`, error);
    return { ok: false };
  }
}

export async function getFile(
  bucket: R2Bucket,
  key: string,
): Promise<R2ObjectBody | null> {
  return bucket.get(key);
}

export function deliverFile(key: string): string {
  return `/api/file/proxy?key=${encodeURIComponent(key)}`;
}
