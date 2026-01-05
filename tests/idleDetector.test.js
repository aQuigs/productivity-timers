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
    it('should NOT call callback when idle duration is <= 10s', (done) => {
      let callbackCalled = false;
      const callback = () => { callbackCalled = true; };

      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      const hiddenTime = Date.now();
      localStorage.setItem('idle_detector_hidden_at', hiddenTime.toString());

      setTimeout(() => {
        detector.onVisibilityChange();
        expect(callbackCalled).to.be.false;
        done();
      }, 100);
    });

    it('should NOT call callback when idle duration is exactly 10s', () => {
      let callbackCalled = false;
      const callback = () => { callbackCalled = true; };

      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      const hiddenTime = Date.now() - 10000;
      localStorage.setItem('idle_detector_hidden_at', hiddenTime.toString());

      detector.onVisibilityChange();
      expect(callbackCalled).to.be.false;
    });

    it('should call callback when idle duration is > 10s', (done) => {
      let callbackCalled = false;
      const callback = () => { callbackCalled = true; };

      detector = new IdleDetector({ callback, idleThreshold: 10000 });

      const hiddenTime = Date.now() - 11000;
      localStorage.setItem('idle_detector_hidden_at', hiddenTime.toString());

      setTimeout(() => {
        detector.onVisibilityChange();
        expect(callbackCalled).to.be.true;
        done();
      }, 10);
    });
  });
});
