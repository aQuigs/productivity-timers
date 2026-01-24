class IdleDetector {
  constructor(options = {}) {
    this.callback = options.callback || (() => {});
    this.resumeCallback = options.resumeCallback || (() => {});
    this.idleThreshold = options.idleThreshold || 10000;
    this.storageKey = 'idle_detector_hidden_at';
    this.init();
  }

  init() {
    document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
  }

  onVisibilityChange() {
    console.log('IdleDetector.onVisibilityChange, state:', document.visibilityState);
    if (document.visibilityState === 'visible') {
      const hiddenAtStr = localStorage.getItem(this.storageKey);
      console.log('hiddenAtStr:', hiddenAtStr);
      if (hiddenAtStr) {
        const hiddenAt = parseInt(hiddenAtStr, 10);
        const idleDuration = Date.now() - hiddenAt;
        console.log('Idle duration:', idleDuration, 'threshold:', this.idleThreshold);

        // ALWAYS clear the timestamp to prevent re-triggers
        localStorage.removeItem(this.storageKey);

        // Invoke appropriate callback based on threshold
        if (idleDuration > this.idleThreshold) {
          console.log('Calling callback (idle > threshold)');
          this.callback(idleDuration);
        } else {
          // Idle was short, just resume timers
          console.log('Calling resumeCallback (idle <= threshold)');
          this.resumeCallback();
        }
      } else {
        // No timestamp found, just resume (first load or something)
        console.log('No timestamp found, calling resumeCallback');
        this.resumeCallback();
      }
    } else if (document.visibilityState === 'hidden') {
      const timestamp = Date.now();
      console.log('Setting hiddenAt timestamp:', timestamp);
      localStorage.setItem(this.storageKey, timestamp.toString());
    }
  }

  destroy() {
    // Cleanup method for tests
  }
}

export default IdleDetector;
