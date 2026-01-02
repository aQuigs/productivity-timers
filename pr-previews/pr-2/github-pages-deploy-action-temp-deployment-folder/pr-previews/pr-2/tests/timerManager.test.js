import { expect } from '@esm-bundle/chai';
import { TimerManager } from '../js/timerManager.js';

describe('TimerManager', () => {
  describe('Constructor', () => {
    it('should create manager with 2 default timers', () => {
      const manager = new TimerManager();
      const timers = manager.getAllTimers();
      expect(timers).to.have.lengthOf(2);
      expect(timers[0].title).to.equal('Timer 1');
      expect(timers[1].title).to.equal('Timer 2');
    });

    it('should create manager with custom initial count', () => {
      const manager = new TimerManager(5);
      expect(manager.getAllTimers()).to.have.lengthOf(5);
    });

    it('should throw error for initial count < 1', () => {
      expect(() => new TimerManager(0)).to.throw(RangeError);
    });

    it('should throw error for initial count > 20', () => {
      expect(() => new TimerManager(21)).to.throw(RangeError);
    });
  });

  describe('Get Methods', () => {
    it('should get all timers', () => {
      const manager = new TimerManager(3);
      const timers = manager.getAllTimers();
      expect(timers).to.be.an('array');
      expect(timers).to.have.lengthOf(3);
    });

    it('should get timer by id', () => {
      const manager = new TimerManager();
      const timers = manager.getAllTimers();
      const timer = manager.getTimer(timers[0].id);
      expect(timer).to.equal(timers[0]);
    });

    it('should return undefined for non-existent id', () => {
      const manager = new TimerManager();
      const timer = manager.getTimer('invalid-id');
      expect(timer).to.be.undefined;
    });

    it('should return null when no timer is running', () => {
      const manager = new TimerManager();
      expect(manager.getRunningTimer()).to.be.null;
    });

    it('should return running timer', () => {
      const manager = new TimerManager();
      const timers = manager.getAllTimers();
      manager.startTimer(timers[0].id);
      expect(manager.getRunningTimer()).to.equal(timers[0]);
    });
  });

  describe('Mutual Exclusivity', () => {
    it('should start a timer', () => {
      const manager = new TimerManager();
      const timers = manager.getAllTimers();
      const result = manager.startTimer(timers[0].id);
      expect(result).to.be.true;
      expect(timers[0].isRunning()).to.be.true;
    });

    it('should pause other timer when starting new timer', () => {
      const manager = new TimerManager();
      const timers = manager.getAllTimers();

      manager.startTimer(timers[0].id);
      expect(timers[0].isRunning()).to.be.true;

      manager.startTimer(timers[1].id);
      expect(timers[0].isRunning()).to.be.false;
      expect(timers[1].isRunning()).to.be.true;
    });

    it('should ensure only one timer runs at a time', (done) => {
      const manager = new TimerManager(3);
      const timers = manager.getAllTimers();

      manager.startTimer(timers[0].id);
      setTimeout(() => {
        manager.startTimer(timers[1].id);
        setTimeout(() => {
          manager.startTimer(timers[2].id);

          const runningCount = timers.filter(t => t.isRunning()).length;
          expect(runningCount).to.equal(1);
          expect(timers[2].isRunning()).to.be.true;
          done();
        }, 50);
      }, 50);
    });

    it('should be no-op when starting already running timer', () => {
      const manager = new TimerManager();
      const timers = manager.getAllTimers();

      manager.startTimer(timers[0].id);
      const firstStartTime = timers[0].startTimeMs;
      manager.startTimer(timers[0].id);
      expect(timers[0].startTimeMs).to.equal(firstStartTime);
    });

    it('should return false for non-existent timer id', () => {
      const manager = new TimerManager();
      const result = manager.startTimer('invalid-id');
      expect(result).to.be.false;
    });
  });

  describe('Pause Timer', () => {
    it('should pause a running timer', () => {
      const manager = new TimerManager();
      const timers = manager.getAllTimers();

      manager.startTimer(timers[0].id);
      const result = manager.pauseTimer(timers[0].id);

      expect(result).to.be.true;
      expect(timers[0].isRunning()).to.be.false;
      expect(manager.getRunningTimer()).to.be.null;
    });

    it('should be no-op when pausing non-running timer', () => {
      const manager = new TimerManager();
      const timers = manager.getAllTimers();

      const result = manager.pauseTimer(timers[0].id);
      expect(result).to.be.true;
    });

    it('should return false for non-existent timer id', () => {
      const manager = new TimerManager();
      const result = manager.pauseTimer('invalid-id');
      expect(result).to.be.false;
    });
  });

  describe('Add Timer', () => {
    it('should add a new timer with default title', () => {
      const manager = new TimerManager();
      const newTimer = manager.addTimer();

      expect(manager.getAllTimers()).to.have.lengthOf(3);
      expect(newTimer.title).to.equal('Timer 3');
    });

    it('should add a timer with custom title', () => {
      const manager = new TimerManager();
      const newTimer = manager.addTimer('Custom Timer');

      expect(newTimer.title).to.equal('Custom Timer');
    });

    it('should throw error when adding beyond 20 timers', () => {
      const manager = new TimerManager(20);
      expect(() => manager.addTimer()).to.throw(RangeError);
    });
  });

  describe('Remove Timer', () => {
    it('should remove a timer by id', () => {
      const manager = new TimerManager(3);
      const timers = manager.getAllTimers();
      const result = manager.removeTimer(timers[1].id);

      expect(result).to.be.true;
      expect(manager.getAllTimers()).to.have.lengthOf(2);
    });

    it('should not remove last timer', () => {
      const manager = new TimerManager(1);
      const timers = manager.getAllTimers();
      const result = manager.removeTimer(timers[0].id);

      expect(result).to.be.false;
      expect(manager.getAllTimers()).to.have.lengthOf(1);
    });

    it('should clear running timer id when removing running timer', () => {
      const manager = new TimerManager();
      const timers = manager.getAllTimers();

      manager.startTimer(timers[0].id);
      manager.removeTimer(timers[0].id);

      expect(manager.getRunningTimer()).to.be.null;
    });

    it('should return false for non-existent timer id', () => {
      const manager = new TimerManager();
      const result = manager.removeTimer('invalid-id');
      expect(result).to.be.false;
    });
  });

  describe('Reset All', () => {
    it('should reset all timers to 00:00:00', (done) => {
      const manager = new TimerManager();
      const timers = manager.getAllTimers();

      manager.startTimer(timers[0].id);
      setTimeout(() => {
        manager.startTimer(timers[1].id);
        setTimeout(() => {
          manager.resetAll();

          timers.forEach(timer => {
            expect(timer.getElapsedMs()).to.equal(0);
            expect(timer.state).to.equal('stopped');
          });
          expect(manager.getRunningTimer()).to.be.null;
          done();
        }, 50);
      }, 50);
    });
  });
});
