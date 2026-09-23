import { expect } from '@esm-bundle/chai';
import IdleDetector from '../js/idleDetector.js';
import {
  setHidden,
  restoreHidden,
  dispatchVisibilityChange,
  setFocused,
  restoreFocused,
  dispatchWindowBlur,
  dispatchWindowFocus,
  heartbeatAgo,
  atPreviewPath
} from './helpers.js';

describe('IdleDetector', () => {
  let detector;

  // Pin the clock so the measured gap is exact rather than "at least"
  function atFrozenTime(now, fn) {
    const originalDateNow = Date.now;
    Date.now = () => now;
    try {
      return fn();
    } finally {
      Date.now = originalDateNow;
    }
  }

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    if (detector && detector.destroy) {
      detector.destroy();
    }
    localStorage.clear();
  });

  describe('Idle Duration Threshold', () => {
    it('should not call the callback when the idle duration is at or under the threshold', () => {
      let callbackCalled = false;
      detector = new IdleDetector({ callback: () => { callbackCalled = true; }, idleThreshold: 10000 });

      const now = 100000;
      localStorage.setItem('last_heartbeat', String(now - 10000));

      atFrozenTime(now, () => detector.checkIdle());

      expect(callbackCalled).to.be.false;
    });

    it('should call the callback with the idle duration once it exceeds the threshold', () => {
      let receivedDuration = null;
      detector = new IdleDetector({ callback: (duration) => { receivedDuration = duration; }, idleThreshold: 10000 });

      const now = 100000;
      localStorage.setItem('last_heartbeat', String(now - 15000));

      atFrozenTime(now, () => detector.checkIdle());

      expect(receivedDuration).to.equal(15000);
    });

    it('should measure idle time left by a previous page load on construction', () => {
      let receivedDuration = null;
      const now = 100000;
      localStorage.setItem('last_heartbeat', String(now - 12000));

      atFrozenTime(now, () => {
        detector = new IdleDetector({ callback: (duration) => { receivedDuration = duration; }, idleThreshold: 10000 });
      });

      expect(receivedDuration).to.equal(12000);
    });
  });

  describe('Heartbeat and Visibility', () => {
    afterEach(() => {
      restoreHidden();
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
      heartbeatAgo(15000);

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

    it('should call onInactive when the document becomes hidden', () => {
      let calls = 0;
      detector = new IdleDetector({ onInactive: () => { calls++; } });

      setHidden(true);
      dispatchVisibilityChange();

      expect(calls).to.equal(1);
    });

    it('should call onActive with the accumulated idle total when the document becomes visible', () => {
      let received = null;
      detector = new IdleDetector({ onActive: (total) => { received = total; } });

      setHidden(true);
      dispatchVisibilityChange();
      heartbeatAgo(5000);
      setHidden(false);
      dispatchVisibilityChange();

      expect(received).to.be.at.least(5000);
    });

    it('should call onActive with zero when no idle time accumulated', () => {
      let received = null;
      detector = new IdleDetector({ onActive: (total) => { received = total; } });

      setHidden(true);
      dispatchVisibilityChange();
      setHidden(false);
      dispatchVisibilityChange();

      expect(received).to.equal(0);
    });

    it('should stop listening for visibility changes after destroy()', () => {
      let calls = 0;
      detector = new IdleDetector({ callback: () => { calls++; }, idleThreshold: 10000 });
      detector.destroy();

      heartbeatAgo(15000);
      setHidden(false);
      dispatchVisibilityChange();

      expect(calls).to.equal(0);
    });

    it('should return the accumulated idle total from checkIdle()', () => {
      detector = new IdleDetector({ idleThreshold: 10000 });

      heartbeatAgo(5000);
      const total = detector.checkIdle();

      expect(total).to.be.at.least(5000);
      expect(detector.checkIdle()).to.equal(total);
    });
  });

  describe('Window focus', () => {
    afterEach(() => {
      restoreHidden();
      restoreFocused();
    });

    function blurWindow() {
      setFocused(false);
      dispatchWindowBlur();
    }

    function focusWindow() {
      setFocused(true);
      dispatchWindowFocus();
    }

    it('should be active only while the document is visible and its window focused', () => {
      detector = new IdleDetector();
      expect(detector.isActive()).to.be.true;

      setFocused(false);
      expect(detector.isActive()).to.be.false;

      setFocused(true);
      setHidden(true);
      expect(detector.isActive()).to.be.false;
    });

    it('should call onInactive and freeze the heartbeat when the window loses focus', (done) => {
      let calls = 0;
      detector = new IdleDetector({ onInactive: () => { calls++; }, heartbeatInterval: 20 });

      blurWindow();
      const stampedAtBlur = localStorage.getItem('last_heartbeat');
      expect(calls).to.equal(1);

      setTimeout(() => {
        expect(localStorage.getItem('last_heartbeat')).to.equal(stampedAtBlur);
        done();
      }, 100);
    });

    it('should accumulate the unfocused duration and fire the callback when focus returns', () => {
      let received = null;
      let callbackMs = null;
      detector = new IdleDetector({
        callback: (ms) => { callbackMs = ms; },
        onActive: (total) => { received = total; },
        idleThreshold: 10000
      });

      blurWindow();
      heartbeatAgo(15000);
      focusWindow();

      expect(received).to.be.at.least(15000);
      expect(callbackMs).to.be.at.least(15000);
    });

    it('should restart the heartbeat when focus returns', (done) => {
      detector = new IdleDetector({ heartbeatInterval: 20 });

      blurWindow();
      focusWindow();
      const stampedAtFocus = Number(localStorage.getItem('last_heartbeat'));

      setTimeout(() => {
        expect(Number(localStorage.getItem('last_heartbeat'))).to.be.greaterThan(stampedAtFocus);
        done();
      }, 100);
    });

    it('should treat a tab switch, which blurs the window and hides the document, as one idle period', () => {
      let inactiveCalls = 0;
      let activeCalls = 0;
      detector = new IdleDetector({
        onInactive: () => { inactiveCalls++; },
        onActive: () => { activeCalls++; }
      });

      blurWindow();
      setHidden(true);
      dispatchVisibilityChange();
      expect(inactiveCalls).to.equal(1);

      setHidden(false);
      dispatchVisibilityChange();
      focusWindow();
      expect(activeCalls).to.equal(1);
    });

    it('should stay idle while the document is visible in an unfocused window', (done) => {
      let activeCalls = 0;
      detector = new IdleDetector({ onActive: () => { activeCalls++; }, heartbeatInterval: 20 });

      blurWindow();
      setHidden(true);
      dispatchVisibilityChange();
      setHidden(false);
      dispatchVisibilityChange();
      const stampedAtShow = localStorage.getItem('last_heartbeat');

      expect(activeCalls).to.equal(0);
      setTimeout(() => {
        expect(localStorage.getItem('last_heartbeat')).to.equal(stampedAtShow);
        done();
      }, 100);
    });

    it('should not re-measure idle time on a focus event while already active', () => {
      let calls = 0;
      detector = new IdleDetector({ callback: () => { calls++; }, idleThreshold: 10000 });

      heartbeatAgo(15000);
      focusWindow();

      expect(calls).to.equal(0);
    });

    it('should not run the heartbeat when constructed in an unfocused window', (done) => {
      setFocused(false);
      detector = new IdleDetector({ heartbeatInterval: 20 });
      const stampedAtInit = localStorage.getItem('last_heartbeat');

      expect(detector.isActive()).to.be.false;
      setTimeout(() => {
        expect(localStorage.getItem('last_heartbeat')).to.equal(stampedAtInit);
        done();
      }, 100);
    });

    it('should stop listening for focus changes after destroy()', () => {
      let inactiveCalls = 0;
      detector = new IdleDetector({ onInactive: () => { inactiveCalls++; } });
      detector.destroy();

      blurWindow();

      expect(inactiveCalls).to.equal(0);
    });
  });

  describe('PR Preview Isolation', () => {
    it('should stamp the heartbeat under a per-PR key inside a preview', async () => {
      await atPreviewPath('pr-12', () => {
        detector = new IdleDetector();
      });

      expect(localStorage.getItem('pr-12:last_heartbeat')).to.not.be.null;
      expect(localStorage.getItem('last_heartbeat')).to.be.null;
    });

    it('should ignore the production heartbeat and idle total inside a preview', async () => {
      localStorage.setItem('last_heartbeat', String(Date.now() - 60000));
      localStorage.setItem('accumulated_idle_ms', '60000');
      let received = null;

      await atPreviewPath('pr-12', () => {
        detector = new IdleDetector({ callback: (ms) => { received = ms; } });
        expect(IdleDetector.readAccumulatedIdleMs()).to.equal(0);
      });

      expect(received).to.be.null;
      expect(localStorage.getItem('accumulated_idle_ms')).to.equal('60000');
    });

    it('should accumulate idle time under the per-PR key', async () => {
      localStorage.setItem('pr-12:last_heartbeat', String(Date.now() - 60000));
      let received = null;

      await atPreviewPath('pr-12', () => {
        detector = new IdleDetector({ callback: (ms) => { received = ms; } });
        expect(IdleDetector.readAccumulatedIdleMs()).to.be.at.least(60000);
      });

      expect(received).to.be.at.least(60000);
      expect(parseInt(localStorage.getItem('pr-12:accumulated_idle_ms'), 10)).to.be.at.least(60000);
      expect(localStorage.getItem('accumulated_idle_ms')).to.be.null;
    });

    it('should keep the keys it was created with for its whole lifetime', async () => {
      await atPreviewPath('pr-12', () => {
        detector = new IdleDetector();
      });
      localStorage.clear();

      detector.updateHeartbeat();
      detector.clearAccumulatedIdle();

      expect(localStorage.getItem('pr-12:last_heartbeat')).to.not.be.null;
      expect(localStorage.getItem('last_heartbeat')).to.be.null;
    });
  });
});
