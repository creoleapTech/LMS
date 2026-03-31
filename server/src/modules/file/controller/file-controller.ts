import Elysia, { t } from "elysia";
// @ts-ignore
import mime from "mime-types";
import { convertPptToPdf, convertPptBufferToPdf } from "@/lib/ppt-converter";
import { getFileFromStorage, parseStorageKey } from "@/lib/storage";

export const fileController = new Elysia({
  prefix: "/file",
  detail: {
    tags: ["User - File"],
  },
})
  /**
   * Proxy endpoint — serves files from any storage backend.
   * The client only knows this URL; the actual source (Drive, local, S3) is hidden.
   */
  .get(
    "/proxy",
    async ({ set, query }) => {
      try {
        const { key } = query;

        if (!key) {
          set.status = 400;
          return { message: "Key not found" };
        }

        // Block direct download of raw PPTX — force the viewer endpoint
        const lowerKey = key.toLowerCase();
        if (lowerKey.endsWith(".pptx") || lowerKey.endsWith(".ppt")) {
          set.status = 403;
          return {
            message:
              "Direct download of presentation files is not allowed. Use the viewer.",
          };
        }

        const buffer = await getFileFromStorage(key);

        // Determine MIME type from the key path
        const { path: filePath } = parseStorageKey(key);
        const mimeType =
          mime.lookup(filePath) || "application/octet-stream";

        set.headers["Content-Type"] = mimeType;
        set.headers["Content-Disposition"] = "inline";
        set.headers["X-Content-Type-Options"] = "nosniff";
        set.headers["Cache-Control"] = "private, max-age=3600";

        return buffer;
      } catch (error: any) {
        console.error("File proxy error:", error);
        set.status = 404;
        return { message: "File not found" };
      }
    },
    {
      query: t.Object({
        key: t.String(),
      }),
      detail: {
        summary: "Proxy file from any storage backend (Drive, local, S3)",
        description:
          "Streams file content without exposing the underlying storage URL.",
      },
    }
  )

  /**
   * PPT preview — serves PPTX for client-side rendering (format=raw),
   * or converts to PDF via LibreOffice (default fallback).
   */
  .get(
    "/ppt-preview",
    async ({ set, query }) => {
      try {
        const { key, format } = query;

        if (!key) {
          set.status = 400;
          return { message: "Key not found" };
        }

        const lowerKey = key.toLowerCase();
        if (!lowerKey.endsWith(".pptx") && !lowerKey.endsWith(".ppt")) {
          set.status = 400;
          return { message: "Only presentation files are supported" };
        }

        // format=raw → serve the raw PPTX for client-side rendering
        if (format === "raw") {
          const buffer = await getFileFromStorage(key);

          set.headers["Content-Type"] =
            "application/vnd.openxmlformats-officedocument.presentationml.presentation";
          set.headers["Content-Disposition"] = "inline";
          set.headers["X-Content-Type-Options"] = "nosniff";
          set.headers["Cache-Control"] = "private, max-age=3600";

          return buffer;
        }

        // Default: convert to PDF via LibreOffice
        const { provider: providerType } = parseStorageKey(key);
        let pdfPath: string;

        if (providerType === "local") {
          const { path: filePath } = parseStorageKey(key);
          const sourceFile = Bun.file(filePath);
          if (!(await sourceFile.exists())) {
            set.status = 404;
            return { message: "Presentation file not found" };
          }
          pdfPath = await convertPptToPdf(filePath);
        } else {
          const buffer = await getFileFromStorage(key);
          pdfPath = await convertPptBufferToPdf(buffer, key);
        }

        const pdfFile = Bun.file(pdfPath);

        set.headers["Content-Type"] = "application/pdf";
        set.headers["Content-Disposition"] = "inline";
        set.headers["X-Content-Type-Options"] = "nosniff";
        set.headers["Cache-Control"] = "private, max-age=3600";

        return pdfFile;
      } catch (error: any) {
        console.error("PPT preview error:", error);
        set.status = 500;
        return {
          message:
            error.message || "Failed to generate presentation preview",
        };
      }
    },
    {
      query: t.Object({
        key: t.String(),
        format: t.Optional(t.String()),
      }),
      detail: {
        summary: "Preview PPT/PPTX — raw for client rendering, or PDF fallback",
        description:
          "Pass format=raw to get the PPTX file for client-side rendering. Otherwise converts to PDF via LibreOffice.",
      },
    }
  )

  /**
   * Legacy local file endpoint (backward compat for existing content).
   */
  .get(
    "/local",
    async ({ set, query }) => {
      try {
        const { key } = query;

        if (!key) {
          set.status = 400;
          return { message: "Key Not Found" };
        }

        // Block direct access to raw PPTX files
        if (
          key.toLowerCase().endsWith(".pptx") ||
          key.toLowerCase().endsWith(".ppt")
        ) {
          set.status = 403;
          return {
            message:
              "Direct download of presentation files is not allowed. Use the viewer.",
          };
        }

        const file = Bun.file(key);

        if (!file) {
          set.status = 400;
          return { message: "File not found" };
        }

        // Force inline display, prevent download
        set.headers["Content-Type"] = file.type || "image/png";
        set.headers["Content-Disposition"] = "inline";
        set.headers["X-Content-Type-Options"] = "nosniff";

        return file;
      } catch (error: any) {
        console.log(error);
        set.status = 400;
        return { message: error };
      }
    },
    {
      query: t.Object({
        key: t.String(),
      }),
      detail: {
        description: "View a file from local",
        summary: "View a file from local (legacy)",
      },
    }
  );
