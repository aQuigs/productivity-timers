class IdleDetector {
  constructor(options = {}) {
    this.callback = options.callback || (() => {});
    this.resumeCallback = options.resumeCallback || (() => {});
    this.onSleepDetected = options.onSleepDetected || (() => {});
    this.idleThreshold = options.idleThreshold || 10000;
    this.hiddenAtKey = 'idle_detector_hidden_at';
    this.lastProcessedKey = 'idle_detector_last_processed';
    this.accumulatedIdleKey = 'accumulated_idle_ms';
    this.lastHeartbeatKey = 'idle_detector_last_heartbeat';
    this.sleepThreshold = 5000; // 5s gap = computer slept
    this.heartbeatInterval = 1000; // Check every 1s
    this.heartbeatTimer = null;
    this.init();
  }

  init() {
    document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));

    // Start heartbeat to detect sleep/wake
    this.startHeartbeat();

    // CRITICAL: Check for pending idle period from before page load
    // If page reloaded while tab was hidden, visibilitychange already fired
    if (document.visibilityState === 'visible') {
      this.onVisibilityChange();
    }
  }

  startHeartbeat() {
    // Check for sleep that occurred before page load (e.g., page reload after sleep)
    const lastHeartbeat = parseInt(localStorage.getItem(this.lastHeartbeatKey) || '0', 10);
    const now = Date.now();

    if (lastHeartbeat > 0) {
      const gap = now - lastHeartbeat;
      if (gap > this.sleepThreshold) {
        this.onWakeFromSleep(gap);
      }
    }

    // Save initial heartbeat
    localStorage.setItem(this.lastHeartbeatKey, now.toString());

    this.heartbeatTimer = setInterval(() => {
      const lastHb = parseInt(localStorage.getItem(this.lastHeartbeatKey) || '0', 10);
      const currentTime = Date.now();
      const gap = currentTime - lastHb;

      // If gap is much larger than interval, computer slept
      if (gap > this.sleepThreshold) {
        this.onWakeFromSleep(gap);
      }

      // Update heartbeat
      localStorage.setItem(this.lastHeartbeatKey, currentTime.toString());
    }, this.heartbeatInterval);
  }

  onWakeFromSleep(sleepDuration) {
    // First, notify app to correct running timer's incorrectly accumulated time
    this.onSleepDetected(sleepDuration);

    // Accumulate sleep time as idle
    const existingAccumulated = parseInt(localStorage.getItem(this.accumulatedIdleKey) || '0', 10);
    const totalIdleAccumulated = existingAccumulated + sleepDuration;

    localStorage.setItem(this.accumulatedIdleKey, totalIdleAccumulated.toString());
    localStorage.setItem(this.lastProcessedKey, Date.now().toString());

    if (totalIdleAccumulated > this.idleThreshold) {
      this.callback(totalIdleAccumulated);
    } else {
      this.resumeCallback();
    }
  }

  onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      const hiddenAtStr = localStorage.getItem(this.hiddenAtKey);
      if (hiddenAtStr) {
        const hiddenAt = parseInt(hiddenAtStr, 10);
        const idleDuration = Date.now() - hiddenAt;

        // Update last processed time for next calculation
        localStorage.setItem(this.lastProcessedKey, Date.now().toString());
        localStorage.removeItem(this.hiddenAtKey);

        // Accumulate idle time across reloads/returns
        const existingAccumulated = parseInt(localStorage.getItem(this.accumulatedIdleKey) || '0', 10);
        const totalIdleAccumulated = existingAccumulated + idleDuration;

        // Store accumulated idle, it will be cleared when user allocates it
        localStorage.setItem(this.accumulatedIdleKey, totalIdleAccumulated.toString());

        // Invoke appropriate callback based on threshold
        if (totalIdleAccumulated > this.idleThreshold) {
          this.callback(totalIdleAccumulated);
        } else {
          // Idle was short, just resume timers
          this.resumeCallback();
        }
      } else {
        // No timestamp found, just resume
        this.resumeCallback();
      }
    } else if (document.visibilityState === 'hidden') {
      const timestamp = Date.now();
      localStorage.setItem(this.hiddenAtKey, timestamp.toString());
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
