/**
 * Read the current auth token from localStorage.
 *
 * The app stores the token in two places for historical reasons:
 * - `localStorage.token` (plain string) set on login.
 * - `auth-storage` (Zustand persist) set by the auth store.
 *
 * We try both so callers in keepalive/unload handlers don't depend on the
 * axios interceptor being able to run.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const plain = localStorage.getItem("token");
    if (plain) return plain;
  } catch {
    // ignore
  }

  try {
    const stored = localStorage.getItem("auth-storage");
    if (stored) {
      const parsed = JSON.parse(stored);
      const fromStore = parsed?.state?.user?.token;
      if (fromStore) return fromStore;
    }
  } catch {
    // ignore
  }

  return null;
}
