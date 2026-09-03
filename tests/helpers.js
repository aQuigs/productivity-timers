/**
 * Shared test helpers for simulating page visibility
 */

export function setHidden(hidden) {
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get() { return hidden; }
  });
}

export function restoreHidden() {
  delete document.hidden;
}

export function dispatchVisibilityChange() {
  document.dispatchEvent(new Event('visibilitychange'));
}
