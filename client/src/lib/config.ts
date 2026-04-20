interface IConfig {
  baseUrl: string;
  imgUrl: string;
  /** Proxy endpoint — hides real storage source (Drive, S3, etc.) from the client */
  proxyUrl: string;
  /** PPT preview endpoint — converts PPTX to PDF server-side */
  pptPreviewUrl: string;
}

const DEFAULT_CF_API_BASE_URL = ensureApiSuffix(
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    "http://127.0.0.1:8787/api"
);

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function ensureApiSuffix(value: string): string {
  const normalized = trimTrailingSlashes(value);
  return normalized.endsWith("/api") ? normalized : `${normalized}/api`;
}

function resolveApiBaseUrl(): string {
  const rawUrl =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ||
    (import.meta.env.VITE_BACKEND_BASE_URL as string | undefined)?.trim();

  if (!rawUrl) {
    return DEFAULT_CF_API_BASE_URL;
  }

  return ensureApiSuffix(rawUrl);
}

const BACKEND_BASE_URL = resolveApiBaseUrl();
const API_ROOT_URL = BACKEND_BASE_URL.replace(/\/api$/, "");

export const Config: IConfig = {
  baseUrl: BACKEND_BASE_URL,
  imgUrl: `${API_ROOT_URL}/api/file/local?key=`,
  proxyUrl: `${API_ROOT_URL}/api/file/proxy?key=`,
  pptPreviewUrl: `${API_ROOT_URL}/api/file/ppt-preview?key=`,
};
