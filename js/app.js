import { TimerManager } from './timerManager.js';

/**
 * App module - Handles DOM initialization, rendering, and event binding
 */
class App {
  constructor() {
    this.timerManager = new TimerManager(2);
    this.timerContainer = document.getElementById('timer-container');
    this.resetAllBtn = document.getElementById('reset-all-btn');
    this.addTimerBtn = document.getElementById('add-timer-btn');
    this.updateInterval = null;
    this.timerElements = new Map();
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

    const timers = this.timerManager.getAllTimers();
    timers.forEach(timer => {
      const timerCard = this.createTimerCard(timer);
      this.timerContainer.appendChild(timerCard);
      this.timerElements.set(timer.id, timerCard);
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
  }

  /**
   * Start the timer display update loop
   */
  startUpdateLoop() {
    this.updateInterval = setInterval(() => {
      this.updateAllTimerDisplays();
    }, 1000);
  }

  /**
   * Update all timer displays
   */
  updateAllTimerDisplays() {
    const timers = this.timerManager.getAllTimers();
    timers.forEach(timer => {
      const card = this.timerElements.get(timer.id);
      if (card) {
        const display = card.querySelector('.timer-display');
        display.textContent = timer.getFormattedTime();

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
      timer.title = newTitle;
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
}

// Initialize app when DOM is ready
console.log('app.js loaded');
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM ready, creating App...');
  const app = new App();
  app.init();
});
