/**
 * Cache strategy behind sw.js: precache the app shell on install and answer every
 * same-origin GET network-first, so a visit with a connection always runs the latest
 * deployment and an offline one runs the copy that last loaded
 */

export const CACHE_VERSION = 'v1';

// Everything index.html needs to boot, so a single online visit is enough to open the app
// offline later. Paths are relative to sw.js, which sits beside index.html in every
// deployment (production root or a PR preview folder)
export const APP_SHELL = [
  './index.html',
  './css/styles.css',
  './manifest.webmanifest',
  './js/main.js',
  './js/app.js',
  './js/pwa.js',
  './js/installButton.js',
  './js/timer.js',
  './js/timerManager.js',
  './js/storageService.js',
  './js/storageNamespace.js',
  './js/idleDetector.js',
  './js/allocationModal.js',
  './js/timeDistributor.js',
  './js/parseDuration.js',
  './js/notifier.js',
  './js/formatDuration.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png'
];

/**
 * CacheStorage is shared by the whole origin, and PR previews share production's, so the
 * scope path keeps each deployment's cache apart while the version lets a new worker drop
 * the caches older deployments of the same scope left behind
 * @param {string} scope - The registration scope URL
 * @param {string} [version]
 * @returns {string}
 */
export function shellCacheName(scope, version = CACHE_VERSION) {
  return `timers:${new URL(scope).pathname}:${version}`;
}

/**
 * Whether the worker should answer a request: only same-origin GETs, so the cross-origin
 * web font stylesheet is left to the browser (offline it falls back to the system font
 * stack) and no opaque responses ever land in the cache
 * @param {Request} request
 * @param {string} origin - The worker's own origin
 * @returns {boolean}
 */
export function isAppRequest(request, origin) {
  return request.method === 'GET' && new URL(request.url).origin === origin;
}

/**
 * Fetch every url past the HTTP cache and store it; rejects if any is missing so a broken
 * deployment fails to install instead of installing half a shell
 * @param {CacheStorage} cacheStorage
 * @param {string} cacheName
 * @param {string[]} urls
 */
export async function precache(cacheStorage, cacheName, urls) {
  const cache = await cacheStorage.open(cacheName);
  await cache.addAll(urls.map(url => new Request(url, { cache: 'reload' })));
}

/**
 * Delete every cache of the same scope other than `keep`
 * @param {CacheStorage} cacheStorage
 * @param {string} keep - The current cache name from shellCacheName()
 */
export async function pruneCaches(cacheStorage, keep) {
  const scopePrefix = keep.slice(0, keep.lastIndexOf(':') + 1);
  const names = await cacheStorage.keys();
  await Promise.all(
    names
      .filter(name => name.startsWith(scopePrefix) && name !== keep)
      .map(name => cacheStorage.delete(name))
  );
}

/**
 * Answer from the network and refresh the cache; when the network is unreachable, answer
 * from the cache, and for a navigation fall back to the cached page so any url in scope
 * (the folder itself, index.html, a query string) still opens the app
 * @param {Request} request
 * @param {object} options
 * @param {CacheStorage} options.cacheStorage
 * @param {string} options.cacheName
 * @param {(request: Request) => Promise<Response>} [options.fetch]
 * @param {string} options.fallbackUrl - The cached page to serve for an offline navigation
 * @returns {Promise<Response>}
 */
export async function networkFirst(request, { cacheStorage, cacheName, fetch = r => globalThis.fetch(r), fallbackUrl }) {
  const cache = await cacheStorage.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) {
      return cached;
    }
    if (request.mode === 'navigate') {
      const fallback = await cache.match(fallbackUrl);
      if (fallback) {
        return fallback;
      }
    }
    throw error;
  }
}
