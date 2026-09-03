/**
 * Shared test helpers for simulating page visibility and idle time
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

// Backdate the IdleDetector heartbeat so the next check sees `ms` of idle time
export function heartbeatAgo(ms) {
  localStorage.setItem('last_heartbeat', String(Date.now() - ms));
}
