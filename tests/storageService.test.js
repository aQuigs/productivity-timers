import { expect } from '@esm-bundle/chai';
import { StorageService } from '../js/storageService.js';
import { atPreviewPath } from './helpers.js';

describe('StorageService', () => {
  let storage;

  function stateWith(timer, runningTimerId = null) {
    return {
      timers: [{ id: 'abc', title: 'Timer 1', elapsedMs: 1000, state: 'stopped', ...timer }],
      runningTimerId
    };
  }

  beforeEach(() => {
    localStorage.clear();
    storage = new StorageService();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('Schema Extension - Timer Target', () => {
    it('should save and load a positive targetMs', () => {
      expect(storage.save(stateWith({ targetMs: 1500000 }))).to.be.true;
      expect(storage.load().timers[0].targetMs).to.equal(1500000);
    });

    it('should accept a null or absent targetMs', () => {
      expect(storage.validateState(stateWith({ targetMs: null }))).to.be.true;
      expect(storage.validateState(stateWith({}))).to.be.true;
    });

    it('should reject a non-numeric targetMs', () => {
      expect(storage.validateState(stateWith({ targetMs: '25m' }))).to.be.false;
      expect(storage.validateState(stateWith({ targetMs: true }))).to.be.false;
    });

    it('should reject a zero or negative targetMs', () => {
      expect(storage.validateState(stateWith({ targetMs: 0 }))).to.be.false;
      expect(storage.validateState(stateWith({ targetMs: -1000 }))).to.be.false;
    });

    it('should reject a non-finite targetMs', () => {
      expect(storage.validateState(stateWith({ targetMs: NaN }))).to.be.false;
      expect(storage.validateState(stateWith({ targetMs: Infinity }))).to.be.false;
    });

    describe('targetKind', () => {
      function withKind(targetKind) {
        return stateWith({ targetMs: 1500000, targetKind });
      }

      it('should save and load a goal or budget kind', () => {
        expect(storage.save(withKind('budget'))).to.be.true;
        expect(storage.load().timers[0].targetKind).to.equal('budget');
        expect(storage.save(withKind('goal'))).to.be.true;
        expect(storage.load().timers[0].targetKind).to.equal('goal');
      });

      it('should accept a null or absent targetKind', () => {
        expect(storage.validateState(withKind(null))).to.be.true;
        expect(storage.validateState(stateWith({ targetMs: 1500000 }))).to.be.true;
      });

      it('should reject an unknown targetKind', () => {
        expect(storage.validateState(withKind('limit'))).to.be.false;
        expect(storage.validateState(withKind('Goal'))).to.be.false;
        expect(storage.validateState(withKind(''))).to.be.false;
      });

      it('should reject a non-string targetKind', () => {
        expect(storage.validateState(withKind(1))).to.be.false;
        expect(storage.validateState(withKind(true))).to.be.false;
        expect(storage.validateState(withKind({}))).to.be.false;
      });
    });
  });

  describe('save() and load()', () => {
    it('should save and load valid state', () => {
      const state = stateWith({});

      expect(storage.save(state)).to.be.true;
      expect(storage.load()).to.deep.equal(state);
    });

    it('should load a reordered timer list back in the same order', () => {
      const state = {
        timers: [
          { id: 'ghi', title: 'Timer 3', elapsedMs: 0, state: 'stopped' },
          { id: 'abc', title: 'Timer 1', elapsedMs: 1000, state: 'paused' },
          { id: 'def', title: 'Timer 2', elapsedMs: 5000, state: 'stopped' }
        ],
        runningTimerId: 'abc'
      };

      expect(storage.save(state)).to.be.true;
      const loaded = storage.load();
      expect(loaded.timers.map(t => t.id)).to.deep.equal(['ghi', 'abc', 'def']);
      expect(loaded.runningTimerId).to.equal('abc');
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
      const state = stateWith({});

      storage.save(state);
      const stored = JSON.parse(localStorage.getItem('productivity-timers-v1'));

      expect(stored.version).to.equal(1);
      expect(stored.timestamp).to.be.a('number');
      expect(stored.data).to.deep.equal(state);
    });

    it('should reject invalid schema version', () => {
      const invalidVersionData = {
        version: 999,
        timestamp: Date.now(),
        data: stateWith({})
      };

      localStorage.setItem('productivity-timers-v1', JSON.stringify(invalidVersionData));
      expect(storage.load()).to.be.null;
      expect(localStorage.getItem('productivity-timers-v1')).to.be.null;
    });
  });

  describe('validateState()', () => {
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
      expect(storage.validateState({ runningTimerId: null })).to.be.false;
      expect(storage.validateState({ timers: 'not-an-array', runningTimerId: null })).to.be.false;
    });

    it('should reject state with empty timers array', () => {
      expect(storage.validateState({ timers: [], runningTimerId: null })).to.be.false;
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

    it('should reject invalid runningTimerId reference', () => {
      expect(storage.validateState(stateWith({}, 'nonexistent'))).to.be.false;
    });

    const invalidTimers = {
      'missing id': { id: undefined },
      'non-string id': { id: 123 },
      'missing title': { title: undefined },
      'non-string title': { title: 123 },
      'missing elapsedMs': { elapsedMs: undefined },
      'non-number elapsedMs': { elapsedMs: '1000' },
      'missing state': { state: undefined },
      'invalid state value': { state: 'invalid' }
    };

    Object.entries(invalidTimers).forEach(([label, override]) => {
      it(`should reject a timer with ${label}`, () => {
        expect(storage.validateState(stateWith(override))).to.be.false;
      });
    });
  });

  describe('clear()', () => {
    it('should clear stored data', () => {
      storage.save(stateWith({}));
      expect(localStorage.getItem('productivity-timers-v1')).to.not.be.null;

      storage.clear();
      expect(localStorage.getItem('productivity-timers-v1')).to.be.null;
    });
  });

  describe('localStorage unavailable', () => {
    it('should return false for save when localStorage unavailable', () => {
      const brokenStorage = new StorageService();
      Object.defineProperty(brokenStorage, 'available', { value: false });

      expect(brokenStorage.save(stateWith({}))).to.be.false;
    });

    it('should return null for load when localStorage unavailable', () => {
      const brokenStorage = new StorageService();
      Object.defineProperty(brokenStorage, 'available', { value: false });

      expect(brokenStorage.load()).to.be.null;
    });
  });

  describe('PR Preview Isolation', () => {
    const state = {
      timers: [{ id: 'a', title: 'T1', elapsedMs: 5, state: 'paused' }],
      runningTimerId: null
    };

    it('should save under a per-PR key when the page is a PR preview', async () => {
      await atPreviewPath('pr-12', () => {
        expect(new StorageService().save(state)).to.be.true;
      });

      expect(localStorage.getItem('pr-12:productivity-timers-v1')).to.not.be.null;
      expect(localStorage.getItem('productivity-timers-v1')).to.be.null;
    });

    it('should not see production state from a PR preview', async () => {
      expect(storage.save(state)).to.be.true;

      await atPreviewPath('pr-12', () => {
        expect(new StorageService().load()).to.be.null;
      });
    });

    it('should not see another PR preview\'s state', async () => {
      await atPreviewPath('pr-12', () => {
        expect(new StorageService().save(state)).to.be.true;
      });

      await atPreviewPath('pr-13', () => {
        expect(new StorageService().load()).to.be.null;
      });
    });

    it('should keep using the per-PR key after the page path is no longer read', async () => {
      const preview = await atPreviewPath('pr-12', () => new StorageService());

      expect(preview.save(state)).to.be.true;
      expect(localStorage.getItem('pr-12:productivity-timers-v1')).to.not.be.null;
      expect(localStorage.getItem('productivity-timers-v1')).to.be.null;
    });
  });
});
