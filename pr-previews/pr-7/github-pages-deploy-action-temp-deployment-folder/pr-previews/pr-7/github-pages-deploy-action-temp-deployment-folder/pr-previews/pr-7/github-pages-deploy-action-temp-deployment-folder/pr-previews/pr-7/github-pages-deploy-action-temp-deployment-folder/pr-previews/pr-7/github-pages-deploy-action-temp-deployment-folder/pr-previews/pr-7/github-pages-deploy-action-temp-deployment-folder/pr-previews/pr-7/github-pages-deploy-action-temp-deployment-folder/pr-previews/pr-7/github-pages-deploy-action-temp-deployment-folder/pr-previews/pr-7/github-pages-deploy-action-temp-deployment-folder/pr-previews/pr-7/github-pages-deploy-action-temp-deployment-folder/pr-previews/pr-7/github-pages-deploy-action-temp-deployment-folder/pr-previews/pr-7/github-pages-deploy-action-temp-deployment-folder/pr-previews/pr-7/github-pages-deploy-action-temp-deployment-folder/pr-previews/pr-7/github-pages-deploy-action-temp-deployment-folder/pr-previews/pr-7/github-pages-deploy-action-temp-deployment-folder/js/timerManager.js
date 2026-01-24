import { Timer } from './timer.js';
import { StorageService } from './storageService.js';

/**
 * TimerManager class - Orchestrates multiple timers and enforces mutual exclusivity
 * Ensures only one timer can run at any given moment
 */
export class TimerManager {
  #timers;
  #runningTimerId;
  #storage;

  /**
   * Creates a new TimerManager instance with initial timers
   * @param {number} [initialCount=2] - Number of timers to create initially
   * @param {StorageService} [storageService] - Optional storage service for persistence
   */
  constructor(initialCount = 2, storageService = null) {
    if (initialCount < 1 || initialCount > 20) {
      throw new RangeError('Initial count must be between 1 and 20');
    }

    this.#storage = storageService || new StorageService();
    this.#timers = [];
    this.#runningTimerId = null;

    const loaded = this.#loadFromStorage();

    if (!loaded) {
      for (let i = 1; i <= initialCount; i++) {
        this.#timers.push(new Timer(`Timer ${i}`));
      }
    }
  }

  /**
   * Load state from storage
   * Note: Running timers are never restored as running because performance.now()
   * baseline cannot be restored across page loads. They are converted to paused.
   * @returns {boolean} Success/failure
   */
  #loadFromStorage() {
    const state = this.#storage.load();
    if (!state) {
      return false;
    }

    try {
      this.#timers = state.timers.map(timerData => Timer.fromJSON(timerData));
      this.#runningTimerId = null;
      return true;
    } catch (error) {
      console.error('Failed to restore timers from storage:', error);
      return false;
    }
  }

  /**
   * Persist current state to storage
   */
  #persist() {
    const state = {
      timers: this.#timers.map(timer => timer.toJSON()),
      runningTimerId: this.#runningTimerId
    };

    const success = this.#storage.save(state);
    if (!success) {
      console.warn('Failed to save timer state to localStorage');
    }
  }

  /**
   * Returns all timers managed by this instance
   * @returns {Timer[]} Array of all Timer instances
   */
  getAllTimers() {
    return this.#timers;
  }

  /**
   * Retrieves a timer by ID
   * @param {string} id - ID of timer to retrieve
   * @returns {Timer | undefined} Timer instance or undefined if not found
   */
  getTimer(id) {
    return this.#timers.find(timer => timer.id === id);
  }

  /**
   * Returns the currently running timer, if any
   * @returns {Timer | null} Running Timer instance or null if no timer is running
   */
  getRunningTimer() {
    if (this.#runningTimerId === null) {
      return null;
    }
    return this.getTimer(this.#runningTimerId);
  }

  /**
   * Starts specified timer, automatically pausing any currently running timer
   * @param {string} id - ID of timer to start
   * @returns {boolean} true if started, false if timer ID not found
   */
  startTimer(id) {
    const timer = this.getTimer(id);
    if (!timer) {
      return false;
    }

    if (timer.isRunning()) {
      return true;
    }

    if (this.#runningTimerId !== null) {
      const runningTimer = this.getTimer(this.#runningTimerId);
      if (runningTimer) {
        runningTimer.pause();
      }
    }

    timer.start();
    this.#runningTimerId = id;
    this.#persist();
    return true;
  }

  /**
   * Pauses specified timer if it's currently running
   * @param {string} id - ID of timer to pause
   * @returns {boolean} true if paused, false if timer ID not found
   */
  pauseTimer(id) {
    const timer = this.getTimer(id);
    if (!timer) {
      return false;
    }

    if (timer.isRunning()) {
      timer.pause();
      this.#runningTimerId = null;
    }

    this.#persist();
    return true;
  }

  /**
   * Adds a new timer with default or custom title
   * @param {string} [title] - Optional title for new timer
   * @returns {Timer} The newly created timer
   */
  addTimer(title) {
    if (this.#timers.length >= 20) {
      throw new RangeError('Maximum 20 timers reached');
    }

    const timerNumber = this.#timers.length + 1;
    const timerTitle = title || `Timer ${timerNumber}`;
    const newTimer = new Timer(timerTitle);
    this.#timers.push(newTimer);
    this.#persist();
    return newTimer;
  }

  /**
   * Removes a timer by ID
   * @param {string} id - ID of timer to remove
   * @returns {boolean} true if removed, false if not found or cannot remove (last timer)
   */
  removeTimer(id) {
    if (this.#timers.length <= 1) {
      return false;
    }

    const index = this.#timers.findIndex(timer => timer.id === id);
    if (index === -1) {
      return false;
    }

    const timer = this.#timers[index];
    if (timer.isRunning()) {
      this.#runningTimerId = null;
    }

    this.#timers.splice(index, 1);
    this.#persist();
    return true;
  }

  /**
   * Resets all timers to 00:00:00 and stops any running timer
   * @returns {void}
   */
  resetAll() {
    this.#timers.forEach(timer => timer.reset());
    this.#runningTimerId = null;
    this.#persist();
  }

  /**
   * Updates a timer's title and persists the change
   * @param {string} id - ID of timer to update
   * @param {string} newTitle - New title for the timer
   * @returns {boolean} true if updated, false if timer not found
   * @throws {Error} If title is invalid
   */
  updateTimerTitle(id, newTitle) {
    const timer = this.getTimer(id);
    if (!timer) {
      return false;
    }

    timer.title = newTitle;
    this.#persist();
    return true;
  }

  /**
   * Resets an individual timer and persists the change
   * @param {string} id - ID of timer to reset
   * @returns {boolean} true if reset, false if timer not found
   */
  resetTimer(id) {
    const timer = this.getTimer(id);
    if (!timer) {
      return false;
    }

    timer.reset();
    this.#persist();
    return true;
  }
}
