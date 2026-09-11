/**
 * Registers the service worker that makes the app installable and usable offline. The
 * script path is relative so each deployment (production, a PR preview) registers its own
 * worker scoped to its own folder. Failure only costs offline support, never the app
 * @param {ServiceWorkerContainer|undefined} container - navigator.serviceWorker, absent in
 *   browsers without support or outside a secure context
 * @param {string} [scriptUrl]
 * @returns {Promise<ServiceWorkerRegistration|null>}
 */
export function registerServiceWorker(container, scriptUrl = './sw.js') {
  if (!container) {
    return Promise.resolve(null);
  }
  return container.register(scriptUrl, { type: 'module' }).catch(error => {
    console.warn('Service worker registration failed:', error);
    return null;
  });
}

export default registerServiceWorker;
