class IdleDetector {
  constructor(options = {}) {
    this.callback = options.callback || (() => {});
    this.resumeCallback = options.resumeCallback || (() => {});
    this.onSleepDetected = options.onSleepDetected || (() => {});
    this.idleThreshold = options.idleThreshold || 10000;
    this.lastActiveKey = 'idle_detector_last_active';
    this.accumulatedIdleKey = 'accumulated_idle_ms';
    this.sleepThreshold = 5000;
    this.heartbeatInterval = 1000;
    this.heartbeatTimer = null;
    this.modalPending = false;
    this.init();
  }

  init() {
    document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));

    // Start heartbeat to detect sleep/wake
    this.startHeartbeat();

    // Check for pending accumulated idle on load
    this.checkPendingIdle();
  }

  checkPendingIdle() {
    const accumulatedIdle = parseInt(localStorage.getItem(this.accumulatedIdleKey) || '0', 10);

    if (accumulatedIdle > 0) {
      this.modalPending = true;
      if (accumulatedIdle > this.idleThreshold) {
        this.callback(accumulatedIdle);
      } else {
        this.resumeCallback();
        localStorage.removeItem(this.accumulatedIdleKey);
        this.modalPending = false;
      }
    } else {
      // Check if there's idle time since last active
      const lastActive = parseInt(localStorage.getItem(this.lastActiveKey) || '0', 10);
      if (lastActive > 0 && document.visibilityState === 'visible') {
        const idleDuration = Date.now() - lastActive;
        if (idleDuration > 1000) {
          this.handleIdleDetected(idleDuration, false);
          return;
        }
      }
      // No pending idle, set last active to now
      this.updateLastActive();
    }
  }

  updateLastActive() {
    localStorage.setItem(this.lastActiveKey, Date.now().toString());
  }

  startHeartbeat() {
    let lastHeartbeat = Date.now();

    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      const gap = now - lastHeartbeat;

      // If gap is much larger than interval, computer slept
      if (gap > this.sleepThreshold && !this.modalPending) {
        this.handleIdleDetected(gap, true);
      }

      lastHeartbeat = now;
    }, this.heartbeatInterval);
  }

  handleIdleDetected(idleDuration, isSleep = false) {
    if (this.modalPending) {
      return; // Don't re-trigger if modal already pending
    }

    if (isSleep) {
      this.onSleepDetected(idleDuration);
    }

    const existingAccumulated = parseInt(localStorage.getItem(this.accumulatedIdleKey) || '0', 10);
    const totalIdle = existingAccumulated + idleDuration;

    localStorage.setItem(this.accumulatedIdleKey, totalIdle.toString());
    this.modalPending = true;

    // Clear last_active to prevent re-triggering until user allocates
    localStorage.removeItem(this.lastActiveKey);

    if (totalIdle > this.idleThreshold) {
      this.callback(totalIdle);
    } else {
      this.resumeCallback();
      localStorage.removeItem(this.accumulatedIdleKey);
      this.modalPending = false;
      this.updateLastActive();
    }
  }

  clearAccumulatedIdle() {
    localStorage.removeItem(this.accumulatedIdleKey);
    this.modalPending = false;
    this.updateLastActive();
  }

  onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      if (this.modalPending) {
        return; // Modal already showing, don't recalculate
      }

      const lastActive = parseInt(localStorage.getItem(this.lastActiveKey) || '0', 10);
      if (lastActive > 0) {
        const now = Date.now();
        const idleDuration = now - lastActive;

        if (idleDuration > 1000) {
          this.handleIdleDetected(idleDuration, false);
        } else {
          this.updateLastActive();
        }
      } else {
        this.updateLastActive();
      }
    } else if (document.visibilityState === 'hidden') {
      // Tab becoming hidden - record the time we became inactive
      this.updateLastActive();
    }
  }

  destroy() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    document.removeEventListener('visibilitychange', this.onVisibilityChange.bind(this));
  }
}

export default IdleDetector;
