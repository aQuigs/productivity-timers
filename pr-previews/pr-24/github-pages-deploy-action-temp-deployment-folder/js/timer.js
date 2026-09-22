import { formatDuration } from './formatDuration.js';

/**
 * Timer class - Manages individual timer state and time tracking
 * Uses performance.now() for high-resolution, monotonic timing
 */
export class Timer {
  static VALID_STATES = ['stopped', 'paused', 'running'];

  /**
   * A goal is a minimum to reach; a budget is a maximum not to exceed
   */
  static TARGET_KINDS = ['goal', 'budget'];

  #id;
  #title;
  #elapsedMs;
  #state;
  #startTimeMs;
  #targetMs;
  #targetKind;

  static #validateTarget(value) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      throw new TypeError('Target must be null or an integer number of milliseconds');
    }
    if (value <= 0) {
      throw new RangeError('Target must be positive');
    }
  }

  static #validateTargetKind(kind) {
    if (typeof kind !== 'string') {
      throw new TypeError("Target kind must be 'goal' or 'budget'");
    }
    if (!Timer.TARGET_KINDS.includes(kind)) {
      throw new RangeError("Target kind must be 'goal' or 'budget'");
    }
  }

  #validateTitle(value) {
    if (typeof value !== 'string') {
      throw new TypeError('Title must be a string');
    }
    if (value.length === 0) {
      throw new RangeError('Title cannot be empty');
    }
    if (value.length > 50) {
      throw new RangeError('Title cannot exceed 50 characters');
    }
  }

  /**
   * Creates a new Timer instance
   * @param {string} title - Initial title for the timer
   * @param {string} [id] - Optional unique identifier (auto-generated if not provided)
   */
  constructor(title, id) {
    this.#validateTitle(title);

    this.#id = id || crypto.randomUUID();
    this.#title = title;
    this.#elapsedMs = 0;
    this.#state = 'stopped';
    this.#startTimeMs = null;
    this.#targetMs = null;
    this.#targetKind = null;
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
    this.#validateTitle(value);
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
   * Optional goal or budget in milliseconds; null when the timer has no target
   */
  get targetMs() {
    return this.#targetMs;
  }

  /**
   * 'goal' or 'budget' while a target is set, otherwise null
   */
  get targetKind() {
    return this.#targetKind;
  }

  /**
   * Sets or clears the target
   * @param {number|null} ms - Positive integer milliseconds, or null to clear
   * @param {'goal'|'budget'} [kind='goal'] - Ignored when clearing
   * @throws {TypeError} If ms is neither null nor an integer, or kind is not a string
   * @throws {RangeError} If ms is not positive or kind is unknown
   */
  setTarget(ms, kind = 'goal') {
    if (ms === null) {
      this.#targetMs = null;
      this.#targetKind = null;
      return;
    }

    Timer.#validateTarget(ms);
    Timer.#validateTargetKind(kind);
    this.#targetMs = ms;
    this.#targetKind = kind;
  }

  /**
   * Whether elapsed time has met the target (reached a goal, or used up a budget);
   * always false without a target
   */
  hasReachedTarget() {
    return this.#targetMs !== null && this.getElapsedMs() >= this.#targetMs;
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
    return formatDuration(this.getElapsedMs());
  }

  /**
   * Convenience method to check if timer is currently running
   */
  isRunning() {
    return this.#state === 'running';
  }

  /**
   * Adds milliseconds to the timer's elapsed time
   * @param {number} ms - Milliseconds to add (must be non-negative)
   * @throws {TypeError} If ms is not a finite number
   * @throws {RangeError} If ms is negative
   */
  addMs(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms)) {
      throw new TypeError('Milliseconds must be a finite number');
    }
    if (ms < 0) {
      throw new RangeError('Amount must be non-negative');
    }
    this.#elapsedMs += ms;
  }

  /**
   * Serializes timer to plain object for storage
   * Running timers are converted to paused to preserve accumulated time
   * @returns {Object}
   */
  toJSON() {
    const currentElapsed = this.getElapsedMs();
    const normalizedState = this.#state === 'running' ? 'paused' : this.#state;

    return {
      id: this.#id,
      title: this.#title,
      elapsedMs: currentElapsed,
      state: normalizedState,
      targetMs: this.#targetMs,
      targetKind: this.#targetKind
    };
  }

  /**
   * Static factory method to create Timer from stored data
   * @param {Object} data - Serialized timer data
   * @returns {Timer}
   * @throws {Error} If data is invalid
   */
  static fromJSON(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid timer data');
    }

    if (!data.id || typeof data.id !== 'string') {
      throw new Error('Timer data must have a valid id');
    }

    if (!data.title || typeof data.title !== 'string') {
      throw new Error('Timer data must have a valid title');
    }

    if (typeof data.elapsedMs !== 'number' || data.elapsedMs < 0) {
      throw new Error('Timer data must have a valid elapsedMs');
    }

    if (!data.state || typeof data.state !== 'string') {
      throw new Error('Timer data must have a valid state');
    }

    if (!Timer.VALID_STATES.includes(data.state)) {
      throw new Error('Timer state must be one of: stopped, paused, running');
    }

    const timer = new Timer(data.title, data.id);
    timer.#elapsedMs = data.elapsedMs;

    // Absent in state saved before goals existed; the kind is absent in state
    // saved before budgets existed, when every target was a goal
    if (data.targetMs !== undefined && data.targetMs !== null) {
      try {
        timer.setTarget(data.targetMs, data.targetKind ?? 'goal');
      } catch (error) {
        throw new Error('Timer data must have a valid targetMs and targetKind');
      }
    }

    // Restore paused state; running is converted to paused since performance.now()
    // baseline cannot be restored across deserialization boundaries
    if (data.state === 'paused' || data.state === 'running') {
      timer.#state = 'paused';
    }

    return timer;
  }
}
