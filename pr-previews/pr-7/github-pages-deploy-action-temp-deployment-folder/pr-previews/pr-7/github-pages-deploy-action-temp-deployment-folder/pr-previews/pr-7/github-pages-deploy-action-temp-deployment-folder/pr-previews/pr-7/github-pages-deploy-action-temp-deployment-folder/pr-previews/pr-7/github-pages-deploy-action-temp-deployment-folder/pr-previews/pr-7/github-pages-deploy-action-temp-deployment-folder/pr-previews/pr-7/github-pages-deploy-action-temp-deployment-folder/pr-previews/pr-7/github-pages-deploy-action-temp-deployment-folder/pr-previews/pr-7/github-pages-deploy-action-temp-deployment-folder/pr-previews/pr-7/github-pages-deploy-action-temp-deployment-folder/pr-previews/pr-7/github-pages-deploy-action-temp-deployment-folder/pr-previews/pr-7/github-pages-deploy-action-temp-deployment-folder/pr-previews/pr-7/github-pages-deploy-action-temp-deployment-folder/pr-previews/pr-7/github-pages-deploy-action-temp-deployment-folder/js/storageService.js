import { Timer } from './timer.js';

/**
 * StorageService - Handles localStorage persistence for timer state
 * Provides serialization, validation, and error handling
 */
export class StorageService {
  #storageKey;
  #version;
  available;

  constructor(storageKey = 'productivity-timers-v1') {
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

      // Validate schema version
      if (stored.version !== this.#version) {
        console.warn('Storage schema version mismatch. Clearing old data.');
        this.clear();
        return null;
      }

      // Validate data structure
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
    // Check basic structure
    if (!state || typeof state !== 'object') {
      return false;
    }

    if (!Array.isArray(state.timers)) {
      return false;
    }

    // Check timer count constraints
    if (state.timers.length < 1 || state.timers.length > 20) {
      return false;
    }

    // Validate each timer
    for (const timer of state.timers) {
      if (!this.#validateTimer(timer)) {
        return false;
      }
    }

    // Validate runningTimerId
    if (state.runningTimerId !== null && typeof state.runningTimerId !== 'string') {
      return false;
    }

    // If runningTimerId is set, ensure it references an existing timer
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

    // Check required fields exist and have correct types
    if (typeof timer.id !== 'string' || timer.id.length === 0) {
      return false;
    }

    if (typeof timer.title !== 'string' || timer.title.length === 0) {
      return false;
    }

    if (typeof timer.elapsedMs !== 'number' || timer.elapsedMs < 0) {
      return false;
    }

    if (typeof timer.state !== 'string') {
      return false;
    }

    // Validate state is one of valid values
    if (!Timer.VALID_STATES.includes(timer.state)) {
      return false;
    }

    return true;
  }
}
