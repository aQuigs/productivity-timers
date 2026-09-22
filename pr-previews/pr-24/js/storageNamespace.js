// PR previews are published by .github/workflows/pr-preview.yml under
// <site>/pr-previews/pr-<n>/ on the same origin as the production site, so without a
// namespace every preview and production would read and write the same localStorage
const PREVIEW_PATH = /\/pr-previews\/(pr-\d+)(?:\/|$)/;

/**
 * Namespace that keeps a PR preview's stored state apart from production's
 * @param {string} [pathname] - Defaults to the current page path
 * @returns {string} The preview name (e.g. "pr-12"), or '' for production and local dev
 */
export function storageNamespace(pathname = location.pathname) {
  const match = PREVIEW_PATH.exec(pathname);
  return match ? match[1] : '';
}

/**
 * localStorage key for `key` in the current deployment. Unchanged outside previews, so
 * production data stays under the keys it has always used
 * @param {string} key
 * @param {string} [pathname] - Defaults to the current page path
 * @returns {string}
 */
export function namespacedKey(key, pathname = location.pathname) {
  const namespace = storageNamespace(pathname);
  return namespace ? `${namespace}:${key}` : key;
}
