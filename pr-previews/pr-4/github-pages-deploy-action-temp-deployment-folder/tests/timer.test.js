import { expect } from '@esm-bundle/chai';
import { Timer } from '../js/timer.js';

describe('Timer', () => {
  describe('Constructor', () => {
    it('should create a timer with a title', () => {
      const timer = new Timer('Test Timer');
      expect(timer.title).to.equal('Test Timer');
      expect(timer.state).to.equal('stopped');
      expect(timer.id).to.be.a('string');
    });

    it('should create a timer with custom id', () => {
      const timer = new Timer('Test', 'custom-id');
      expect(timer.id).to.equal('custom-id');
    });

    it('should throw error for title longer than 50 characters', () => {
      expect(() => new Timer('x'.repeat(51))).to.throw(RangeError);
    });

    it('should throw error for non-string title', () => {
      expect(() => new Timer(123)).to.throw(TypeError);
    });
  });

  describe('State Transitions', () => {
    it('should start from stopped state', () => {
      const timer = new Timer('Test');
      expect(timer.state).to.equal('stopped');
      expect(timer.isRunning()).to.be.false;
    });

    it('should transition to running when started', () => {
      const timer = new Timer('Test');
      timer.start();
      expect(timer.state).to.equal('running');
      expect(timer.isRunning()).to.be.true;
    });

    it('should transition to paused when paused', (done) => {
      const timer = new Timer('Test');
      timer.start();
      setTimeout(() => {
        timer.pause();
        expect(timer.state).to.equal('paused');
        expect(timer.isRunning()).to.be.false;
        done();
      }, 100);
    });

    it('should transition to stopped when reset', () => {
      const timer = new Timer('Test');
      timer.start();
      timer.reset();
      expect(timer.state).to.equal('stopped');
      expect(timer.isRunning()).to.be.false;
    });

    it('should be no-op when starting an already running timer', () => {
      const timer = new Timer('Test');
      timer.start();
      const firstStartTime = timer.startTimeMs;
      timer.start();
      expect(timer.startTimeMs).to.equal(firstStartTime);
    });
  });

  describe('Time Tracking', () => {
    it('should start with zero elapsed time', () => {
      const timer = new Timer('Test');
      expect(timer.getElapsedMs()).to.equal(0);
    });

    it('should accumulate time when running', (done) => {
      const timer = new Timer('Test');
      timer.start();
      setTimeout(() => {
        const elapsed = timer.getElapsedMs();
        expect(elapsed).to.be.at.least(100);
        expect(elapsed).to.be.below(200);
        done();
      }, 100);
    });

    it('should preserve elapsed time when paused', (done) => {
      const timer = new Timer('Test');
      timer.start();
      setTimeout(() => {
        timer.pause();
        const pausedTime = timer.getElapsedMs();
        setTimeout(() => {
          expect(timer.getElapsedMs()).to.equal(pausedTime);
          done();
        }, 50);
      }, 100);
    });

    it('should reset elapsed time to zero', (done) => {
      const timer = new Timer('Test');
      timer.start();
      setTimeout(() => {
        timer.reset();
        expect(timer.getElapsedMs()).to.equal(0);
        done();
      }, 100);
    });

    it('should resume from paused time', (done) => {
      const timer = new Timer('Test');
      timer.start();
      setTimeout(() => {
        timer.pause();
        const pausedTime = timer.getElapsedMs();
        timer.start();
        setTimeout(() => {
          const resumedTime = timer.getElapsedMs();
          expect(resumedTime).to.be.at.least(pausedTime + 50);
          done();
        }, 50);
      }, 100);
    });
  });

  describe('Time Formatting', () => {
    it('should format zero time as 00:00:00', () => {
      const timer = new Timer('Test');
      expect(timer.getFormattedTime()).to.equal('00:00:00');
    });

    it('should format seconds correctly', () => {
      const timer = new Timer('Test');
      timer.elapsedMs = 5000;
      expect(timer.getFormattedTime()).to.equal('00:00:05');
    });

    it('should format minutes and seconds correctly', () => {
      const timer = new Timer('Test');
      timer.elapsedMs = 65000;
      expect(timer.getFormattedTime()).to.equal('00:01:05');
    });

    it('should format hours, minutes, and seconds correctly', () => {
      const timer = new Timer('Test');
      timer.elapsedMs = 3665000;
      expect(timer.getFormattedTime()).to.equal('01:01:05');
    });

    it('should support hours greater than 99', () => {
      const timer = new Timer('Test');
      timer.elapsedMs = 451865000;
      expect(timer.getFormattedTime()).to.equal('125:31:05');
    });
  });

  describe('Title Validation', () => {
    it('should allow valid title changes', () => {
      const timer = new Timer('Test');
      timer.title = 'New Title';
      expect(timer.title).to.equal('New Title');
    });

    it('should throw error for empty title', () => {
      const timer = new Timer('Test');
      expect(() => { timer.title = ''; }).to.throw(RangeError);
    });

    it('should throw error for title exceeding 50 characters', () => {
      const timer = new Timer('Test');
      expect(() => { timer.title = 'x'.repeat(51); }).to.throw(RangeError);
    });

    it('should throw error for non-string title', () => {
      const timer = new Timer('Test');
      expect(() => { timer.title = 123; }).to.throw(TypeError);
    });
  });
});
