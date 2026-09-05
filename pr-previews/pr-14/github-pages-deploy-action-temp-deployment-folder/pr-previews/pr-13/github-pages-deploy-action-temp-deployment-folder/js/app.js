import { TimerManager } from './timerManager.js';
import IdleDetector, { DEFAULT_IDLE_THRESHOLD_MS } from './idleDetector.js';
import AllocationModal from './allocationModal.js';
import { allocateToSingle, allocateDiscard, allocateFixed, allocatePercentage } from './timeDistributor.js';
import { formatDuration } from './formatDuration.js';

const HIDDEN_RUNNING_TIMERS_KEY = 'app_hidden_running_timers';

const STATE_LABELS = {
  running: 'Running',
  paused: 'Paused',
  stopped: ''
};

/**
 * App module - Handles DOM initialization, rendering, and event binding
 */
export class App {
  constructor() {
    this.timerManager = new TimerManager();
    this.timerContainer = document.getElementById('timer-container');
    this.resetAllBtn = document.getElementById('reset-all-btn');
    this.addTimerBtn = document.getElementById('add-timer-btn');
    this.totalTimeEl = document.getElementById('total-time');
    this.timerElements = new Map();
    this.lastDisplayedValues = new Map();
    this.lastDisplayedStates = new Map();
    this.lastDisplayedTotal = null;
    this.rafId = null;
    this.allocationInProgress = false;
    this.idleThreshold = DEFAULT_IDLE_THRESHOLD_MS;
    this.hiddenRunningTimers = this.#loadHiddenRunningTimers();

    this.idleDetector = new IdleDetector({
      idleThreshold: this.idleThreshold,
      onHidden: () => this.handleHidden(),
      onVisible: (idleMs) => this.handleIdleReturn(idleMs)
    });
  }

  /**
   * Initialize the application
   */
  init() {
    this.renderAllTimers();
    this.bindGlobalEvents();
    this.startUpdateLoop();

    if (document.hidden) {
      // Loaded in a background tab: no visibilitychange fires for the initial state
      this.handleHidden();
    } else {
      // Unloading fires visibilitychange -> hidden, so after a refresh the running timer
      // is paused and waiting here, possibly together with idle time to allocate
      this.handleIdleReturn(this.idleDetector.checkIdle());
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

  #saveHiddenRunningTimers() {
    localStorage.setItem(HIDDEN_RUNNING_TIMERS_KEY, JSON.stringify(Array.from(this.hiddenRunningTimers)));
  }

  /**
   * Renders all timers in the container
   */
  renderAllTimers() {
    this.timerContainer.innerHTML = '';
    this.timerElements.clear();
    this.lastDisplayedValues.clear();
    this.lastDisplayedStates.clear();

    const timers = this.timerManager.getAllTimers();
    timers.forEach(timer => {
      const timerCard = this.createTimerCard(timer);
      this.timerContainer.appendChild(timerCard);
      this.#trackCard(timer, timerCard);
    });

    this.updateAddTimerButton();
    this.updateAllTimerDisplays();
  }

  #trackCard(timer, card) {
    this.timerElements.set(timer.id, card);
    this.lastDisplayedValues.set(timer.id, timer.getFormattedTime());
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

    const header = document.createElement('div');
    header.className = 'timer-header';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'timer-title';
    titleInput.value = timer.title;
    titleInput.maxLength = 50;
    titleInput.spellcheck = false;
    titleInput.setAttribute('aria-label', 'Timer name');
    titleInput.addEventListener('blur', () => this.handleTitleChange(timer, titleInput));
    titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        titleInput.blur();
      }
    });

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'timer-remove';
    removeBtn.textContent = '×';
    removeBtn.title = 'Remove timer';
    removeBtn.setAttribute('aria-label', 'Remove timer');
    removeBtn.disabled = this.timerManager.getAllTimers().length <= 1;
    removeBtn.addEventListener('click', () => this.handleRemoveTimer(timer.id));

    header.appendChild(titleInput);
    header.appendChild(removeBtn);

    const display = document.createElement('div');
    display.className = 'timer-display';
    display.textContent = timer.getFormattedTime();

    const controls = document.createElement('div');
    controls.className = 'timer-controls';

    const state = document.createElement('span');
    state.className = 'timer-state';

    const toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.className = 'btn';
    toggleBtn.addEventListener('click', () => this.handleToggleTimer(timer.id));

    controls.appendChild(state);
    controls.appendChild(toggleBtn);

    card.appendChild(header);
    card.appendChild(display);
    card.appendChild(controls);

    this.applyTimerState(card, timer);

    return card;
  }

  /**
   * Syncs a card's running/paused visuals with its timer's state
   * @param {HTMLElement} card
   * @param {Timer} timer
   */
  applyTimerState(card, timer) {
    const running = timer.isRunning();

    const toggleBtn = card.querySelector('.btn');
    toggleBtn.classList.toggle('btn-pause', running);
    toggleBtn.classList.toggle('btn-start', !running);
    toggleBtn.textContent = running ? 'Pause' : 'Start';

    const state = card.querySelector('.timer-state');
    state.textContent = STATE_LABELS[timer.state] ?? '';
    state.classList.toggle('is-running', running);

    card.classList.toggle('active', running);
    this.lastDisplayedStates.set(timer.id, timer.state);
  }

  /**
   * Updates the header total when it changes
   * @param {number} totalMs
   */
  updateTotalTime(totalMs) {
    if (!this.totalTimeEl) return;

    const formatted = formatDuration(totalMs);
    if (formatted !== this.lastDisplayedTotal) {
      this.totalTimeEl.textContent = formatted;
      this.lastDisplayedTotal = formatted;
    }
  }

  /**
   * Bind global event listeners
   */
  bindGlobalEvents() {
    this.resetAllBtn.addEventListener('click', () => this.handleResetAll());
    this.addTimerBtn.addEventListener('click', () => this.handleAddTimer());
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
    let totalMs = 0;
    let runningTimerTicked = false;

    timers.forEach(timer => {
      totalMs += timer.getElapsedMs();

      const card = this.timerElements.get(timer.id);
      if (!card) return;

      const newFormattedTime = timer.getFormattedTime();
      if (newFormattedTime !== this.lastDisplayedValues.get(timer.id)) {
        card.querySelector('.timer-display').textContent = newFormattedTime;
        this.lastDisplayedValues.set(timer.id, newFormattedTime);
        if (timer.isRunning()) {
          runningTimerTicked = true;
        }
      }

      if (timer.state !== this.lastDisplayedStates.get(timer.id)) {
        this.applyTimerState(card, timer);
      }
    });

    this.updateTotalTime(totalMs);

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
        this.lastDisplayedStates.delete(timerId);
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
   * Pause running timers while the page is hidden and remember which to resume
   */
  handleHidden() {
    const running = this.timerManager.getAllTimers().filter(timer => timer.isRunning());
    running.forEach(timer => this.timerManager.pauseTimer(timer.id));

    // While the allocation modal is open the set still names the timer to resume
    // afterwards, so only replace it when something was actually running
    if (running.length > 0 || !this.allocationInProgress) {
      this.hiddenRunningTimers = new Set(running.map(timer => timer.id));
      this.#saveHiddenRunningTimers();
    }
  }

  /**
   * Resume the timers paused on hide and discard any pending idle time
   */
  handleResume() {
    this.hiddenRunningTimers.forEach(timerId => {
      this.timerManager.startTimer(timerId);
    });
    this.hiddenRunningTimers.clear();
    localStorage.removeItem(HIDDEN_RUNNING_TIMERS_KEY);
    this.idleDetector.clearAccumulatedIdle();
    this.updateAllTimerDisplays();
  }

  /**
   * Handle return from an idle period: resume directly when it is short, otherwise
   * let the user allocate it before resuming
   * @param {number} idleMs - Accumulated idle duration in milliseconds
   */
  async handleIdleReturn(idleMs) {
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

    // Normally the running timer was paused on hide; after a reload the manager may
    // instead have restarted it
    const [pausedOnHide] = this.hiddenRunningTimers;
    const runningTimer = this.timerManager.getRunningTimer();
    const previousRunningId = pausedOnHide || (runningTimer ? runningTimer.id : null);

    try {
      const modal = new AllocationModal(idleMs, this.timerManager.getAllTimers(), previousRunningId);
      const result = await modal.show();
      const allocations = this.buildAllocations(result);
      if (allocations.size > 0) {
        this.timerManager.distributeTime(allocations);
      }
    } catch (error) {
      console.error('Failed to allocate idle time:', error);
    } finally {
      this.allocationInProgress = false;
      this.hiddenRunningTimers = new Set(previousRunningId ? [previousRunningId] : []);
      this.handleResume();
    }
  }

  /**
   * Translate the modal's selection into per-timer allocations
   * @param {{strategy: string, config: Object, idleMs: number}} result - Modal result
   * @returns {Map<string, number>}
   */
  buildAllocations(result) {
    // The modal keeps counting idle time while open; allocate what it last showed
    const idleMs = result.idleMs;

    switch (result.strategy) {
      case 'previous-timer':
      case 'selected-timer':
        return result.config.timerId ? allocateToSingle(idleMs, result.config.timerId) : allocateDiscard();

      case 'fixed-distribution':
        return allocateFixed(idleMs, result.config.allocations, result.config.remainderTimerId);

      case 'percentage-distribution':
        return allocatePercentage(idleMs, result.config.percentages, result.config.remainderTimerId);

      default:
        return allocateDiscard();
    }
  }
}
