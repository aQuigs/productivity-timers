import { expect } from '@esm-bundle/chai';

describe('Close Button Visual Tests', () => {
  let container;
  let app;

  beforeEach(async () => {
    container = document.createElement('div');
    container.id = 'test-container';
    container.innerHTML = `
      <div class="app-container">
        <div id="timer-container" class="timer-container"></div>
        <div class="controls">
          <button id="reset-all-btn" class="btn btn-secondary">Reset All</button>
          <button id="add-timer-btn" class="btn btn-primary">Add Timer</button>
        </div>
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

    // We don't actually need the app instance for these visual tests
    app = null;
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  });

  /**
   * Creates a timer card element for testing
   */
  function createTestTimerCard(title = 'Test Timer') {
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
    card.appendChild(header);

    return card;
  }

  describe('Close button shape and dimensions', () => {
    it('should be perfectly square on normal sized windows', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const styles = window.getComputedStyle(removeBtn);
      const rect = removeBtn.getBoundingClientRect();

      expect(styles.borderRadius).to.equal('8px');
      expect(Math.abs(rect.width - rect.height)).to.be.lessThan(1,
        'Button should be square (width === height)');
    });

    it('should maintain square shape with very small card width', () => {
      const card = createTestTimerCard();
      card.style.width = '200px';
      document.getElementById('timer-container').appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const rect = removeBtn.getBoundingClientRect();

      expect(Math.abs(rect.width - rect.height)).to.be.lessThan(1,
        'Button should remain square even in narrow containers');
      expect(rect.width).to.be.at.least(36, 'Button should maintain minimum size');
      expect(rect.height).to.be.at.least(36, 'Button should maintain minimum size');
    });

    it('should maintain square shape with extremely long title text', () => {
      const longTitle = 'A'.repeat(50);
      const card = createTestTimerCard(longTitle);
      document.getElementById('timer-container').appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const rect = removeBtn.getBoundingClientRect();

      expect(Math.abs(rect.width - rect.height)).to.be.lessThan(1,
        'Button should remain square even with very long titles');
    });

    it('should have correct width and height styles', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const styles = window.getComputedStyle(removeBtn);

      expect(styles.width).to.equal('36px');
      expect(styles.height).to.equal('36px');
      expect(styles.minWidth).to.equal('36px');
      expect(styles.minHeight).to.equal('36px');
    });
  });

  describe('Close button positioning and overflow', () => {
    it('should not overflow outside the card container', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const cardRect = card.getBoundingClientRect();
      const btnRect = removeBtn.getBoundingClientRect();

      expect(btnRect.left).to.be.at.least(cardRect.left,
        'Button left edge should be inside card');
      expect(btnRect.right).to.be.at.most(cardRect.right,
        'Button right edge should be inside card');
      expect(btnRect.top).to.be.at.least(cardRect.top,
        'Button top edge should be inside card');
      expect(btnRect.bottom).to.be.at.most(cardRect.bottom,
        'Button bottom edge should be inside card');
    });

    it('should not overflow with narrow card width', () => {
      const card = createTestTimerCard();
      card.style.width = '200px';
      document.getElementById('timer-container').appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const cardRect = card.getBoundingClientRect();
      const btnRect = removeBtn.getBoundingClientRect();

      expect(btnRect.right).to.be.at.most(cardRect.right + 1,
        'Button should not overflow right edge on narrow cards');
    });

    it('should not overflow with very narrow viewport', () => {
      const originalWidth = window.innerWidth;

      const card = createTestTimerCard();
      const timerContainer = document.getElementById('timer-container');
      timerContainer.style.maxWidth = '250px';
      timerContainer.appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const cardRect = card.getBoundingClientRect();
      const btnRect = removeBtn.getBoundingClientRect();

      expect(btnRect.right).to.be.at.most(cardRect.right + 1,
        'Button should not overflow on narrow viewports');
    });

    it('should have flex-shrink: 0 to prevent compression', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const styles = window.getComputedStyle(removeBtn);

      expect(styles.flexShrink).to.equal('0');
    });
  });

  describe('Timer header layout', () => {
    it('should have gap between title and close button', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);

      const header = card.querySelector('.timer-header');
      const styles = window.getComputedStyle(header);

      expect(styles.gap).to.not.equal('0px',
        'Header should have gap between elements');
    });

    it('should allow title to shrink but not the close button', () => {
      const card = createTestTimerCard('Very Long Title Text Here');
      card.style.width = '200px';
      document.getElementById('timer-container').appendChild(card);

      const titleInput = card.querySelector('.timer-title');
      const removeBtn = card.querySelector('.timer-remove');

      const titleStyles = window.getComputedStyle(titleInput);
      const btnStyles = window.getComputedStyle(removeBtn);

      expect(titleStyles.flex).to.include('1', 'Title should be flexible');
      expect(btnStyles.flexShrink).to.equal('0', 'Button should not shrink');
    });

    it('should properly align items in header', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);

      const header = card.querySelector('.timer-header');
      const styles = window.getComputedStyle(header);

      expect(styles.display).to.equal('flex');
      expect(styles.alignItems).to.equal('center');
    });
  });

  describe('Close button visual appearance', () => {
    it('should have red background color', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const styles = window.getComputedStyle(removeBtn);

      expect(styles.backgroundColor).to.match(/rgba?\(239,\s*68,\s*68/,
        'Button should have red background color from dark theme');
    });

    it('should center the × symbol', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const styles = window.getComputedStyle(removeBtn);

      expect(styles.display).to.equal('flex');
      expect(styles.alignItems).to.equal('center');
      expect(styles.justifyContent).to.equal('center');
    });

    it('should have proper padding for centering', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);

      const removeBtn = card.querySelector('.timer-remove');
      const styles = window.getComputedStyle(removeBtn);

      expect(styles.padding).to.equal('0px');
    });
  });
});
