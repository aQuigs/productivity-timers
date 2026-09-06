import { TimerManager } from './timerManager.js';
import IdleDetector, { DEFAULT_IDLE_THRESHOLD_MS } from './idleDetector.js';
import AllocationModal from './allocationModal.js';
import { allocateToSingle, allocateDiscard, allocateFixed, allocatePercentage } from './timeDistributor.js';
import { formatDuration } from './formatDuration.js';
import { parseDuration } from './parseDuration.js';
import { createNotifier } from './notifier.js';
import { namespacedKey } from './storageNamespace.js';

const HIDDEN_RUNNING_TIMERS_KEY = 'app_hidden_running_timers';
const GOAL_PLACEHOLDER = '25m, 2h, 1:30';
const GOAL_ERROR_MESSAGE = "Couldn't read that time. Try 25m, 1h 30m or 1:30";

// A goal is a minimum to reach, a budget a maximum not to exceed; the same
// progress machinery drives both, only the words and colours differ
const TARGET_KINDS = {
  goal: {
    label: 'Goal',
    progressLabel: 'Progress toward goal',
    notificationTitle: 'Goal reached',
    notificationVerb: 'hit'
  },
  budget: {
    label: 'Budget',
    progressLabel: 'Budget used',
    notificationTitle: 'Budget exceeded',
    notificationVerb: 'passed'
  }
};

// A budget bar keeps the accent colour through the first half, then warms
// toward red so the colour alone says how close the limit is
const BUDGET_HEAT_START_PERCENT = 50;

const STATE_LABELS = {
  running: 'Running',
  paused: 'Paused',
  stopped: ''
};

const REORDER_KEY_DELTAS = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1
};

/**
 * App module - Handles DOM initialization, rendering, and event binding
 */
export class App {
  /**
   * @param {Object} [options]
   * @param {{ requestPermission: Function, notify: Function }} [options.notifier] - Replaces the
   *   browser Notification wrapper (tests inject a fake)
   */
  constructor({ notifier } = {}) {
    this.timerManager = new TimerManager();
    this.notifier = notifier || createNotifier();
    this.timerContainer = document.getElementById('timer-container');
    this.resetAllBtn = document.getElementById('reset-all-btn');
    this.addTimerBtn = document.getElementById('add-timer-btn');
    this.totalTimeEl = document.getElementById('total-time');
    this.timerElements = new Map();
    this.lastDisplayedValues = new Map();
    this.lastDisplayedStates = new Map();
    this.lastDisplayedGoals = new Map();
    // Timers currently at or past their goal; a crossing notifies once until the
    // timer drops back below (reset, or a goal raised above the elapsed time)
    this.goalReachedTimers = new Set();
    this.lastDisplayedTotal = null;
    this.rafId = null;
    this.draggingCard = null;
    // The goal editor whose controls the pointer last went down on, if any; a tap
    // there blurs the input without a relatedTarget, and this tells that apart
    // from a tap elsewhere
    this.pointerDownEditor = null;
    this.handlePointerDown = (e) => {
      this.pointerDownEditor = e.target instanceof Element ? e.target.closest('.timer-goal-editor') : null;
    };
    this.allocationInProgress = false;
    this.idleThreshold = DEFAULT_IDLE_THRESHOLD_MS;
    this.hiddenRunningTimersKey = namespacedKey(HIDDEN_RUNNING_TIMERS_KEY);
    this.hiddenRunningTimers = this.#loadHiddenRunningTimers();

    this.idleDetector = new IdleDetector({
      idleThreshold: this.idleThreshold,
      onInactive: () => this.handleInactive(),
      onActive: (idleMs) => this.handleIdleReturn(idleMs)
    });
  }

  /**
   * Initialize the application
   */
  init() {
    this.renderAllTimers();
    this.bindGlobalEvents();
    this.startUpdateLoop();

    if (this.idleDetector.isActive()) {
      // Unloading fires visibilitychange -> hidden, so after a refresh the running timer
      // is paused and waiting here, possibly together with idle time to allocate
      this.handleIdleReturn(this.idleDetector.checkIdle());
    } else {
      // Loaded in a background tab or unfocused window: no event fires for the initial state
      this.handleInactive();
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
    document.removeEventListener('pointerdown', this.handlePointerDown, true);
    this.idleDetector.destroy();
  }

  #loadHiddenRunningTimers() {
    try {
      const saved = localStorage.getItem(this.hiddenRunningTimersKey);
      const ids = saved ? JSON.parse(saved) : [];
      return new Set(Array.isArray(ids) ? ids : []);
    } catch (error) {
      console.warn('Ignoring corrupted hidden-timer state:', error);
      return new Set();
    }
  }

  #saveHiddenRunningTimers() {
    localStorage.setItem(this.hiddenRunningTimersKey, JSON.stringify(Array.from(this.hiddenRunningTimers)));
  }

  /**
   * Renders all timers in the container
   */
  renderAllTimers() {
    this.timerContainer.innerHTML = '';
    this.timerElements.clear();
    this.lastDisplayedValues.clear();
    this.lastDisplayedStates.clear();
    this.lastDisplayedGoals.clear();
    this.goalReachedTimers.clear();

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
    // A timer restored past its goal was already announced before the reload
    this.#syncGoalReached(timer, timer.hasReachedTarget(), false);
  }

  #forgetCard(timerId) {
    this.timerElements.delete(timerId);
    this.lastDisplayedValues.delete(timerId);
    this.lastDisplayedStates.delete(timerId);
    this.lastDisplayedGoals.delete(timerId);
    this.goalReachedTimers.delete(timerId);
  }

  /**
   * Keeps goalReachedTimers in step with the timer and notifies on a fresh crossing
   * @param {Timer} timer
   * @param {boolean} reached
   * @param {boolean} notify - false when the state is being adopted rather than crossed
   */
  #syncGoalReached(timer, reached, notify) {
    if (!reached) {
      this.goalReachedTimers.delete(timer.id);
      return;
    }
    if (this.goalReachedTimers.has(timer.id)) {
      return;
    }

    this.goalReachedTimers.add(timer.id);
    if (notify) {
      const { notificationTitle, notificationVerb } = TARGET_KINDS[timer.targetKind];
      this.notifier.notify(notificationTitle, `${timer.title} ${notificationVerb} ${formatDuration(timer.targetMs)}`);
    }
  }

  #goalProgress(timer, elapsedMs) {
    const target = timer.targetMs;
    const kind = timer.targetKind;
    if (target === null) {
      return { target, kind, percent: 0, reached: false, over: '' };
    }
    const reached = elapsedMs >= target;
    return {
      target,
      kind,
      percent: Math.min(100, Math.floor((elapsedMs / target) * 100)),
      reached,
      over: reached ? formatDuration(elapsedMs - target) : ''
    };
  }

  #goalKey({ target, kind, percent, reached, over }) {
    return `${target}:${kind}:${percent}:${reached}:${over}`;
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

    // A span rather than a <button>: Firefox refuses to start a drag from a form control
    const dragHandle = document.createElement('span');
    dragHandle.className = 'timer-drag-handle';
    dragHandle.setAttribute('role', 'button');
    dragHandle.tabIndex = 0;
    dragHandle.title = 'Drag to reorder';
    dragHandle.setAttribute('aria-label', 'Drag to reorder');
    // The card is only draggable while the handle is held, otherwise dragging
    // inside the title input would move the card instead of selecting text
    dragHandle.addEventListener('pointerdown', () => { card.draggable = true; });
    dragHandle.addEventListener('pointerup', () => { card.draggable = false; });
    dragHandle.addEventListener('keydown', (e) => this.handleReorderKey(e, timer.id));

    card.addEventListener('dragstart', (e) => this.handleDragStart(e, card));
    card.addEventListener('dragend', (e) => this.handleDragEnd(e, card));

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

    header.appendChild(dragHandle);
    header.appendChild(titleInput);
    header.appendChild(removeBtn);

    const display = document.createElement('div');
    display.className = 'timer-display';
    display.textContent = timer.getFormattedTime();

    const goal = document.createElement('div');
    goal.className = 'timer-goal';

    const goalBtn = document.createElement('button');
    goalBtn.type = 'button';
    goalBtn.className = 'timer-goal-btn';
    goalBtn.addEventListener('click', () => this.openGoalEditor(card, timer));

    const editor = document.createElement('div');
    editor.className = 'timer-goal-editor';
    editor.hidden = true;

    const goalInput = document.createElement('input');
    goalInput.type = 'text';
    goalInput.className = 'timer-goal-input';
    goalInput.placeholder = GOAL_PLACEHOLDER;
    goalInput.spellcheck = false;
    goalInput.setAttribute('aria-label', 'Goal or budget duration');
    goalInput.addEventListener('input', () => this.#clearGoalError(card));

    const kindGroup = document.createElement('div');
    kindGroup.className = 'timer-goal-kind';
    kindGroup.setAttribute('role', 'radiogroup');
    kindGroup.setAttribute('aria-label', 'Goal or budget');
    // A mouse click on an option would otherwise blur the input and apply the
    // edit before the new kind is read
    kindGroup.addEventListener('mousedown', (e) => e.preventDefault());
    // A tap on a touch screen still moves focus off the input, closing the
    // on-screen keyboard mid-edit. Arrow keys change the kind without a click,
    // so keyboard users keep their place on the radio
    kindGroup.addEventListener('click', () => goalInput.focus());
    Object.entries(TARGET_KINDS).forEach(([kind, { label }]) => {
      const option = document.createElement('label');
      option.className = 'timer-goal-kind-option';

      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = `goal-kind-${timer.id}`;
      radio.value = kind;
      radio.checked = kind === (timer.targetKind ?? 'goal');

      const text = document.createElement('span');
      text.textContent = label;

      option.appendChild(radio);
      option.appendChild(text);
      kindGroup.appendChild(option);
    });

    editor.appendChild(kindGroup);
    editor.appendChild(goalInput);
    editor.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // Unreadable text keeps the editor open, so focus must stay where the fix is typed
        if (this.commitGoalEdit(card, timer)) {
          goalBtn.focus();
        }
      } else if (e.key === 'Escape') {
        this.closeGoalEditor(card);
        goalBtn.focus();
      }
    });
    editor.addEventListener('focusout', (e) => {
      // Enter and Escape hide the editor before focus moves
      if (editor.hidden) {
        return;
      }
      // Moving between the editor's own controls is not leaving it. A tap on the
      // kind toggle on a touch screen blurs the input with no relatedTarget
      // before the radio changes, so there the pointer's position stands in
      const stillInside = e.relatedTarget
        ? editor.contains(e.relatedTarget)
        : this.pointerDownEditor === editor;
      if (!stillInside) {
        this.commitGoalEdit(card, timer);
      }
    });

    const goalError = document.createElement('p');
    goalError.className = 'timer-goal-error';
    goalError.id = `goal-error-${timer.id}`;
    goalError.setAttribute('role', 'alert');
    goalError.hidden = true;

    const progress = document.createElement('div');
    progress.className = 'timer-progress';
    progress.setAttribute('role', 'progressbar');
    progress.setAttribute('aria-label', 'Progress toward goal');
    progress.setAttribute('aria-valuemin', '0');
    progress.setAttribute('aria-valuemax', '100');

    const progressBar = document.createElement('div');
    progressBar.className = 'timer-progress-bar';
    progress.appendChild(progressBar);

    goal.appendChild(goalBtn);
    goal.appendChild(editor);
    goal.appendChild(goalError);
    goal.appendChild(progress);

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
    card.appendChild(goal);
    card.appendChild(controls);

    this.applyTimerState(card, timer);
    this.applyGoalState(card, timer);

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
   * Syncs a card's target chip, progress bar and reached/exceeded visuals with its timer
   * @param {HTMLElement} card
   * @param {Timer} timer
   * @param {{target: number|null, kind: string|null, percent: number, reached: boolean, over: string}} [progress]
   *   `over` is the formatted time past the target, empty until it is reached
   */
  applyGoalState(card, timer, progress = this.#goalProgress(timer, timer.getElapsedMs())) {
    const { target, kind, percent, reached, over } = progress;
    const hasTarget = target !== null;
    const words = hasTarget ? TARGET_KINDS[kind] : null;

    const goalBtn = card.querySelector('.timer-goal-btn');
    goalBtn.classList.toggle('is-set', hasTarget);
    goalBtn.textContent = hasTarget
      ? `${words.label} ${formatDuration(target)}${reached ? ` · ${over} over` : ''}`
      : 'Set goal or budget';
    goalBtn.title = hasTarget ? `Edit ${words.label.toLowerCase()}` : 'Set a goal or budget for this timer';

    const progressEl = card.querySelector('.timer-progress');
    progressEl.hidden = !hasTarget;
    if (hasTarget) {
      progressEl.setAttribute('aria-label', words.progressLabel);
    }
    progressEl.setAttribute('aria-valuenow', String(percent));
    if (reached) {
      progressEl.setAttribute('aria-valuetext', `${over} over ${kind}`);
    } else {
      progressEl.removeAttribute('aria-valuetext');
    }

    const bar = card.querySelector('.timer-progress-bar');
    bar.style.width = `${percent}%`;
    if (kind === 'budget') {
      const heat = Math.max(0, percent - BUDGET_HEAT_START_PERCENT) * (100 / (100 - BUDGET_HEAT_START_PERCENT));
      bar.style.setProperty('--budget-heat', `${heat}%`);
    } else {
      bar.style.removeProperty('--budget-heat');
    }

    card.classList.toggle('over-target', reached && kind === 'goal');
    card.classList.toggle('over-budget', reached && kind === 'budget');
    this.lastDisplayedGoals.set(timer.id, this.#goalKey(progress));
  }

  /**
   * Swap the chip for the editor, preselecting the current kind and prefilling the time
   * @param {HTMLElement} card
   * @param {Timer} timer
   */
  openGoalEditor(card, timer) {
    const goalBtn = card.querySelector('.timer-goal-btn');
    const editor = card.querySelector('.timer-goal-editor');
    const goalInput = card.querySelector('.timer-goal-input');

    const kind = timer.targetKind ?? 'goal';
    card.querySelector(`.timer-goal-kind input[value="${kind}"]`).checked = true;
    goalInput.value = timer.targetMs === null ? '' : formatDuration(timer.targetMs);
    goalBtn.hidden = true;
    editor.hidden = false;
    goalInput.focus();
    goalInput.select();
  }

  /**
   * Hide the editor and show the chip again without applying anything
   * @param {HTMLElement} card
   */
  closeGoalEditor(card) {
    this.#clearGoalError(card);
    card.querySelector('.timer-goal-editor').hidden = true;
    card.querySelector('.timer-goal-btn').hidden = false;
  }

  #showGoalError(card) {
    const goalInput = card.querySelector('.timer-goal-input');
    const goalError = card.querySelector('.timer-goal-error');

    goalInput.classList.add('is-invalid');
    goalInput.setAttribute('aria-invalid', 'true');
    goalInput.setAttribute('aria-describedby', goalError.id);
    // Filling the alert's text here, rather than at build time, is what makes
    // screen readers announce it
    goalError.textContent = GOAL_ERROR_MESSAGE;
    goalError.hidden = false;
  }

  #clearGoalError(card) {
    const goalInput = card.querySelector('.timer-goal-input');
    const goalError = card.querySelector('.timer-goal-error');

    goalInput.classList.remove('is-invalid');
    goalInput.removeAttribute('aria-invalid');
    goalInput.removeAttribute('aria-describedby');
    goalError.textContent = '';
    goalError.hidden = true;
  }

  /**
   * Apply whatever is in the goal input and close the editor; unreadable text
   * instead keeps the editor open with an error
   * @param {HTMLElement} card
   * @param {Timer} timer
   * @returns {boolean} true if the editor was closed
   */
  commitGoalEdit(card, timer) {
    const kind = card.querySelector('.timer-goal-kind input:checked').value;
    const applied = this.handleGoalChange(timer, card.querySelector('.timer-goal-input').value, kind);
    if (!applied) {
      this.#showGoalError(card);
      return false;
    }

    this.closeGoalEditor(card);
    this.applyGoalState(card, timer);
    return true;
  }

  /**
   * Handle target text entered by the user: empty clears the target
   * @param {Timer} timer
   * @param {string} text
   * @param {'goal'|'budget'} [kind='goal']
   * @returns {boolean} false when the text could not be read, leaving the target unchanged
   */
  handleGoalChange(timer, text, kind = 'goal') {
    const trimmed = text.trim();

    if (trimmed.length === 0) {
      this.timerManager.setTimerTarget(timer.id, null);
    } else {
      const targetMs = parseDuration(trimmed);
      if (targetMs === null) {
        return false;
      }
      this.timerManager.setTimerTarget(timer.id, targetMs, kind);
      // Asking here, on the user's own action, is what browsers expect
      this.notifier.requestPermission();
    }

    // A target set below the elapsed time was never crossed, so adopt it silently
    this.#syncGoalReached(timer, timer.hasReachedTarget(), false);
    return true;
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
    this.timerContainer.addEventListener('dragover', (e) => this.handleDragOver(e));
    this.timerContainer.addEventListener('drop', (e) => this.handleDrop(e));
    document.addEventListener('pointerdown', this.handlePointerDown, true);
  }

  /**
   * Begin dragging a card
   * @param {DragEvent} event
   * @param {HTMLElement} card
   */
  handleDragStart(event, card) {
    // Text dragged out of the title input also fires dragstart, bubbling up from the input
    if (event.target !== card) return;

    this.draggingCard = card;
    card.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
    // Firefox only starts a drag once some data has been set
    event.dataTransfer.setData('text/plain', card.dataset.timerId);
  }

  /**
   * Move the dragged card relative to the card under the pointer
   * @param {DragEvent} event
   */
  handleDragOver(event) {
    const dragging = this.draggingCard;
    if (!dragging) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const target = event.target.closest('.timer-card');
    if (!target || target === dragging) return;

    // Swapping with the card under the pointer leaves the pointer over the dragged
    // card itself, so the grid settles instead of flickering between two positions
    const targetIsEarlier = Boolean(target.compareDocumentPosition(dragging) & Node.DOCUMENT_POSITION_FOLLOWING);
    if (targetIsEarlier) {
      target.before(dragging);
    } else {
      target.after(dragging);
    }
  }

  /**
   * Accept the drop; the order is committed from the DOM
   * @param {DragEvent} event
   */
  handleDrop(event) {
    event.preventDefault();
    this.commitCardOrder();
  }

  /**
   * Finish a drag, whether it was dropped or cancelled
   * @param {DragEvent} event
   * @param {HTMLElement} card
   */
  handleDragEnd(event, card) {
    if (event.target !== card) return;

    card.classList.remove('dragging');
    card.draggable = false;
    this.draggingCard = null;
    // A cancelled drag has already rearranged the DOM during dragover
    this.commitCardOrder();
  }

  /**
   * Apply the container's current card order to the TimerManager
   */
  commitCardOrder() {
    const ids = Array.from(this.timerContainer.children, card => card.dataset.timerId);
    this.timerManager.reorderTimers(ids);
  }

  /**
   * Keyboard alternative to dragging: arrow keys move the timer one position
   * @param {KeyboardEvent} event
   * @param {string} timerId
   */
  handleReorderKey(event, timerId) {
    const delta = REORDER_KEY_DELTAS[event.key];
    if (!delta) return;

    event.preventDefault();
    this.moveTimerBy(timerId, delta);
  }

  /**
   * Move a timer and its card one position, keeping focus on its handle
   * @param {string} timerId
   * @param {number} direction - 1 moves later, -1 earlier
   */
  moveTimerBy(timerId, direction) {
    const timers = this.timerManager.getAllTimers();
    const fromIndex = timers.findIndex(timer => timer.id === timerId);
    const toIndex = fromIndex + direction;
    if (fromIndex === -1 || toIndex < 0 || toIndex >= timers.length) return;

    const card = this.timerElements.get(timerId);
    if (direction < 0) {
      card.previousElementSibling.before(card);
    } else {
      card.nextElementSibling.after(card);
    }
    this.timerManager.moveTimer(timerId, toIndex);

    // Re-inserting the card drops focus onto the body
    card.querySelector('.timer-drag-handle').focus();
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
      const elapsedMs = timer.getElapsedMs();
      totalMs += elapsedMs;

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

      const progress = this.#goalProgress(timer, elapsedMs);
      this.#syncGoalReached(timer, progress.reached, true);
      if (this.#goalKey(progress) !== this.lastDisplayedGoals.get(timer.id)) {
        this.applyGoalState(card, timer, progress);
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
        this.#forgetCard(timerId);
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
   * Pause running timers while the page is hidden or its window unfocused, and
   * remember which to resume
   */
  handleInactive() {
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
   * Resume the timers paused on going inactive and discard any pending idle time
   */
  handleResume() {
    this.hiddenRunningTimers.forEach(timerId => {
      this.timerManager.startTimer(timerId);
    });
    this.hiddenRunningTimers.clear();
    localStorage.removeItem(this.hiddenRunningTimersKey);
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
    let resumeId = previousRunningId;

    try {
      const modal = new AllocationModal(idleMs, this.timerManager.getAllTimers(), previousRunningId);
      const result = await modal.show();
      // The user's choice of which timer runs next should hold even if allocating fails
      if (result.config.makeRunning && result.config.timerId) {
        resumeId = result.config.timerId;
      }
      const allocations = this.buildAllocations(result);
      if (allocations.size > 0) {
        this.timerManager.distributeTime(allocations);
      }
    } catch (error) {
      console.error('Failed to allocate idle time:', error);
    } finally {
      this.allocationInProgress = false;
      this.hiddenRunningTimers = new Set(resumeId ? [resumeId] : []);
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
