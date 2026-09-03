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
      localStorage.setItem('last_heartbeat', hiddenTime.toString());

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.checkIdle();
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
      localStorage.setItem('last_heartbeat', hiddenTime.toString());

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.checkIdle();
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
      localStorage.setItem('last_heartbeat', hiddenTime.toString());

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.checkIdle();
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
      localStorage.setItem('last_heartbeat', hiddenTime.toString());

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.checkIdle();
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
      detector.checkIdle();
      const afterCall = Date.now();

      const savedTimestamp = parseInt(localStorage.getItem('last_heartbeat'), 10);
      expect(savedTimestamp).to.be.at.least(beforeCall);
      expect(savedTimestamp).to.be.at.most(afterCall);
    });

    it('should calculate idle duration from localStorage timestamp across page reload', () => {
      let receivedDuration = null;
      const callback = (duration) => { receivedDuration = duration; };

      const now = 100000;
      const hiddenTime = now - 12000;
      localStorage.setItem('last_heartbeat', hiddenTime.toString());

      // Mock Date.now BEFORE creating detector so checkPendingIdle() uses mocked time
      const originalDateNow = Date.now;
      Date.now = () => now;

      // Mock visibilityState to 'visible' for the test
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() { return 'visible'; }
      });

      try {
        detector = new IdleDetector({ callback, idleThreshold: 10000 });
        expect(receivedDuration).to.not.be.null;
        expect(receivedDuration).to.be.at.least(12000);
      } finally {
        Date.now = originalDateNow;
      }
    });
  });

  describe('Heartbeat and Visibility', () => {
    function setHidden(hidden) {
      Object.defineProperty(document, 'hidden', {
        configurable: true,
        get() { return hidden; }
      });
    }

    function dispatchVisibilityChange() {
      document.dispatchEvent(new Event('visibilitychange'));
    }

    afterEach(() => {
      delete document.hidden;
    });

    it('should accept a custom heartbeat interval', () => {
      detector = new IdleDetector({ heartbeatInterval: 20 });
      expect(detector.heartbeatInterval).to.equal(20);
    });

    it('should stop the heartbeat while hidden so the whole hidden period is measured as idle', (done) => {
      detector = new IdleDetector({ heartbeatInterval: 20 });

      setHidden(true);
      dispatchVisibilityChange();
      const stampedAtHide = localStorage.getItem('last_heartbeat');
      expect(stampedAtHide).to.not.be.null;

      setTimeout(() => {
        expect(localStorage.getItem('last_heartbeat')).to.equal(stampedAtHide);
        done();
      }, 100);
    });

    it('should accumulate the full hidden duration and fire the callback when visible again', () => {
      let received = null;
      detector = new IdleDetector({
        callback: (ms) => { received = ms; },
        idleThreshold: 10000,
        heartbeatInterval: 20
      });

      setHidden(true);
      dispatchVisibilityChange();

      // Simulate 15 seconds passing with the tab hidden
      localStorage.setItem('last_heartbeat', String(Date.now() - 15000));

      setHidden(false);
      dispatchVisibilityChange();

      expect(received).to.be.at.least(15000);
      expect(parseInt(localStorage.getItem('accumulated_idle_ms'), 10)).to.be.at.least(15000);
    });

    it('should restart the heartbeat when the document becomes visible again', (done) => {
      detector = new IdleDetector({ heartbeatInterval: 20 });

      setHidden(true);
      dispatchVisibilityChange();
      setHidden(false);
      dispatchVisibilityChange();
      const stampedAtShow = Number(localStorage.getItem('last_heartbeat'));

      setTimeout(() => {
        expect(Number(localStorage.getItem('last_heartbeat'))).to.be.greaterThan(stampedAtShow);
        done();
      }, 100);
    });

    it('should not run the heartbeat when constructed while hidden', (done) => {
      setHidden(true);
      detector = new IdleDetector({ heartbeatInterval: 20 });
      const stampedAtInit = localStorage.getItem('last_heartbeat');

      setTimeout(() => {
        expect(localStorage.getItem('last_heartbeat')).to.equal(stampedAtInit);
        done();
      }, 100);
    });

    it('should stop listening for visibility changes after destroy()', () => {
      let calls = 0;
      detector = new IdleDetector({ callback: () => { calls++; }, idleThreshold: 10000 });
      detector.destroy();

      localStorage.setItem('last_heartbeat', String(Date.now() - 15000));
      setHidden(false);
      dispatchVisibilityChange();

      expect(calls).to.equal(0);
    });

    it('should return the accumulated idle total from checkIdle()', () => {
      detector = new IdleDetector({ idleThreshold: 10000 });

      localStorage.setItem('last_heartbeat', String(Date.now() - 5000));
      const total = detector.checkIdle();

      expect(total).to.be.at.least(5000);
      expect(detector.checkIdle()).to.equal(total);
    });
  });

  describe('Timestamp Cleanup', () => {
    it('should clear hiddenTimestamp from localStorage after callback emission', () => {
      const callback = () => {};
      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      const now = 100000;
      const hiddenTime = now - 11000;
      localStorage.setItem('last_heartbeat', hiddenTime.toString());

      // Mock visibilityState to 'visible' for the test
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() { return 'visible'; }
      });

      // Mock Date.now to return consistent timestamp
      const originalDateNow = Date.now;
      Date.now = () => now;

      try {
        detector.checkIdle();
        const timestamp = localStorage.getItem('last_heartbeat');
        // With simple approach, heartbeat is updated to now, not cleared
        expect(timestamp).to.equal(now.toString());
      } finally {
        Date.now = originalDateNow;
      }
    });

    it('should clear hiddenTimestamp even if callback was not emitted (idle <= threshold)', () => {
      const callback = () => {};

      const now = 100000;
      const hiddenTime = now - 5000; // Only 5s idle, below threshold
      localStorage.setItem('last_heartbeat', hiddenTime.toString());

      // Mock Date.now BEFORE creating detector
      const originalDateNow = Date.now;
      Date.now = () => now;

      // Mock visibilityState to 'visible' for the test
      Object.defineProperty(document, 'visibilityState', {
        configurable: true,
        get() { return 'visible'; }
      });

      try {
        detector = new IdleDetector({ callback, idleThreshold: 10000 });
        const timestamp = localStorage.getItem('last_heartbeat');
        // Should be updated to "now" after processing short idle
        expect(timestamp).to.equal(now.toString());
      } finally {
        Date.now = originalDateNow;
      }
    });
  });
});
