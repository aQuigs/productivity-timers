export const DEFAULT_IDLE_THRESHOLD_MS = 10000;

class IdleDetector {
  constructor(options = {}) {
    this.callback = options.callback || (() => {});
    this.idleThreshold = options.idleThreshold || DEFAULT_IDLE_THRESHOLD_MS;
    this.heartbeatInterval = options.heartbeatInterval || 1000;
    this.heartbeatTimer = null;
    this.boundHandleVisibilityChange = () => this.handleVisibilityChange();
    this.init();
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
    } else {
      this.checkIdle();
      this.startHeartbeat();
    }
  }

  /**
   * Folds the gap since the last heartbeat into the accumulated idle total
   * @returns {number} Accumulated idle milliseconds not yet allocated
   */
  checkIdle() {
    const lastHeartbeat = parseInt(localStorage.getItem('last_heartbeat') || '0', 10);
    const accumulated = parseInt(localStorage.getItem('accumulated_idle_ms') || '0', 10);

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
    localStorage.setItem('accumulated_idle_ms', total.toString());

    // Update heartbeat NOW so we don't double-count this period
    this.updateHeartbeat();

    if (total > this.idleThreshold) {
      this.callback(total);
    }

    return total;
  }

  updateHeartbeat() {
    localStorage.setItem('last_heartbeat', Date.now().toString());
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
    localStorage.removeItem('accumulated_idle_ms');
    this.updateHeartbeat();
  }

  destroy() {
    this.stopHeartbeat();
    document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
  }
}

export default IdleDetector;
