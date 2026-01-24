import { expect } from '@esm-bundle/chai';
import { TimerManager } from '../js/timerManager.js';
import { StorageService } from '../js/storageService.js';

describe('TimerManager', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

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

  describe('Persistence - updateTimerTitle()', () => {
    it('should update timer title and persist', () => {
      const storage = new StorageService();
      const manager = new TimerManager(2, storage);
      const timers = manager.getAllTimers();
      const timerId = timers[0].id;

      const result = manager.updateTimerTitle(timerId, 'New Title');

      expect(result).to.be.true;
      expect(manager.getTimer(timerId).title).to.equal('New Title');

      const loaded = storage.load();
      expect(loaded.timers[0].title).to.equal('New Title');
    });

    it('should return false for invalid timer id', () => {
      const storage = new StorageService();
      const manager = new TimerManager(2, storage);

      const result = manager.updateTimerTitle('invalid-id', 'New Title');
      expect(result).to.be.false;
    });

    it('should throw error for invalid title', () => {
      const storage = new StorageService();
      const manager = new TimerManager(2, storage);
      const timers = manager.getAllTimers();

      expect(() => manager.updateTimerTitle(timers[0].id, '')).to.throw();
    });
  });

  describe('Persistence - resetTimer()', () => {
    it('should reset individual timer and persist', (done) => {
      const storage = new StorageService();
      const manager = new TimerManager(2, storage);
      const timers = manager.getAllTimers();
      const timerId = timers[0].id;

      manager.startTimer(timerId);
      setTimeout(() => {
        const result = manager.resetTimer(timerId);

        expect(result).to.be.true;
        expect(manager.getTimer(timerId).getElapsedMs()).to.equal(0);

        const loaded = storage.load();
        expect(loaded.timers[0].elapsedMs).to.equal(0);
        done();
      }, 50);
    });

    it('should return false for invalid timer id', () => {
      const storage = new StorageService();
      const manager = new TimerManager(2, storage);

      const result = manager.resetTimer('invalid-id');
      expect(result).to.be.false;
    });
  });

  describe('Persistence - Storage Integration', () => {
    let storage;

    beforeEach(() => {
      storage = new StorageService();
    });

    it('should load timers from storage on construction', () => {
      const manager1 = new TimerManager(2, storage);
      const timers1 = manager1.getAllTimers();
      timers1[0].title = 'Custom Timer';
      manager1.startTimer(timers1[0].id);

      const manager2 = new TimerManager(2, storage);
      const timers2 = manager2.getAllTimers();

      expect(timers2).to.have.lengthOf(2);
      expect(timers2[0].title).to.equal('Custom Timer');
    });

    it('should persist when starting timer', () => {
      const manager = new TimerManager(2, storage);
      const timers = manager.getAllTimers();
      const timerId = timers[0].id;

      manager.startTimer(timerId);

      const loaded = storage.load();
      expect(loaded.runningTimerId).to.equal(timerId);
    });

    it('should persist when pausing timer', (done) => {
      const manager = new TimerManager(2, storage);
      const timers = manager.getAllTimers();
      const timerId = timers[0].id;

      manager.startTimer(timerId);
      setTimeout(() => {
        manager.pauseTimer(timerId);

        const loaded = storage.load();
        expect(loaded.runningTimerId).to.be.null;
        expect(loaded.timers[0].state).to.equal('paused');
        done();
      }, 50);
    });

    it('should persist when adding timer', () => {
      const manager = new TimerManager(2, storage);
      manager.addTimer('New Timer');

      const loaded = storage.load();
      expect(loaded.timers).to.have.lengthOf(3);
      expect(loaded.timers[2].title).to.equal('New Timer');
    });

    it('should persist when removing timer', () => {
      const manager = new TimerManager(3, storage);
      const timers = manager.getAllTimers();
      const removeId = timers[1].id;

      manager.removeTimer(removeId);

      const loaded = storage.load();
      expect(loaded.timers).to.have.lengthOf(2);
      expect(loaded.timers.some(t => t.id === removeId)).to.be.false;
    });

    it('should persist when resetting all', (done) => {
      const manager = new TimerManager(2, storage);
      const timers = manager.getAllTimers();

      manager.startTimer(timers[0].id);
      setTimeout(() => {
        manager.resetAll();

        const loaded = storage.load();
        expect(loaded.runningTimerId).to.be.null;
        expect(loaded.timers[0].elapsedMs).to.equal(0);
        done();
      }, 50);
    });

    it('should restore running timers as paused', () => {
      const manager1 = new TimerManager(2, storage);
      const timers1 = manager1.getAllTimers();
      manager1.startTimer(timers1[0].id);

      const manager2 = new TimerManager(2, storage);
      const timers2 = manager2.getAllTimers();

      expect(timers2[0].state).to.equal('paused');
      expect(manager2.getRunningTimer()).to.be.null;
    });

    it('should initialize with defaults if storage is empty', () => {
      const manager = new TimerManager(2, storage);
      const timers = manager.getAllTimers();

      expect(timers).to.have.lengthOf(2);
      expect(timers[0].title).to.equal('Timer 1');
      expect(timers[1].title).to.equal('Timer 2');
    });

    it('should fall back to defaults if storage is corrupted', () => {
      localStorage.setItem('productivity-timers-v1', 'corrupted data');

      const manager = new TimerManager(2, storage);
      const timers = manager.getAllTimers();

      expect(timers).to.have.lengthOf(2);
      expect(timers[0].title).to.equal('Timer 1');
    });
  });

  describe('distributeTime()', () => {
    it('should accept a Map of timer ID to milliseconds', () => {
      const manager = new TimerManager(3);
      const timers = manager.getAllTimers();

      const allocations = new Map([
        [timers[0].id, 5000],
        [timers[1].id, 3000]
      ]);

      const result = manager.distributeTime(allocations);
      expect(result).to.be.true;
    });

    it('should apply allocations to correct timers', () => {
      const manager = new TimerManager(3);
      const timers = manager.getAllTimers();

      const timer0InitialTime = timers[0].getElapsedMs();
      const timer1InitialTime = timers[1].getElapsedMs();
      const timer2InitialTime = timers[2].getElapsedMs();

      const allocations = new Map([
        [timers[0].id, 5000],
        [timers[1].id, 3000]
      ]);

      manager.distributeTime(allocations);

      expect(timers[0].getElapsedMs()).to.equal(timer0InitialTime + 5000);
      expect(timers[1].getElapsedMs()).to.equal(timer1InitialTime + 3000);
      expect(timers[2].getElapsedMs()).to.equal(timer2InitialTime);
    });

    it('should skip missing timer IDs gracefully and log warning', () => {
      const manager = new TimerManager(2);
      const timers = manager.getAllTimers();

      const originalWarn = console.warn;
      const warnings = [];
      console.warn = (msg) => warnings.push(msg);

      const allocations = new Map([
        [timers[0].id, 5000],
        ['non-existent-id', 3000],
        [timers[1].id, 2000]
      ]);

      const result = manager.distributeTime(allocations);

      console.warn = originalWarn;

      expect(result).to.be.true;
      expect(timers[0].getElapsedMs()).to.equal(5000);
      expect(timers[1].getElapsedMs()).to.equal(2000);
      expect(warnings).to.have.lengthOf(1);
      expect(warnings[0]).to.include('non-existent-id');
    });

    it('should persist state after distributing time', () => {
      const storage = new StorageService();
      const manager = new TimerManager(2, storage);
      const timers = manager.getAllTimers();

      const allocations = new Map([
        [timers[0].id, 5000],
        [timers[1].id, 3000]
      ]);

      manager.distributeTime(allocations);

      const loaded = storage.load();
      expect(loaded.timers[0].elapsedMs).to.equal(5000);
      expect(loaded.timers[1].elapsedMs).to.equal(3000);
    });

    it('should return true if at least one allocation succeeded', () => {
      const manager = new TimerManager(2);
      const timers = manager.getAllTimers();

      const allocations = new Map([
        [timers[0].id, 5000],
        ['non-existent-id', 3000]
      ]);

      const originalWarn = console.warn;
      console.warn = () => {};

      const result = manager.distributeTime(allocations);

      console.warn = originalWarn;

      expect(result).to.be.true;
    });

    it('should return false if all allocations failed', () => {
      const manager = new TimerManager(2);

      const allocations = new Map([
        ['non-existent-id-1', 5000],
        ['non-existent-id-2', 3000]
      ]);

      const originalWarn = console.warn;
      console.warn = () => {};

      const result = manager.distributeTime(allocations);

      console.warn = originalWarn;

      expect(result).to.be.false;
    });
  });
});
