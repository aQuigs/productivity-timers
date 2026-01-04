/**
 * Timer class - Manages individual timer state and time tracking
 * Uses performance.now() for high-resolution, monotonic timing
 */
export class Timer {
  #id;
  #title;
  #elapsedMs;
  #state;
  #startTimeMs;

  /**
   * Creates a new Timer instance
   * @param {string} title - Initial title for the timer
   * @param {string} [id] - Optional unique identifier (auto-generated if not provided)
   */
  constructor(title, id) {
    if (typeof title !== 'string') {
      throw new TypeError('Title must be a string');
    }
    if (title.length > 50) {
      throw new RangeError('Title cannot exceed 50 characters');
    }
    if (title.length === 0) {
      throw new RangeError('Title cannot be empty');
    }

    this.#id = id || crypto.randomUUID();
    this.#title = title;
    this.#elapsedMs = 0;
    this.#state = 'stopped';
    this.#startTimeMs = null;
  }

  /**
   * Unique identifier for this timer
   */
  get id() {
    return this.#id;
  }

  /**
   * User-editable label for the timer
   */
  get title() {
    return this.#title;
  }

  set title(value) {
    if (typeof value !== 'string') {
      throw new TypeError('Title must be a string');
    }
    if (value.length === 0) {
      throw new RangeError('Title cannot be empty');
    }
    if (value.length > 50) {
      throw new RangeError('Title cannot exceed 50 characters');
    }
    this.#title = value;
  }

  /**
   * Current state of the timer
   */
  get state() {
    return this.#state;
  }

  /**
   * Internal property for testing - direct access to startTimeMs
   */
  get startTimeMs() {
    return this.#startTimeMs;
  }

  /**
   * Internal property for testing - direct access to elapsedMs
   */
  get elapsedMs() {
    return this.#elapsedMs;
  }

  set elapsedMs(value) {
    this.#elapsedMs = value;
  }

  /**
   * Starts the timer from its current elapsed time
   * If already running, this is a no-op
   */
  start() {
    if (this.#state === 'running') {
      return;
    }

    this.#startTimeMs = performance.now();
    this.#state = 'running';
  }

  /**
   * Pauses the timer, preserving accumulated elapsed time
   * If not running, this is a no-op
   */
  pause() {
    if (this.#state !== 'running') {
      return;
    }

    const now = performance.now();
    this.#elapsedMs += (now - this.#startTimeMs);
    this.#startTimeMs = null;
    this.#state = 'paused';
  }

  /**
   * Stops the timer and resets elapsed time to zero
   */
  reset() {
    this.#state = 'stopped';
    this.#elapsedMs = 0;
    this.#startTimeMs = null;
  }

  /**
   * Returns total elapsed time in milliseconds
   * Includes time from current running session if timer is active
   */
  getElapsedMs() {
    if (this.#state === 'running') {
      const now = performance.now();
      return this.#elapsedMs + (now - this.#startTimeMs);
    }
    return this.#elapsedMs;
  }

  /**
   * Returns elapsed time formatted as HH:MM:SS
   * Hours can exceed 99 (e.g., "125:30:45")
   */
  getFormattedTime() {
    const totalSeconds = Math.floor(this.getElapsedMs() / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const hh = String(hours).padStart(2, '0');
    const mm = String(minutes).padStart(2, '0');
    const ss = String(seconds).padStart(2, '0');

    return `${hh}:${mm}:${ss}`;
  }

  /**
   * Convenience method to check if timer is currently running
   */
  isRunning() {
    return this.#state === 'running';
  }
}
