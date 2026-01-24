import { TimerManager } from './timerManager.js';
import IdleDetector from './idleDetector.js';
import AllocationModal from './allocationModal.js';
import { allocateToSingle, allocateDiscard } from './timeDistributor.js';

/**
 * App module - Handles DOM initialization, rendering, and event binding
 */
class App {
  constructor() {
    this.timerManager = new TimerManager();
    this.timerContainer = document.getElementById('timer-container');
    this.resetAllBtn = document.getElementById('reset-all-btn');
    this.addTimerBtn = document.getElementById('add-timer-btn');
    this.updateInterval = null;
    this.timerElements = new Map();
    this.lastDisplayedValues = new Map();
    this.rafId = null;
    this.hiddenRunningTimers = new Set();
    this.idleDetector = new IdleDetector({
      callback: (idleMs) => this.handleIdleReturn(idleMs),
      idleThreshold: 10000
    });
  }

  /**
   * Initialize the application
   */
  init() {
    console.log('App initializing...');
    console.log('Timer container:', this.timerContainer);
    console.log('Initial timers:', this.timerManager.getAllTimers().length);
    this.renderAllTimers();
    this.bindGlobalEvents();
    this.startUpdateLoop();
    console.log('App initialized!');
  }

  /**
   * Renders all timers in the container
   */
  renderAllTimers() {
    this.timerContainer.innerHTML = '';
    this.timerElements.clear();
    this.lastDisplayedValues.clear();

    const timers = this.timerManager.getAllTimers();
    timers.forEach(timer => {
      const timerCard = this.createTimerCard(timer);
      this.timerContainer.appendChild(timerCard);
      this.timerElements.set(timer.id, timerCard);
      this.lastDisplayedValues.set(timer.id, timer.getFormattedTime());
    });

    this.updateAddTimerButton();
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
    document.addEventListener('visibilitychange', () => this.handleVisibilityChange());
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
   * Update all timer displays
   */
  updateAllTimerDisplays() {
    const timers = this.timerManager.getAllTimers();
    timers.forEach(timer => {
      const card = this.timerElements.get(timer.id);
      if (card) {
        const newFormattedTime = timer.getFormattedTime();
        const lastDisplayed = this.lastDisplayedValues.get(timer.id);

        if (newFormattedTime !== lastDisplayed) {
          const display = card.querySelector('.timer-display');
          display.textContent = newFormattedTime;
          this.lastDisplayedValues.set(timer.id, newFormattedTime);
        }

        const toggleBtn = card.querySelector('.btn');
        toggleBtn.className = timer.isRunning() ? 'btn btn-pause' : 'btn btn-start';
        toggleBtn.textContent = timer.isRunning() ? 'Pause' : 'Start';

        if (timer.isRunning()) {
          card.classList.add('active');
        } else {
          card.classList.remove('active');
        }
      }
    });
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
    } catch (error) {
      input.value = timer.title;
      alert(error.message);
    }
  }

  /**
   * Handle reset all timers
   */
  handleResetAll() {
    const timers = this.timerManager.getAllTimers();
    timers.forEach(timer => timer.reset());
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
    this.timerElements.set(newTimer.id, timerCard);
    this.lastDisplayedValues.set(newTimer.id, newTimer.getFormattedTime());

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
   * Pauses running timers when page becomes hidden and resumes them when visible
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
    } else {
      // Check if idle duration is below threshold - if so, auto-resume
      // If above threshold, IdleDetector will call handleIdleReturn
      const hiddenAtStr = localStorage.getItem('idle_detector_hidden_at');
      if (hiddenAtStr) {
        const hiddenAt = parseInt(hiddenAtStr, 10);
        const idleDuration = Date.now() - hiddenAt;

        // If idle <= threshold, auto-resume (IdleDetector won't trigger)
        if (idleDuration <= 10000) {
          this.hiddenRunningTimers.forEach(timerId => {
            this.timerManager.startTimer(timerId);
          });
          this.hiddenRunningTimers.clear();
        }
        // If idle > threshold, IdleDetector will handle via handleIdleReturn callback
      } else {
        // No idle tracking, just resume
        this.hiddenRunningTimers.forEach(timerId => {
          this.timerManager.startTimer(timerId);
        });
        this.hiddenRunningTimers.clear();
      }

      this.updateAllTimerDisplays();
    }
  }

  /**
   * Handle return from idle period
   * Shows modal for time allocation if idle duration exceeds threshold
   * @param {number} idleMs - Idle duration in milliseconds
   */
  async handleIdleReturn(idleMs) {
    const timers = this.timerManager.getAllTimers();
    const previousRunningId = this.hiddenRunningTimers.size > 0
      ? Array.from(this.hiddenRunningTimers)[0]
      : null;

    // Show allocation modal
    const modal = new AllocationModal(idleMs, timers, previousRunningId);
    const result = await modal.show();

    // Apply allocation based on strategy
    let allocations = new Map();

    switch (result.strategy) {
      case 'previous-timer':
        if (previousRunningId) {
          allocations = allocateToSingle(idleMs, previousRunningId);
        }
        break;

      case 'selected-timer':
        if (result.config.timerId) {
          allocations = allocateToSingle(idleMs, result.config.timerId);
        }
        break;

      case 'fixed-distribution':
        // TODO: Implement when modal supports fixed distribution config
        break;

      case 'percentage-distribution':
        // TODO: Implement when modal supports percentage distribution config
        break;

      case 'discard':
      default:
        // No allocation
        allocations = allocateDiscard();
        break;
    }

    // Apply allocations to timers
    if (allocations.size > 0) {
      this.timerManager.distributeTime(allocations);
    }

    // Resume previously running timer if it still exists
    if (previousRunningId && this.timerManager.getTimer(previousRunningId)) {
      this.timerManager.startTimer(previousRunningId);
    }

    // Clear tracking and update displays
    this.hiddenRunningTimers.clear();
    this.updateAllTimerDisplays();
  }
}

// Initialize app when DOM is ready
console.log('app.js loaded');
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready, creating App...');
  const app = new App();
  app.init();
});
