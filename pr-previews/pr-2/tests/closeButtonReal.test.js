import { expect } from '@esm-bundle/chai';
import { TimerManager } from '../js/timerManager.js';

describe('Close Button Real Bug Test', () => {
  let container;
  let timerManager;
  let timerContainer;

  beforeEach(async () => {
    // Create the full app structure
    container = document.createElement('div');
    container.innerHTML = `
      <div class="app-container">
        <header>
          <h1>Productivity Timers</h1>
          <p class="subtitle">Chess-clock style time tracking</p>
        </header>
        <div id="timer-container" class="timer-container"></div>
        <div class="controls">
          <button id="reset-all-btn" class="btn btn-secondary">Reset All</button>
          <button id="add-timer-btn" class="btn btn-primary">Add Timer</button>
        </div>
      </div>
    `;
    document.body.appendChild(container);

    // Load CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/styles.css';
    document.head.appendChild(link);

    await new Promise(resolve => {
      link.onload = resolve;
      link.onerror = resolve;
    });

    timerManager = new TimerManager(3);
    timerContainer = document.getElementById('timer-container');
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  function createTimerCard(timer) {
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

    const removeBtn = document.createElement('button');
    removeBtn.className = 'timer-remove';
    removeBtn.textContent = '×';

    header.appendChild(titleInput);
    header.appendChild(removeBtn);

    const display = document.createElement('div');
    display.className = 'timer-display';
    display.textContent = timer.getFormattedTime();

    const controls = document.createElement('div');
    controls.className = 'timer-controls';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-start';
    toggleBtn.textContent = 'Start';

    controls.appendChild(toggleBtn);

    card.appendChild(header);
    card.appendChild(display);
    card.appendChild(controls);

    return card;
  }

  it('should keep close buttons circular when window shrinks with 3 timers', async () => {
    // Add 3 timers
    const timers = timerManager.getAllTimers();
    expect(timers.length).to.equal(3);

    // Render all timer cards
    timers.forEach(timer => {
      const card = createTimerCard(timer);
      timerContainer.appendChild(card);
    });

    // Get all close buttons
    const removeButtons = Array.from(document.querySelectorAll('.timer-remove'));
    expect(removeButtons.length).to.equal(3);

    // Check initial button dimensions at normal width
    const initialRects = removeButtons.map(btn => {
      const rect = btn.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });

    // All buttons should be 30x30 and circular
    initialRects.forEach(rect => {
      expect(rect.width).to.be.closeTo(30, 1, 'Button width should be 30px');
      expect(rect.height).to.be.closeTo(30, 1, 'Button height should be 30px');
      expect(Math.abs(rect.width - rect.height)).to.be.lessThan(1, 'Button should be circular');
    });

    // Simulate narrow window by constraining the container
    timerContainer.style.maxWidth = '250px';
    timerContainer.style.width = '250px';

    // Force reflow
    timerContainer.offsetHeight;

    // Check button dimensions after resize
    const resizedRects = removeButtons.map(btn => {
      const rect = btn.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });

    // THIS IS WHERE THE BUG SHOWS UP
    // Buttons should STILL be 30x30 and circular
    resizedRects.forEach((rect, index) => {
      expect(rect.width).to.be.closeTo(30, 1,
        `Button ${index} width should remain 30px after resize, got ${rect.width}`);
      expect(rect.height).to.be.closeTo(30, 1,
        `Button ${index} height should remain 30px after resize, got ${rect.height}`);
      expect(Math.abs(rect.width - rect.height)).to.be.lessThan(1,
        `Button ${index} should remain circular after resize (width: ${rect.width}, height: ${rect.height})`);
    });
  });

  it('should keep close buttons inside the card bounds when window shrinks', async () => {
    // Add 3 timers
    const timers = timerManager.getAllTimers();

    // Render all timer cards
    timers.forEach(timer => {
      const card = createTimerCard(timer);
      timerContainer.appendChild(card);
    });

    // Simulate narrow window
    timerContainer.style.maxWidth = '250px';
    timerContainer.style.width = '250px';

    // Force reflow
    timerContainer.offsetHeight;

    const cards = Array.from(document.querySelectorAll('.timer-card'));

    cards.forEach((card, index) => {
      const removeBtn = card.querySelector('.timer-remove');
      const cardRect = card.getBoundingClientRect();
      const btnRect = removeBtn.getBoundingClientRect();

      // Check that button doesn't overflow
      expect(btnRect.right).to.be.at.most(cardRect.right + 1,
        `Button ${index} should not overflow right edge (btn.right: ${btnRect.right}, card.right: ${cardRect.right})`);
      expect(btnRect.left).to.be.at.least(cardRect.left - 1,
        `Button ${index} should not overflow left edge`);
      expect(btnRect.top).to.be.at.least(cardRect.top - 1,
        `Button ${index} should not overflow top edge`);
      expect(btnRect.bottom).to.be.at.most(cardRect.bottom + 1,
        `Button ${index} should not overflow bottom edge`);
    });
  });
});
