/**
 * Shared test helpers for simulating page visibility, window focus and idle time
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

// Synthetic blur/focus events do not move real focus, so the query is stubbed alongside them
export function setFocused(focused) {
  document.hasFocus = () => focused;
}

export function restoreFocused() {
  delete document.hasFocus;
}

export function dispatchWindowBlur() {
  window.dispatchEvent(new Event('blur'));
}

export function dispatchWindowFocus() {
  window.dispatchEvent(new Event('focus'));
}

// Backdate the IdleDetector heartbeat so the next check sees `ms` of idle time
export function heartbeatAgo(ms) {
  localStorage.setItem('last_heartbeat', String(Date.now() - ms));
}

// Run `fn` as if the page were a PR preview; the test runner's session is already
// established, so rewriting and restoring the path is invisible to it
export async function atPreviewPath(name, fn) {
  const original = location.href;
  history.replaceState(null, '', `/timers/pr-previews/${name}/${location.search}`);
  try {
    return await fn();
  } finally {
    history.replaceState(null, '', original);
  }
}
