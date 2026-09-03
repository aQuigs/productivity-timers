export const DEFAULT_IDLE_THRESHOLD_MS = 10000;
export const ACCUMULATED_IDLE_KEY = 'accumulated_idle_ms';

const LAST_HEARTBEAT_KEY = 'last_heartbeat';

const noop = () => {};

/**
 * IdleDetector - Measures time the page was not being watched (tab hidden, closed,
 * or the machine asleep) using a heartbeat timestamp in localStorage
 */
class IdleDetector {
  /**
   * @param {Object} [options]
   * @param {Function} [options.callback] - Called with the total when it exceeds the threshold
   * @param {Function} [options.onHidden] - Called when the document becomes hidden
   * @param {Function} [options.onVisible] - Called with the accumulated total on every return
   * @param {number} [options.idleThreshold]
   * @param {number} [options.heartbeatInterval]
   */
  constructor(options = {}) {
    this.callback = options.callback || noop;
    this.onHidden = options.onHidden || noop;
    this.onVisible = options.onVisible || noop;
    this.idleThreshold = options.idleThreshold || DEFAULT_IDLE_THRESHOLD_MS;
    this.heartbeatInterval = options.heartbeatInterval || 1000;
    this.heartbeatTimer = null;
    this.boundHandleVisibilityChange = () => this.handleVisibilityChange();
    this.init();
  }

  /**
   * Idle milliseconds accumulated so far and not yet allocated or discarded
   * @returns {number}
   */
  static readAccumulatedIdleMs() {
    return parseInt(localStorage.getItem(ACCUMULATED_IDLE_KEY) || '0', 10);
  }

  init() {
    // Catch idle time that elapsed before this page load (tab closed, crash, sleep)
    this.checkIdle();

    if (!document.hidden) {
      this.startHeartbeat();
    }

    document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
  }

  handleVisibilityChange() {
    if (document.hidden) {
      // Freeze the heartbeat so the next check measures the whole hidden period
      // instead of the time since a background-throttled tick
      this.updateHeartbeat();
      this.stopHeartbeat();
      this.onHidden();
    } else {
      const total = this.checkIdle();
      this.startHeartbeat();
      this.onVisible(total);
    }
  }

  /**
   * Folds the gap since the last heartbeat into the accumulated idle total
   * @returns {number} Accumulated idle milliseconds not yet allocated
   */
  checkIdle() {
    const lastHeartbeat = parseInt(localStorage.getItem(LAST_HEARTBEAT_KEY) || '0', 10);
    const accumulated = IdleDetector.readAccumulatedIdleMs();

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
    localStorage.setItem(ACCUMULATED_IDLE_KEY, total.toString());

    // Update heartbeat NOW so we don't double-count this period
    this.updateHeartbeat();

    if (total > this.idleThreshold) {
      this.callback(total);
    }

    return total;
  }

  updateHeartbeat() {
    localStorage.setItem(LAST_HEARTBEAT_KEY, Date.now().toString());
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
    localStorage.removeItem(ACCUMULATED_IDLE_KEY);
    this.updateHeartbeat();
  }

  destroy() {
    this.stopHeartbeat();
    document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
  }
}

export default IdleDetector;
