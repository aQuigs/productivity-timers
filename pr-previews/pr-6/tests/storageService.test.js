import { expect } from '@esm-bundle/chai';
import { StorageService } from '../js/storageService.js';

describe('StorageService', () => {
  let storage;

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Constructor', () => {
    it('should create a StorageService with default storage key', () => {
      expect(storage).to.be.instanceOf(StorageService);
    });

    it('should create a StorageService with custom storage key', () => {
      const customStorage = new StorageService('custom-key');
      expect(customStorage).to.be.instanceOf(StorageService);
    });

    it('should detect localStorage availability', () => {
      expect(storage.available).to.be.true;
    });
  });

  describe('save() and load()', () => {
    it('should save and load valid state', () => {
      const state = {
        timers: [
          { id: 'abc', title: 'Timer 1', elapsedMs: 1000, state: 'stopped' }
        ],
        runningTimerId: null
      };

      expect(storage.save(state)).to.be.true;
      const loaded = storage.load();
      expect(loaded).to.deep.equal(state);
    });

    it('should save multiple timers', () => {
      const state = {
        timers: [
          { id: 'abc', title: 'Timer 1', elapsedMs: 1000, state: 'stopped' },
          { id: 'def', title: 'Timer 2', elapsedMs: 5000, state: 'paused' },
          { id: 'ghi', title: 'Timer 3', elapsedMs: 0, state: 'stopped' }
        ],
        runningTimerId: null
      };

      expect(storage.save(state)).to.be.true;
      const loaded = storage.load();
      expect(loaded).to.deep.equal(state);
    });

    it('should return null when no data exists', () => {
      expect(storage.load()).to.be.null;
    });

    it('should handle corrupted JSON gracefully', () => {
      localStorage.setItem('productivity-timers-v1', 'invalid json{');
      expect(storage.load()).to.be.null;
      expect(localStorage.getItem('productivity-timers-v1')).to.be.null;
    });

    it('should handle corrupted data structure', () => {
      localStorage.setItem('productivity-timers-v1', JSON.stringify({ invalid: 'structure' }));
      expect(storage.load()).to.be.null;
      expect(localStorage.getItem('productivity-timers-v1')).to.be.null;
    });

    it('should include version and timestamp in stored data', () => {
      const state = {
        timers: [
          { id: 'abc', title: 'Timer 1', elapsedMs: 0, state: 'stopped' }
        ],
        runningTimerId: null
      };

      storage.save(state);
      const raw = localStorage.getItem('productivity-timers-v1');
      const stored = JSON.parse(raw);

      expect(stored.version).to.equal(1);
      expect(stored.timestamp).to.be.a('number');
      expect(stored.data).to.deep.equal(state);
    });

    it('should reject invalid schema version', () => {
      const invalidVersionData = {
        version: 999,
        timestamp: Date.now(),
        data: {
          timers: [{ id: 'abc', title: 'Timer 1', elapsedMs: 0, state: 'stopped' }],
          runningTimerId: null
        }
      };

      localStorage.setItem('productivity-timers-v1', JSON.stringify(invalidVersionData));
      expect(storage.load()).to.be.null;
      expect(localStorage.getItem('productivity-timers-v1')).to.be.null;
    });
  });

  describe('validateState()', () => {
    it('should accept valid state with one timer', () => {
      const state = {
        timers: [{ id: 'a', title: 'T1', elapsedMs: 0, state: 'stopped' }],
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.true;
    });

    it('should accept valid state with multiple timers', () => {
      const state = {
        timers: [
          { id: 'a', title: 'T1', elapsedMs: 0, state: 'stopped' },
          { id: 'b', title: 'T2', elapsedMs: 5000, state: 'paused' }
        ],
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.true;
    });

    it('should accept valid state with runningTimerId', () => {
      const state = {
        timers: [
          { id: 'a', title: 'T1', elapsedMs: 0, state: 'paused' },
          { id: 'b', title: 'T2', elapsedMs: 5000, state: 'paused' }
        ],
        runningTimerId: 'a'
      };
      expect(storage.validateState(state)).to.be.true;
    });

    it('should reject state with no timers array', () => {
      const state = { runningTimerId: null };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject state with empty timers array', () => {
      const state = { timers: [], runningTimerId: null };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject state with more than 20 timers', () => {
      const state = {
        timers: Array(21).fill().map((_, i) => ({
          id: `timer-${i}`,
          title: `Timer ${i}`,
          elapsedMs: 0,
          state: 'stopped'
        })),
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject timer missing id', () => {
      const state = {
        timers: [{ title: 'T1', elapsedMs: 0, state: 'stopped' }],
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject timer missing title', () => {
      const state = {
        timers: [{ id: 'a', elapsedMs: 0, state: 'stopped' }],
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject timer missing elapsedMs', () => {
      const state = {
        timers: [{ id: 'a', title: 'T1', state: 'stopped' }],
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject timer missing state', () => {
      const state = {
        timers: [{ id: 'a', title: 'T1', elapsedMs: 0 }],
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject timer with invalid state value', () => {
      const state = {
        timers: [{ id: 'a', title: 'T1', elapsedMs: 0, state: 'invalid' }],
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject invalid runningTimerId reference', () => {
      const state = {
        timers: [{ id: 'a', title: 'T1', elapsedMs: 0, state: 'stopped' }],
        runningTimerId: 'nonexistent'
      };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject state with non-array timers', () => {
      const state = {
        timers: 'not-an-array',
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject timer with non-string id', () => {
      const state = {
        timers: [{ id: 123, title: 'T1', elapsedMs: 0, state: 'stopped' }],
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject timer with non-string title', () => {
      const state = {
        timers: [{ id: 'a', title: 123, elapsedMs: 0, state: 'stopped' }],
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.false;
    });

    it('should reject timer with non-number elapsedMs', () => {
      const state = {
        timers: [{ id: 'a', title: 'T1', elapsedMs: '1000', state: 'stopped' }],
        runningTimerId: null
      };
      expect(storage.validateState(state)).to.be.false;
    });
  });

  describe('clear()', () => {
    it('should clear stored data', () => {
      const state = {
        timers: [{ id: 'abc', title: 'Timer 1', elapsedMs: 0, state: 'stopped' }],
        runningTimerId: null
      };

      storage.save(state);
      expect(localStorage.getItem('productivity-timers-v1')).to.not.be.null;

      storage.clear();
      expect(localStorage.getItem('productivity-timers-v1')).to.be.null;
    });
  });

  describe('localStorage unavailable', () => {
    it('should return false for save when localStorage unavailable', () => {
      const brokenStorage = new StorageService();
      Object.defineProperty(brokenStorage, 'available', { value: false });

      const state = {
        timers: [{ id: 'abc', title: 'Timer 1', elapsedMs: 0, state: 'stopped' }],
        runningTimerId: null
      };

      expect(brokenStorage.save(state)).to.be.false;
    });

    it('should return null for load when localStorage unavailable', () => {
      const brokenStorage = new StorageService();
      Object.defineProperty(brokenStorage, 'available', { value: false });

      expect(brokenStorage.load()).to.be.null;
    });
  });
});
