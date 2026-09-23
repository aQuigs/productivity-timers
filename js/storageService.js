import { Timer } from './timer.js';
import { namespacedKey } from './storageNamespace.js';

/**
 * StorageService - Handles localStorage persistence for timer state
 * Provides serialization, validation, and error handling
 */
export class StorageService {
  #storageKey;
  #version;
  available;

  constructor(storageKey = namespacedKey('productivity-timers-v1')) {
    this.#storageKey = storageKey;
    this.#version = 1;
    this.available = this.#checkAvailability();
  }

  /**
   * Check if localStorage is available
   * @returns {boolean}
   */
  #checkAvailability() {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      console.warn('localStorage not available. Timer state will not persist.');
      return false;
    }
  }

  /**
   * Save state to localStorage
   * @param {Object} state - { timers: [], runningTimerId: string|null }
   * @returns {boolean} Success/failure
   */
  save(state) {
    if (!this.available) {
      return false;
    }

    if (!this.validateState(state)) {
      return false;
    }

    try {
      const data = {
        version: this.#version,
        timestamp: Date.now(),
        data: state
      };
      localStorage.setItem(this.#storageKey, JSON.stringify(data));
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Timer state not saved.');
      } else {
        console.error('Failed to save to localStorage:', error);
      }
      return false;
    }
  }

  /**
   * Load state from localStorage
   * @returns {Object|null} State object or null if invalid/missing
   */
  load() {
    if (!this.available) {
      return null;
    }

    try {
      const raw = localStorage.getItem(this.#storageKey);
      if (!raw) {
        return null;
      }

      const stored = JSON.parse(raw);

      if (stored.version !== this.#version) {
        console.warn('Storage schema version mismatch. Clearing old data.');
        this.clear();
        return null;
      }

      if (!this.validateState(stored.data)) {
        console.warn('Invalid timer state in storage. Clearing corrupted data.');
        this.clear();
        return null;
      }

      return stored.data;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      this.clear();
      return null;
    }
  }

  /**
   * Clear stored data
   */
  clear() {
    if (this.available) {
      localStorage.removeItem(this.#storageKey);
    }
  }

  /**
   * Validate state object structure
   * @param {Object} state
   * @returns {boolean}
   */
  validateState(state) {
    if (!state || typeof state !== 'object') {
      return false;
    }

    if (!Array.isArray(state.timers)) {
      return false;
    }

    if (state.timers.length < 1 || state.timers.length > 20) {
      return false;
    }

    for (const timer of state.timers) {
      if (!this.#validateTimer(timer)) {
        return false;
      }
    }

    if (state.runningTimerId !== null && typeof state.runningTimerId !== 'string') {
      return false;
    }

    if (state.runningTimerId !== null) {
      const exists = state.timers.some(t => t.id === state.runningTimerId);
      if (!exists) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate individual timer object
   * @param {Object} timer
   * @returns {boolean}
   */
  #validateTimer(timer) {
    if (!timer || typeof timer !== 'object') {
      return false;
    }

    if (typeof timer.id !== 'string' || timer.id.length === 0) {
      return false;
    }

    if (typeof timer.title !== 'string' || timer.title.length === 0) {
      return false;
    }

    if (typeof timer.elapsedMs !== 'number' || timer.elapsedMs < 0) {
      return false;
    }

    if (!Timer.VALID_STATES.includes(timer.state)) {
      return false;
    }

    // Both target fields are absent in state saved before targets existed
    if (timer.targetMs !== undefined &&
        timer.targetMs !== null &&
        (typeof timer.targetMs !== 'number' || !Number.isFinite(timer.targetMs) || timer.targetMs <= 0)) {
      return false;
    }

    if (timer.targetKind !== undefined &&
        timer.targetKind !== null &&
        !Timer.TARGET_KINDS.includes(timer.targetKind)) {
      return false;
    }

    return true;
  }
}
