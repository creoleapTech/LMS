import { Hono } from "hono";
import type { Bindings, Variables } from "../../env";

const fileController = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// No auth middleware — public file serving routes

// ─── GET /proxy — serve files from R2 ─────────────

fileController.get("/proxy", async (c) => {
  try {
    if (!c.env.BUCKET) {
      return c.json(
        { message: "File storage is not configured. Enable R2 to use file endpoints." },
        503,
      );
    }

    const key = c.req.query("key");

    if (!key) {
      return c.json({ message: "Key not found" }, 400);
    }

    // Block direct download of raw PPTX — force the viewer endpoint
    const lowerKey = key.toLowerCase();
    if (lowerKey.endsWith(".pptx") || lowerKey.endsWith(".ppt")) {
      return c.json(
        {
          message:
            "Direct download of presentation files is not allowed. Use the viewer.",
        },
        403,
      );
    }

    const object = await c.env.BUCKET.get(key);

    if (!object) {
      return c.json({ message: "File not found" }, 404);
    }

    // Determine MIME type from the key path
    const mimeType = getMimeType(key);

    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Content-Disposition", "inline");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(object.body, { headers });
  } catch (error: any) {
    console.error("File proxy error:", error);
    return c.json({ message: "File not found" }, 404);
  }
});

// ─── GET /ppt-preview — STUB (LibreOffice not available in Workers) ─

fileController.get("/ppt-preview", async (c) => {
  return c.json(
    {
      message:
        "PPT preview is not available in Cloudflare Workers. LibreOffice conversion is not supported in this environment.",
    },
    501,
  );
});

// ─── GET /local — serve via R2 proxy (backward compat) ─

fileController.get("/local", async (c) => {
  try {
    if (!c.env.BUCKET) {
      return c.json(
        { message: "File storage is not configured. Enable R2 to use file endpoints." },
        503,
      );
    }

    const key = c.req.query("key");

    if (!key) {
      return c.json({ message: "Key not found" }, 400);
    }

    // Block direct access to raw PPTX files
    const lowerKey = key.toLowerCase();
    if (lowerKey.endsWith(".pptx") || lowerKey.endsWith(".ppt")) {
      return c.json(
        {
          message:
            "Direct download of presentation files is not allowed. Use the viewer.",
        },
        403,
      );
    }

    const object = await c.env.BUCKET.get(key);

    if (!object) {
      return c.json({ message: "File not found" }, 404);
    }

    const mimeType = getMimeType(key);

    const headers = new Headers();
    headers.set("Content-Type", mimeType);
    headers.set("Content-Disposition", "inline");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Cache-Control", "private, max-age=3600");

    return new Response(object.body, { headers });
  } catch (error: any) {
    console.error("File local error:", error);
    return c.json({ message: "File not found" }, 404);
  }
});

// ─── MIME type helper (avoids mime-types dependency) ─

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".json": "application/json",
  ".xml": "application/xml",
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".rar": "application/x-rar-compressed",
  ".tar": "application/x-tar",
  ".gz": "application/gzip",
};

function getMimeType(key: string): string {
  const ext = key.slice(key.lastIndexOf(".")).toLowerCase();
  return MIME_MAP[ext] || "application/octet-stream";
}

export { fileController };
