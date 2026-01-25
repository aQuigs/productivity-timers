class IdleDetector {
  constructor(options = {}) {
    this.callback = options.callback || (() => {});
    this.idleThreshold = options.idleThreshold || 10000;
    this.heartbeatInterval = 1000;
    this.heartbeatTimer = null;
    this.init();
  }

  init() {
    // Check for idle on load
    this.checkIdle();

    // Start heartbeat
    this.startHeartbeat();

    // Check on visibility change
    document.addEventListener('visibilitychange', () => this.checkIdle());
  }

  checkIdle() {
    const lastHeartbeat = parseInt(localStorage.getItem('last_heartbeat') || '0', 10);
    if (lastHeartbeat === 0) {
      this.updateHeartbeat();
      return;
    }

    const now = Date.now();
    const idle = now - lastHeartbeat;

    // Only count significant idle (> 1 second)
    if (idle < 1000) {
      this.updateHeartbeat();
      return;
    }

    // Add to accumulated
    const accumulated = parseInt(localStorage.getItem('accumulated_idle_ms') || '0', 10);
    const total = accumulated + idle;
    localStorage.setItem('accumulated_idle_ms', total.toString());

    // Update heartbeat NOW so we don't double-count this period
    this.updateHeartbeat();

    // Only call callback if over threshold
    if (total > this.idleThreshold) {
      this.callback(total);
    }
  }

  updateHeartbeat() {
    localStorage.setItem('last_heartbeat', Date.now().toString());
  }

  startHeartbeat() {
    this.heartbeatTimer = setInterval(() => {
      this.updateHeartbeat();
    }, this.heartbeatInterval);
  }

  clearAccumulatedIdle() {
    localStorage.removeItem('accumulated_idle_ms');
    this.updateHeartbeat();
  }

  destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export default IdleDetector;
