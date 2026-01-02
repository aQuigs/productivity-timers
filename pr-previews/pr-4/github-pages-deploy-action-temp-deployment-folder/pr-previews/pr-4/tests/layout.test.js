import { expect } from '@esm-bundle/chai';

describe('Layout and Overflow Tests', () => {
  let container;

  beforeEach(async () => {
    container = document.createElement('div');
    container.id = 'test-container';
    container.innerHTML = `
      <div class="app-container">
        <div id="timer-container" class="timer-container"></div>
      </div>
    `;
    document.body.appendChild(container);

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/css/styles.css';
    document.head.appendChild(link);

    await new Promise(resolve => {
      link.onload = resolve;
      link.onerror = resolve;
    });
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  function createTestTimerCard(title = 'Test Timer', time = '00:45:32') {
    const card = document.createElement('div');
    card.className = 'timer-card';

    const header = document.createElement('div');
    header.className = 'timer-header';

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = 'timer-title';
    titleInput.value = title;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'timer-remove';
    removeBtn.textContent = '×';

    header.appendChild(titleInput);
    header.appendChild(removeBtn);

    const display = document.createElement('div');
    display.className = 'timer-display';
    display.textContent = time;

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

  describe('Text overflow on small windows', () => {
    it('should not allow timer display text to overflow card on small window', () => {
      const card = createTestTimerCard('Timer 1', '99:59:59');
      const timerContainer = document.getElementById('timer-container');

      // Simulate small window
      timerContainer.style.width = '250px';
      timerContainer.appendChild(card);

      const display = card.querySelector('.timer-display');
      const cardRect = card.getBoundingClientRect();
      const displayRect = display.getBoundingClientRect();

      expect(displayRect.right).to.be.at.most(cardRect.right + 1,
        'Timer display should not overflow card right edge');
      expect(displayRect.left).to.be.at.least(cardRect.left - 1,
        'Timer display should not overflow card left edge');
    });

    it('should not allow long title text to overflow card on small window', () => {
      const longTitle = 'Very Long Timer Title That Might Overflow';
      const card = createTestTimerCard(longTitle);
      const timerContainer = document.getElementById('timer-container');

      timerContainer.style.width = '250px';
      timerContainer.appendChild(card);

      const titleInput = card.querySelector('.timer-title');
      const cardRect = card.getBoundingClientRect();
      const titleRect = titleInput.getBoundingClientRect();

      expect(titleRect.right).to.be.at.most(cardRect.right + 1,
        'Title should not overflow card right edge');
    });

    it('should handle text overflow gracefully with ellipsis or wrapping', () => {
      const card = createTestTimerCard('Timer', '99:59:59');
      const timerContainer = document.getElementById('timer-container');

      timerContainer.style.width = '200px';
      timerContainer.appendChild(card);

      const display = card.querySelector('.timer-display');
      const styles = window.getComputedStyle(display);

      // Text should either wrap or have ellipsis, but not overflow
      const hasWordBreak = styles.wordBreak === 'break-all' || styles.wordBreak === 'break-word';
      const hasOverflow = styles.overflow === 'hidden' || styles.textOverflow === 'ellipsis';

      expect(hasWordBreak || hasOverflow || styles.whiteSpace === 'normal').to.be.true;
    });
  });

  describe('Timer card max width', () => {
    it('should have a maximum width regardless of window size', () => {
      const card = createTestTimerCard();
      const timerContainer = document.getElementById('timer-container');

      // Simulate very large window
      timerContainer.style.width = '2000px';
      timerContainer.appendChild(card);

      const cardRect = card.getBoundingClientRect();

      // Timer card should not exceed a reasonable max width (e.g., 400-500px)
      expect(cardRect.width).to.be.at.most(500,
        'Timer card should not stretch beyond max width even on large screens');
    });

    it('should only grow the grid, not individual cards, on wide screens', () => {
      const timerContainer = document.getElementById('timer-container');

      // Add multiple cards
      for (let i = 0; i < 4; i++) {
        const card = createTestTimerCard(`Timer ${i + 1}`);
        timerContainer.appendChild(card);
      }

      // Simulate wide window
      timerContainer.style.width = '1600px';

      // Force reflow
      timerContainer.offsetHeight;

      const cards = Array.from(document.querySelectorAll('.timer-card'));
      const cardWidths = cards.map(card => card.getBoundingClientRect().width);

      // All cards should have similar widths
      const maxWidth = Math.max(...cardWidths);
      const minWidth = Math.min(...cardWidths);

      // Cards should be consistent width
      expect(maxWidth - minWidth).to.be.lessThan(5,
        'All cards should have similar widths');

      // No card should be excessively wide
      expect(maxWidth).to.be.at.most(500,
        'Cards should not exceed max width');
    });

    it('should maintain consistent card size across different grid layouts', () => {
      const timerContainer = document.getElementById('timer-container');

      // Add 3 cards
      for (let i = 0; i < 3; i++) {
        const card = createTestTimerCard(`Timer ${i + 1}`);
        timerContainer.appendChild(card);
      }

      // Test at medium width (should show 2-3 columns)
      timerContainer.style.width = '900px';
      timerContainer.offsetHeight;

      const cards = document.querySelectorAll('.timer-card');
      const mediumWidths = Array.from(cards).map(card =>
        card.getBoundingClientRect().width
      );

      // All cards at medium width should be similar
      const mediumMax = Math.max(...mediumWidths);
      const mediumMin = Math.min(...mediumWidths);
      expect(mediumMax - mediumMin).to.be.lessThan(5);
    });
  });
});
