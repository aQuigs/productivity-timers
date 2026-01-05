import { expect } from '@esm-bundle/chai';
import IdleDetector from '../js/idleDetector.js';

describe('IdleDetector', () => {
  let detector;

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    if (detector && detector.destroy) {
      detector.destroy();
    }
    localStorage.clear();
  });

  describe('Constructor and Initialization', () => {
    it('should create an IdleDetector with default options', () => {
      detector = new IdleDetector();
      expect(detector).to.be.instanceOf(IdleDetector);
    });

    it('should accept a callback function', () => {
      const callback = () => {};
      detector = new IdleDetector({ callback });
      expect(detector.callback).to.equal(callback);
    });

    it('should use default idle threshold of 10000ms', () => {
      detector = new IdleDetector();
      expect(detector.idleThreshold).to.equal(10000);
    });

    it('should accept custom idle threshold', () => {
      detector = new IdleDetector({ idleThreshold: 5000 });
      expect(detector.idleThreshold).to.equal(5000);
    });
  });

  describe('Idle Duration Threshold', () => {
    it('should NOT call callback when idle duration is <= 10s', () => {
      let callbackCalled = false;
      const callback = () => { callbackCalled = true; };

      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      const now = 100000;
      const hiddenTime = now - 5000;
      localStorage.setItem('idle_detector_hidden_at', hiddenTime.toString());

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.onVisibilityChange();
        expect(callbackCalled).to.be.false;
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should NOT call callback when idle duration is exactly 10s', () => {
      let callbackCalled = false;
      const callback = () => { callbackCalled = true; };

      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      const now = 100000;
      const hiddenTime = now - 10000;
      localStorage.setItem('idle_detector_hidden_at', hiddenTime.toString());

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.onVisibilityChange();
        expect(callbackCalled).to.be.false;
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should call callback when idle duration is > 10s', () => {
      let callbackCalled = false;
      const callback = () => { callbackCalled = true; };

      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      const now = 100000;
      const hiddenTime = now - 11000;
      localStorage.setItem('idle_detector_hidden_at', hiddenTime.toString());

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.onVisibilityChange();
        expect(callbackCalled).to.be.true;
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should pass correct idle duration to callback', () => {
      let receivedDuration = null;
      const callback = (duration) => { receivedDuration = duration; };

      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      const now = 100000;
      const expectedIdleDuration = 15000;
      const hiddenTime = now - expectedIdleDuration;
      localStorage.setItem('idle_detector_hidden_at', hiddenTime.toString());

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.onVisibilityChange();
        expect(receivedDuration).to.not.be.null;
        expect(receivedDuration).to.equal(expectedIdleDuration);
      } finally {
        Date.now = originalDateNow;
      }
    });
  });

  describe('localStorage Persistence', () => {
    it('should save hiddenTimestamp to localStorage when document becomes hidden', () => {
      detector = new IdleDetector();

      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() { return 'hidden'; }
      });

      const beforeCall = Date.now();
      detector.onVisibilityChange();
      const afterCall = Date.now();

      const savedTimestamp = parseInt(localStorage.getItem('idle_detector_hidden_at'), 10);
      expect(savedTimestamp).to.be.at.least(beforeCall);
      expect(savedTimestamp).to.be.at.most(afterCall);
    });

    it('should calculate idle duration from localStorage timestamp across page reload', () => {
      let receivedDuration = null;
      const callback = (duration) => { receivedDuration = duration; };

      const now = 100000;
      const hiddenTime = now - 12000;
      localStorage.setItem('idle_detector_hidden_at', hiddenTime.toString());

      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      // Mock visibilityState to 'visible' for the test
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() { return 'visible'; }
      });

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.onVisibilityChange();
        expect(receivedDuration).to.not.be.null;
        expect(receivedDuration).to.equal(12000);
      } finally {
        Date.now = originalDateNow;
      }
    });
  });

  describe('Timestamp Cleanup', () => {
    it('should clear hiddenTimestamp from localStorage after callback emission', () => {
      const callback = () => {};
      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      const now = 100000;
      const hiddenTime = now - 11000;
      localStorage.setItem('idle_detector_hidden_at', hiddenTime.toString());

      // Mock visibilityState to 'visible' for the test
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() { return 'visible'; }
      });

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.onVisibilityChange();
        const timestamp = localStorage.getItem('idle_detector_hidden_at');
        expect(timestamp).to.be.null;
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should clear hiddenTimestamp even if callback was not emitted (idle <= threshold)', () => {
      const callback = () => {};
      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      const now = 100000;
      const hiddenTime = now - 5000; // Only 5s idle, below threshold
      localStorage.setItem('idle_detector_hidden_at', hiddenTime.toString());

      // Mock visibilityState to 'visible' for the test
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() { return 'visible'; }
      });

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.onVisibilityChange();
        const timestamp = localStorage.getItem('idle_detector_hidden_at');
        // SHOULD be null - we always clear to prevent re-triggers
        expect(timestamp).to.be.null;
      } finally {
        Date.now = originalDateNow;
      }
    });
  });
});
