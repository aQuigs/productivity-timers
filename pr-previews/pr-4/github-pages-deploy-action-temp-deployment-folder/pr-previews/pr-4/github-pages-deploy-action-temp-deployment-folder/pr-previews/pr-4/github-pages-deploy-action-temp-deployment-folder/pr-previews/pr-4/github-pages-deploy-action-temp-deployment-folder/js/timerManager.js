import { Timer } from './timer.js';

/**
 * TimerManager class - Orchestrates multiple timers and enforces mutual exclusivity
 * Ensures only one timer can run at any given moment
 */
export class TimerManager {
  #timers;
  #runningTimerId;

  /**
   * Creates a new TimerManager instance with initial timers
   * @param {number} [initialCount=2] - Number of timers to create initially
   */
  constructor(initialCount = 2) {
    if (initialCount < 1 || initialCount > 20) {
      throw new RangeError('Initial count must be between 1 and 20');
    }

    this.#timers = [];
    this.#runningTimerId = null;

    for (let i = 1; i <= initialCount; i++) {
      this.#timers.push(new Timer(`Timer ${i}`));
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
    return true;
  }

  /**
   * Resets all timers to 00:00:00 and stops any running timer
   * @returns {void}
   */
  resetAll() {
    this.#timers.forEach(timer => timer.reset());
    this.#runningTimerId = null;
  }
}
