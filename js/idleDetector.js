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
    // Implementation will be added in next TDD cycles
  }

  destroy() {
    // Cleanup method for tests
  }
}

export default IdleDetector;
