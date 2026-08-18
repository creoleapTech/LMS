import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

/**
 * Wraps dynamic imports to automatically recover from stale chunk errors
 * caused by new deployments replacing old asset hashes.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T } | Record<string, any>>,
  componentName?: string
): LazyExoticComponent<T> {
  return lazy(async () => {
    const storageKey = `retry-chunk-reload-${componentName || 'default'}`;
    const hasRefreshed = sessionStorage.getItem(storageKey) === 'true';

    try {
      const module = await factory();
      sessionStorage.removeItem(storageKey);
      if ('default' in module && module.default) {
        return { default: module.default as T };
      }
      const keys = Object.keys(module);
      const component = (module as any)[keys[0]];
      return { default: component as T };
    } catch (error: any) {
      const isChunkError =
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Failed to load module script') ||
        error?.message?.includes('Expected a JavaScript-or-Wasm module script') ||
        error?.name === 'ChunkLoadError' ||
        error?.type === 'vite:preloadError';

      if (!hasRefreshed && isChunkError) {
        sessionStorage.setItem(storageKey, 'true');
        window.location.reload();
        // Return a promise that never resolves while the page is reloading
        return new Promise<{ default: T }>(() => {});
      }

      throw error;
    }
  });
}
