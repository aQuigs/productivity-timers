import { TimerManager } from './timerManager.js';
import IdleDetector, { DEFAULT_IDLE_THRESHOLD_MS } from './idleDetector.js';
import AllocationModal from './allocationModal.js';
import { allocateToSingle, allocateDiscard, allocateFixed, allocatePercentage } from './timeDistributor.js';

const HIDDEN_RUNNING_TIMERS_KEY = 'app_hidden_running_timers';
const PENDING_PREVIOUS_TIMER_KEY = 'pending_idle_previous_timer';
const ACCUMULATED_IDLE_KEY = 'accumulated_idle_ms';

/**
 * App module - Handles DOM initialization, rendering, and event binding
 */
export class App {
  constructor() {
    this.timerManager = new TimerManager();
    this.timerContainer = document.getElementById('timer-container');
    this.resetAllBtn = document.getElementById('reset-all-btn');
    this.addTimerBtn = document.getElementById('add-timer-btn');
    this.timerElements = new Map();
    this.lastDisplayedValues = new Map();
    this.lastRenderedRunning = new Map();
    this.rafId = null;
    this.boundHandleVisibilityChange = null;
    this.allocationInProgress = false;
    this.idleThreshold = DEFAULT_IDLE_THRESHOLD_MS;

    this.hiddenRunningTimers = this.#loadHiddenRunningTimers();

    // Constructed last: its initial checkIdle() can call handleIdleReturn() synchronously
    this.idleDetector = new IdleDetector({
      callback: (idleMs) => this.handleIdleReturn(idleMs),
      idleThreshold: this.idleThreshold
    });
  }

  /**
   * Initialize the application
   */
  init() {
    this.renderAllTimers();
    this.bindGlobalEvents();
    this.startUpdateLoop();
    this.checkPendingIdle();

    if (document.hidden) {
      // Loaded in a background tab: no visibilitychange fires for the initial state
      this.handleVisibilityChange();
    }
  }

  /**
   * Tear down timers and document-level listeners (used by tests)
   */
  destroy() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    if (this.boundHandleVisibilityChange) {
      document.removeEventListener('visibilitychange', this.boundHandleVisibilityChange);
    }
    this.idleDetector.destroy();
  }

  #loadHiddenRunningTimers() {
    try {
      const saved = localStorage.getItem(HIDDEN_RUNNING_TIMERS_KEY);
      const ids = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(ids) ? ids : []);
    } catch (error) {
      console.warn('Ignoring corrupted hidden-timer state:', error);
      return new Set();
    }
  }

  /**
   * Handle idle time and paused timers left over from before this page load
   */
  checkPendingIdle() {
    const idleMs = parseInt(localStorage.getItem(ACCUMULATED_IDLE_KEY) || '0', 10);
    const pendingPreviousTimer = localStorage.getItem(PENDING_PREVIOUS_TIMER_KEY);

    // Unloading fires visibilitychange -> hidden, which pauses the running timer; after a
    // quick refresh there is no accumulated idle time but the timer still needs resuming
    if (idleMs > 0 || this.hiddenRunningTimers.size > 0) {
      this.handleIdleReturn(idleMs, pendingPreviousTimer);
    }
  }

  /**
   * Renders all timers in the container
   */
  renderAllTimers() {
    this.timerContainer.innerHTML = '';
    this.timerElements.clear();
    this.lastDisplayedValues.clear();
    this.lastRenderedRunning.clear();

    const timers = this.timerManager.getAllTimers();
    timers.forEach(timer => {
      const timerCard = this.createTimerCard(timer);
      this.timerContainer.appendChild(timerCard);
      this.#trackCard(timer, timerCard);
    });

    this.updateAddTimerButton();
  }

  #trackCard(timer, card) {
    this.timerElements.set(timer.id, card);
    this.lastDisplayedValues.set(timer.id, timer.getFormattedTime());
    this.lastRenderedRunning.set(timer.id, timer.isRunning());
  }

  /**
   * Creates a timer card DOM element
   * @param {Timer} timer - Timer instance
   * @returns {HTMLElement} Timer card element
   */
  createTimerCard(timer) {
    const card = document.createElement('div');
    card.className = 'timer-card';
    card.dataset.timerId = timer.id;
    card.classList.toggle('active', timer.isRunning());

    const header = document.createElement('div');
    header.className = 'timer-header';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'timer-title';
    titleInput.value = timer.title;
    titleInput.maxLength = 50;
    titleInput.addEventListener('blur', () => this.handleTitleChange(timer, titleInput));
    titleInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        titleInput.blur();
      }
    });

    const removeBtn = document.createElement('button');
    removeBtn.className = 'timer-remove';
    removeBtn.textContent = '×';
    removeBtn.disabled = this.timerManager.getAllTimers().length <= 1;
    removeBtn.addEventListener('click', () => this.handleRemoveTimer(timer.id));

    header.appendChild(titleInput);
    header.appendChild(removeBtn);

    const display = document.createElement('div');
    display.className = 'timer-display';
    display.textContent = timer.getFormattedTime();

    const controls = document.createElement('div');
    controls.className = 'timer-controls';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = timer.isRunning() ? 'btn btn-pause' : 'btn btn-start';
    toggleBtn.textContent = timer.isRunning() ? 'Pause' : 'Start';
    toggleBtn.addEventListener('click', () => this.handleToggleTimer(timer.id));

    controls.appendChild(toggleBtn);

    card.appendChild(header);
    card.appendChild(display);
    card.appendChild(controls);

    return card;
  }

  /**
   * Bind global event listeners
   */
  bindGlobalEvents() {
    this.resetAllBtn.addEventListener('click', () => this.handleResetAll());
    this.addTimerBtn.addEventListener('click', () => this.handleAddTimer());
    this.boundHandleVisibilityChange = () => this.handleVisibilityChange();
    document.addEventListener('visibilitychange', this.boundHandleVisibilityChange);
  }

  /**
   * Start the timer display update loop
   */
  startUpdateLoop() {
    const updateFrame = () => {
      this.updateAllTimerDisplays();
      this.rafId = requestAnimationFrame(updateFrame);
    };
    this.rafId = requestAnimationFrame(updateFrame);
  }

  /**
   * Update all timer displays, touching the DOM only where something changed
   */
  updateAllTimerDisplays() {
    const timers = this.timerManager.getAllTimers();
    let runningTimerTicked = false;

    timers.forEach(timer => {
      const card = this.timerElements.get(timer.id);
      if (!card) {
        return;
      }

      const running = timer.isRunning();

      const newFormattedTime = timer.getFormattedTime();
      if (newFormattedTime !== this.lastDisplayedValues.get(timer.id)) {
        card.querySelector('.timer-display').textContent = newFormattedTime;
        this.lastDisplayedValues.set(timer.id, newFormattedTime);
        if (running) {
          runningTimerTicked = true;
        }
      }

      if (running !== this.lastRenderedRunning.get(timer.id)) {
        const toggleBtn = card.querySelector('.btn');
        toggleBtn.className = running ? 'btn btn-pause' : 'btn btn-start';
        toggleBtn.textContent = running ? 'Pause' : 'Start';
        card.classList.toggle('active', running);
        this.lastRenderedRunning.set(timer.id, running);
      }
    });

    if (runningTimerTicked) {
      // Elapsed time is otherwise only saved on state changes, so a crash would
      // lose everything tracked since the last click
      this.timerManager.persist();
    }
  }

  /**
   * Handle timer toggle (start/pause)
   * @param {string} timerId - ID of timer to toggle
   */
  handleToggleTimer(timerId) {
    const timer = this.timerManager.getTimer(timerId);
    if (!timer) return;

    if (timer.isRunning()) {
      this.timerManager.pauseTimer(timerId);
    } else {
      this.timerManager.startTimer(timerId);
    }

    this.updateAllTimerDisplays();
  }

  /**
   * Handle title change
   * @param {Timer} timer - Timer instance
   * @param {HTMLInputElement} input - Title input element
   */
  handleTitleChange(timer, input) {
    const newTitle = input.value.trim();
    if (newTitle.length === 0) {
      input.value = timer.title;
      return;
    }

    try {
      this.timerManager.updateTimerTitle(timer.id, newTitle);
      input.value = newTitle;
    } catch (error) {
      input.value = timer.title;
      alert(error.message);
    }
  }

  /**
   * Handle reset all timers
   */
  handleResetAll() {
    this.timerManager.resetAll();
    this.updateAllTimerDisplays();
  }

  /**
   * Handle add timer
   */
  handleAddTimer() {
    const timers = this.timerManager.getAllTimers();
    if (timers.length >= 20) {
      alert('Maximum 20 timers allowed');
      return;
    }

    const newTimer = this.timerManager.addTimer();
    const timerCard = this.createTimerCard(newTimer);
    this.timerContainer.appendChild(timerCard);
    this.#trackCard(newTimer, timerCard);

    this.updateRemoveButtons();
    this.updateAddTimerButton();
  }

  /**
   * Handle remove timer
   * @param {string} timerId - ID of timer to remove
   */
  handleRemoveTimer(timerId) {
    if (this.timerManager.getAllTimers().length <= 1) {
      alert('Cannot remove the last timer');
      return;
    }

    const success = this.timerManager.removeTimer(timerId);
    if (success) {
      const card = this.timerElements.get(timerId);
      if (card) {
        card.remove();
        this.timerElements.delete(timerId);
        this.lastDisplayedValues.delete(timerId);
        this.lastRenderedRunning.delete(timerId);
      }

      this.updateRemoveButtons();
      this.updateAddTimerButton();
    }
  }

  /**
   * Update remove buttons state
   */
  updateRemoveButtons() {
    const timers = this.timerManager.getAllTimers();
    const disabled = timers.length <= 1;

    timers.forEach(timer => {
      const card = this.timerElements.get(timer.id);
      if (card) {
        const removeBtn = card.querySelector('.timer-remove');
        removeBtn.disabled = disabled;
      }
    });
  }

  /**
   * Update add timer button state
   */
  updateAddTimerButton() {
    const timers = this.timerManager.getAllTimers();
    this.addTimerBtn.disabled = timers.length >= 20;
  }

  /**
   * Handle page visibility changes
   * Pauses running timers when the page becomes hidden; on return, either resumes
   * them (short absence) or leaves them paused for the allocation modal
   */
  handleVisibilityChange() {
    if (document.hidden) {
      const timers = this.timerManager.getAllTimers();
      this.hiddenRunningTimers.clear();

      timers.forEach(timer => {
        if (timer.isRunning()) {
          this.hiddenRunningTimers.add(timer.id);
          this.timerManager.pauseTimer(timer.id);
        }
      });

      localStorage.setItem(HIDDEN_RUNNING_TIMERS_KEY, JSON.stringify(Array.from(this.hiddenRunningTimers)));

      if (this.hiddenRunningTimers.size > 0) {
        localStorage.setItem(PENDING_PREVIOUS_TIMER_KEY, Array.from(this.hiddenRunningTimers)[0]);
      }
      return;
    }

    // Fold the hidden gap in here rather than relying on IdleDetector's own listener
    // having run first; checkIdle() is a no-op if it already has
    const accumulated = this.idleDetector.checkIdle();
    if (accumulated <= this.idleThreshold && !this.allocationInProgress) {
      this.handleResume();
    }
  }

  /**
   * Resume timers paused by a hidden period that is too short to allocate
   */
  handleResume() {
    this.hiddenRunningTimers.forEach(timerId => {
      this.timerManager.startTimer(timerId);
    });
    this.hiddenRunningTimers.clear();
    localStorage.removeItem(HIDDEN_RUNNING_TIMERS_KEY);
    localStorage.removeItem(PENDING_PREVIOUS_TIMER_KEY);
    this.idleDetector.clearAccumulatedIdle();
    this.updateAllTimerDisplays();
  }

  /**
   * Handle return from idle period
   * Shows modal for time allocation if idle duration exceeds threshold
   * Otherwise just resumes timers
   * @param {number} idleMs - Idle duration in milliseconds (accumulated)
   * @param {string|null} overridePreviousTimerId - Optional override from pending idle restore
   */
  async handleIdleReturn(idleMs, overridePreviousTimerId = null) {
    // An open modal already tracks further idle time itself; a second modal would
    // allocate the same period twice
    if (this.allocationInProgress) {
      return;
    }

    if (idleMs <= this.idleThreshold) {
      this.handleResume();
      return;
    }

    this.allocationInProgress = true;

    const runningTimer = this.timerManager.getRunningTimer();
    const previousRunningId = overridePreviousTimerId
      || (this.hiddenRunningTimers.size > 0 ? Array.from(this.hiddenRunningTimers)[0] : null)
      || localStorage.getItem(PENDING_PREVIOUS_TIMER_KEY)
      || (runningTimer ? runningTimer.id : null);

    if (previousRunningId) {
      localStorage.setItem(PENDING_PREVIOUS_TIMER_KEY, previousRunningId);
    }

    try {
      const modal = new AllocationModal(idleMs, this.timerManager.getAllTimers(), previousRunningId);
      const result = await modal.show();
      const allocations = this.buildAllocations(result, previousRunningId);
      if (allocations.size > 0) {
        this.timerManager.distributeTime(allocations);
      }
    } catch (error) {
      console.error('Failed to allocate idle time:', error);
    } finally {
      if (previousRunningId && this.timerManager.getTimer(previousRunningId)) {
        this.timerManager.startTimer(previousRunningId);
      }

      this.hiddenRunningTimers.clear();
      localStorage.removeItem(HIDDEN_RUNNING_TIMERS_KEY);
      localStorage.removeItem(PENDING_PREVIOUS_TIMER_KEY);
      this.idleDetector.clearAccumulatedIdle();
      this.allocationInProgress = false;
      this.updateAllTimerDisplays();
    }
  }

  /**
   * Translate the modal's selection into per-timer allocations
   * @param {{strategy: string, config: Object, idleMs: number}} result - Modal result
   * @param {string|null} previousRunningId - Timer that was running before the idle period
   * @returns {Map<string, number>}
   */
  buildAllocations(result, previousRunningId) {
    // The modal keeps counting idle time while open; allocate what it last showed
    const idleMs = result.idleMs;

    switch (result.strategy) {
      case 'previous-timer':
        return previousRunningId ? allocateToSingle(idleMs, previousRunningId) : allocateDiscard();

      case 'selected-timer':
        return result.config.timerId ? allocateToSingle(idleMs, result.config.timerId) : allocateDiscard();

      case 'fixed-distribution':
        return allocateFixed(idleMs, result.config.allocations, result.config.remainderTimerId);

      case 'percentage-distribution':
        return allocatePercentage(idleMs, result.config.percentages, result.config.remainderTimerId);

      case 'discard':
      default:
        return allocateDiscard();
    }
  }
}
