import { namespacedKey } from './storageNamespace.js';

export const DEFAULT_IDLE_THRESHOLD_MS = 10000;

const ACCUMULATED_IDLE_KEY = 'accumulated_idle_ms';
const LAST_HEARTBEAT_KEY = 'last_heartbeat';

const noop = () => {};

function readIdleMs(key) {
  return parseInt(localStorage.getItem(key) || '0', 10);
}

/**
 * IdleDetector - Measures time the page was not being watched (tab hidden, window
 * unfocused, closed, or the machine asleep) using a heartbeat timestamp in localStorage
 */
class IdleDetector {
  /**
   * @param {Object} [options]
   * @param {Function} [options.callback] - Called with the total when it exceeds the threshold
   * @param {Function} [options.onInactive] - Called when the page stops being watched
   * @param {Function} [options.onActive] - Called with the accumulated total on every return
   * @param {number} [options.idleThreshold]
   * @param {number} [options.heartbeatInterval]
   */
  constructor(options = {}) {
    this.callback = options.callback || noop;
    this.onInactive = options.onInactive || noop;
    this.onActive = options.onActive || noop;
    this.idleThreshold = options.idleThreshold || DEFAULT_IDLE_THRESHOLD_MS;
    this.heartbeatInterval = options.heartbeatInterval || 1000;
    this.heartbeatTimer = null;
    this.accumulatedIdleKey = namespacedKey(ACCUMULATED_IDLE_KEY);
    this.lastHeartbeatKey = namespacedKey(LAST_HEARTBEAT_KEY);
    this.active = false;
    this.boundHandleActivityChange = () => this.handleActivityChange();
    this.init();
  }

  /**
   * Idle milliseconds accumulated so far and not yet allocated or discarded
   * @returns {number}
   */
  static readAccumulatedIdleMs() {
    return readIdleMs(namespacedKey(ACCUMULATED_IDLE_KEY));
  }

  /**
   * Whether the page is being watched: visible, and its window is the focused one
   * @returns {boolean}
   */
  isActive() {
    return !document.hidden && document.hasFocus();
  }

  init() {
    // Catch idle time that elapsed before this page load (tab closed, crash, sleep)
    this.checkIdle();

    this.active = this.isActive();
    if (this.active) {
      this.startHeartbeat();
    }

    document.addEventListener('visibilitychange', this.boundHandleActivityChange);
    // Switching to another app leaves the tab visible but takes focus from its window
    window.addEventListener('blur', this.boundHandleActivityChange);
    window.addEventListener('focus', this.boundHandleActivityChange);
  }

  handleActivityChange() {
    const active = this.isActive();
    // A tab switch fires both blur and visibilitychange; only the first may transition
    if (active === this.active) {
      return;
    }
    this.active = active;

    if (!active) {
      // Freeze the heartbeat so the next check measures the whole inactive period
      // instead of the time since a background-throttled tick
      this.updateHeartbeat();
      this.stopHeartbeat();
      this.onInactive();
    } else {
      const total = this.checkIdle();
      this.startHeartbeat();
      this.onActive(total);
    }
  }

  /**
   * Folds the gap since the last heartbeat into the accumulated idle total
   * @returns {number} Accumulated idle milliseconds not yet allocated
   */
  checkIdle() {
    const lastHeartbeat = parseInt(localStorage.getItem(this.lastHeartbeatKey) || '0', 10);
    const accumulated = readIdleMs(this.accumulatedIdleKey);

    if (lastHeartbeat === 0) {
      this.updateHeartbeat();
      return accumulated;
    }

    const now = Date.now();
    const idle = now - lastHeartbeat;

    // Only count significant idle (> 1 second)
    if (idle < 1000) {
      this.updateHeartbeat();
      return accumulated;
    }

    const total = accumulated + idle;
    localStorage.setItem(this.accumulatedIdleKey, total.toString());

    // Update heartbeat NOW so we don't double-count this period
    this.updateHeartbeat();

    if (total > this.idleThreshold) {
      this.callback(total);
    }

    return total;
  }

  updateHeartbeat() {
    localStorage.setItem(this.lastHeartbeatKey, Date.now().toString());
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.updateHeartbeat();
    }, this.heartbeatInterval);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  clearAccumulatedIdle() {
    localStorage.removeItem(this.accumulatedIdleKey);
    this.updateHeartbeat();
  }

  destroy() {
    this.stopHeartbeat();
    document.removeEventListener('visibilitychange', this.boundHandleActivityChange);
    window.removeEventListener('blur', this.boundHandleActivityChange);
    window.removeEventListener('focus', this.boundHandleActivityChange);
  }
}

export default IdleDetector;
