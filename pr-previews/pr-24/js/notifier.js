/**
 * Wraps the browser Notification API behind the two calls App needs, so tests can
 * inject a fake instead of depending on real permission state
 * @returns {{ requestPermission: () => void, notify: (title: string, body: string) => void }}
 */
export function createNotifier() {
  return {
    requestPermission() {
      if (typeof Notification === 'undefined' || Notification.permission !== 'default') {
        return;
      }
      // Older Safari takes a callback and returns undefined instead of a promise
      Promise.resolve(Notification.requestPermission()).catch(() => {});
    },

    notify(title, body) {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        return;
      }
      try {
        new Notification(title, { body });
      } catch (error) {
        // Some mobile browsers only allow notifications from a service worker
        console.warn('Notification could not be shown:', error);
      }
    }
  };
}

export default createNotifier;
