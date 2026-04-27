import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let ffmpegLoading = false;
let ffmpegReady = false;

/**
 * Load FFmpeg WASM core (only once per session)
 */
async function loadFFmpeg(): Promise<FFmpeg> {
  if (ffmpegReady && ffmpegInstance) return ffmpegInstance;
  if (ffmpegLoading) {
    // Wait for existing load to complete
    while (!ffmpegReady) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return ffmpegInstance!;
  }

  ffmpegLoading = true;
  const ffmpeg = new FFmpeg();

  try {
    // Use the single-threaded core build — does NOT require SharedArrayBuffer,
    // so no COEP headers are needed and cross-origin resources are unaffected.
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ffmpeg;
    ffmpegReady = true;
  } catch (error) {
    ffmpegLoading = false;
    throw new Error(`Failed to load FFmpeg: ${error}`);
  }

  return ffmpeg;
}

/**
 * Compress a video file using FFmpeg WASM
 * - Transcodes to H.264/AAC MP4
 * - Scales down to maxWidth (preserving aspect ratio)
 * - Applies CRF quality (18-28 recommended, lower = better quality)
 * - Returns a new File with .mp4 extension
 */
export async function compressVideo(
  file: File,
  options: {
    maxWidth?: number;
    crf?: number;
    onProgress?: (progress: number) => void;
  } = {}
): Promise<File> {
  const { maxWidth = 1280, crf = 28, onProgress } = options;

  try {
    const ffmpeg = await loadFFmpeg();

    // Set up progress callback
    if (onProgress) {
      ffmpeg.on("progress", ({ progress }) => {
        onProgress(Math.round(progress * 100));
      });
    }

    const inputName = "input.mp4";
    const outputName = "output.mp4";

    // Write input file to FFmpeg virtual filesystem
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    // Run FFmpeg compression
    // -vf scale: scale to maxWidth, keep aspect ratio (-1 maintains aspect)
    // -c:v libx264: H.264 codec
    // -crf: quality (18-28, lower = better)
    // -preset: encoding speed (fast = good balance)
    // -c:a aac: AAC audio codec
    // -b:a 128k: audio bitrate
    await ffmpeg.exec([
      "-i",
      inputName,
      "-vf",
      `scale='min(${maxWidth},iw)':-2`,
      "-c:v",
      "libx264",
      "-crf",
      String(crf),
      "-preset",
      "fast",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-movflags",
      "+faststart",
      outputName,
    ]);

    // Read compressed output
    const data = await ffmpeg.readFile(outputName);
    const blob = new Blob([data], { type: "video/mp4" });

    // Clean up
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile(outputName);

    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.mp4`, {
      type: "video/mp4",
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error("Video compression failed:", error);
    // Fallback: return original file
    return file;
  }
}
