class IdleDetector {
  constructor(options = {}) {
    this.callback = options.callback || (() => {});
    this.idleThreshold = options.idleThreshold || 10000;
    this.storageKey = 'idle_detector_hidden_at';
    this.init();
  }

  init() {
    document.addEventListener('visibilitychange', this.onVisibilityChange.bind(this));
  }

  onVisibilityChange() {
    if (document.visibilityState === 'visible') {
      const hiddenAtStr = localStorage.getItem(this.storageKey);
      if (hiddenAtStr) {
        const hiddenAt = parseInt(hiddenAtStr, 10);
        const idleDuration = Date.now() - hiddenAt;

        // ALWAYS clear the timestamp to prevent re-triggers
        localStorage.removeItem(this.storageKey);

        // Only invoke callback if idle exceeds threshold
        if (idleDuration > this.idleThreshold) {
          this.callback(idleDuration);
        }
      }
    } else if (document.visibilityState === 'hidden') {
      localStorage.setItem(this.storageKey, Date.now().toString());
    }
  }

  destroy() {
    // Cleanup method for tests
  }
}

export default IdleDetector;
