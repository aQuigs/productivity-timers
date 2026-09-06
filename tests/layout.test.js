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

    const goal = document.createElement('div');
    goal.className = 'timer-goal';

    const goalBtn = document.createElement('button');
    goalBtn.className = 'timer-goal-btn';
    goalBtn.textContent = 'Set goal or budget';

    const goalEditor = document.createElement('div');
    goalEditor.className = 'timer-goal-editor';
    goalEditor.hidden = true;

    const goalKind = document.createElement('div');
    goalKind.className = 'timer-goal-kind';
    goalKind.setAttribute('role', 'radiogroup');
    ['goal', 'budget'].forEach(kind => {
      const label = document.createElement('label');
      label.className = 'timer-goal-kind-option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'goal-kind-layout';
      radio.value = kind;
      radio.checked = kind === 'goal';
      const text = document.createElement('span');
      text.textContent = kind === 'goal' ? 'Goal' : 'Budget';
      label.appendChild(radio);
      label.appendChild(text);
      goalKind.appendChild(label);
    });

    const goalInput = document.createElement('input');
    goalInput.type = 'text';
    goalInput.className = 'timer-goal-input';

    goalEditor.appendChild(goalKind);
    goalEditor.appendChild(goalInput);

    const progress = document.createElement('div');
    progress.className = 'timer-progress';
    progress.hidden = true;

    const progressBar = document.createElement('div');
    progressBar.className = 'timer-progress-bar';
    progress.appendChild(progressBar);

    const goalError = document.createElement('p');
    goalError.className = 'timer-goal-error';
    goalError.hidden = true;

    goal.appendChild(goalBtn);
    goal.appendChild(goalEditor);
    goal.appendChild(goalError);
    goal.appendChild(progress);

    const controls = document.createElement('div');
    controls.className = 'timer-controls';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'btn btn-start';
    toggleBtn.textContent = 'Start';

    controls.appendChild(toggleBtn);

    card.appendChild(header);
    card.appendChild(display);
    card.appendChild(goal);
    card.appendChild(controls);

    return card;
  }

  function createGoalCard(chipText = 'Goal 02:00:00') {
    const card = createTestTimerCard();
    const goalBtn = card.querySelector('.timer-goal-btn');
    goalBtn.classList.add('is-set');
    goalBtn.textContent = chipText;
    card.querySelector('.timer-progress').hidden = false;
    return card;
  }

  function createInvalidGoalCard() {
    const card = createTestTimerCard();
    card.querySelector('.timer-goal-btn').hidden = true;
    card.querySelector('.timer-goal-editor').hidden = false;
    const input = card.querySelector('.timer-goal-input');
    input.value = 'soon';
    input.classList.add('is-invalid');
    const error = card.querySelector('.timer-goal-error');
    error.hidden = false;
    error.textContent = "Couldn't read that time. Try 25m, 1h 30m or 1:30";
    return card;
  }

  function createBudgetCard(chipText = 'Budget 02:00:00') {
    return createGoalCard(chipText);
  }

  // Resolves a token like --danger to the rgb() string computed styles report
  function computedToken(name) {
    const probe = document.createElement('span');
    probe.style.color = `var(${name})`;
    document.body.appendChild(probe);
    const color = window.getComputedStyle(probe).color;
    probe.remove();
    return color;
  }

  // Plain colours compute to rgb(); color-mix() results compute to color(srgb r g b) on a 0-1 scale
  function rgbChannels(color) {
    const rgb = /^rgba?\((\d+), (\d+), (\d+)/.exec(color);
    if (rgb) return rgb.slice(1, 4).map(Number);
    const srgb = /^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/.exec(color);
    expect(srgb, `${color} should be an rgb() or color(srgb) colour`).to.not.be.null;
    return srgb.slice(1, 4).map(value => Math.round(Number(value) * 255));
  }

  function expectGreen(color, label) {
    const [r, g, b] = rgbChannels(color);
    expect(g, `${label} ${color} should lean green`).to.be.greaterThan(r);
    expect(g, `${label} ${color} should lean green`).to.be.greaterThan(b);
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
      const appContainer = document.querySelector('.app-container');

      // Simulate very large window
      appContainer.style.width = '2000px';
      timerContainer.appendChild(card);

      // Force reflow
      timerContainer.offsetHeight;

      const cardRect = card.getBoundingClientRect();

      // Timer card should not exceed a reasonable max width (e.g., 400-450px)
      expect(cardRect.width).to.be.at.most(450,
        `Timer card should not stretch beyond max width even on large screens, got ${cardRect.width}px`);
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

  describe('Timer display typography', () => {
    it('should use tabular numerals so the time does not jitter as digits change', () => {
      const card = createTestTimerCard('Timer', '00:00:00');
      document.getElementById('timer-container').appendChild(card);

      const display = card.querySelector('.timer-display');
      const styles = window.getComputedStyle(display);

      expect(styles.fontVariantNumeric).to.include('tabular-nums');
    });

    it('should keep the same width for narrow and wide digit strings', () => {
      const narrow = createTestTimerCard('Timer', '11:11:11');
      const wide = createTestTimerCard('Timer', '00:00:00');
      const timerContainer = document.getElementById('timer-container');
      timerContainer.appendChild(narrow);
      timerContainer.appendChild(wide);

      const measure = (card) => {
        const display = card.querySelector('.timer-display');
        const range = document.createRange();
        range.selectNodeContents(display);
        return range.getBoundingClientRect().width;
      };

      expect(Math.abs(measure(narrow) - measure(wide))).to.be.lessThan(1);
    });
  });

  describe('Running state', () => {
    it('should make the running card visually distinct from an idle card', () => {
      const idle = createTestTimerCard('Idle');
      const running = createTestTimerCard('Running');
      running.classList.add('active');
      const timerContainer = document.getElementById('timer-container');
      timerContainer.appendChild(idle);
      timerContainer.appendChild(running);

      const idleStyles = window.getComputedStyle(idle);
      const runningStyles = window.getComputedStyle(running);

      expect(runningStyles.borderColor).to.not.equal(idleStyles.borderColor);
    });

    it('should style start and pause buttons differently', () => {
      const idle = createTestTimerCard('Idle');
      const running = createTestTimerCard('Running');
      running.querySelector('.btn').className = 'btn btn-pause';
      const timerContainer = document.getElementById('timer-container');
      timerContainer.appendChild(idle);
      timerContainer.appendChild(running);

      const startBackground = window.getComputedStyle(idle.querySelector('.btn')).backgroundColor;
      const pauseBackground = window.getComputedStyle(running.querySelector('.btn')).backgroundColor;

      expect(startBackground).to.not.equal(pauseBackground);
    });
  });

  describe('Drag handle', () => {
    function addHandle(card) {
      const handle = document.createElement('span');
      handle.className = 'timer-drag-handle';
      handle.setAttribute('role', 'button');
      handle.tabIndex = 0;
      card.querySelector('.timer-header').prepend(handle);
      return handle;
    }

    it('should be at least 36px tall and show a grab cursor', () => {
      const card = createTestTimerCard();
      const handle = addHandle(card);
      document.getElementById('timer-container').appendChild(card);

      const rect = handle.getBoundingClientRect();
      const styles = window.getComputedStyle(handle);

      expect(rect.height).to.be.at.least(36, 'Handle should be a comfortable touch target');
      expect(rect.width).to.be.at.least(24, 'Handle should be wide enough to grab');
      expect(styles.cursor).to.equal('grab');
      expect(styles.flexShrink).to.equal('0');
      expect(styles.userSelect).to.equal('none');
    });

    it('should show a grabbing cursor while the card is being dragged', () => {
      const card = createTestTimerCard();
      const handle = addHandle(card);
      card.classList.add('dragging');
      document.getElementById('timer-container').appendChild(card);

      expect(window.getComputedStyle(handle).cursor).to.equal('grabbing');
      expect(parseFloat(window.getComputedStyle(card).opacity)).to.be.below(1);
    });

    it('should keep the remove button square and the title inside a narrow card', () => {
      const card = createTestTimerCard('Very Long Timer Title That Might Overflow');
      addHandle(card);
      card.style.width = '200px';
      document.getElementById('timer-container').appendChild(card);

      const cardRect = card.getBoundingClientRect();
      const removeRect = card.querySelector('.timer-remove').getBoundingClientRect();
      const titleRect = card.querySelector('.timer-title').getBoundingClientRect();
      const handleRect = card.querySelector('.timer-drag-handle').getBoundingClientRect();

      expect(removeRect.width).to.be.closeTo(36, 1);
      expect(removeRect.height).to.be.closeTo(36, 1);
      expect(removeRect.right).to.be.at.most(cardRect.right + 1);
      expect(titleRect.right).to.be.at.most(removeRect.left);
      expect(titleRect.left).to.be.at.least(handleRect.right - 8);
      expect(handleRect.left).to.be.at.least(cardRect.left);
    });
  });

  describe('Goal progress', () => {
    it('should honour the hidden attribute on goal controls despite their display rules', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);
      const goalBtn = card.querySelector('.timer-goal-btn');
      goalBtn.hidden = true;

      expect(window.getComputedStyle(goalBtn).display).to.equal('none');
      expect(window.getComputedStyle(card.querySelector('.timer-goal-editor')).display).to.equal('none');
      expect(window.getComputedStyle(card.querySelector('.timer-progress')).display).to.equal('none');
    });

    it('should size the progress bar relative to its track', () => {
      const card = createGoalCard();
      document.getElementById('timer-container').appendChild(card);
      const track = card.querySelector('.timer-progress');
      const bar = card.querySelector('.timer-progress-bar');
      bar.style.width = '50%';

      const trackWidth = track.getBoundingClientRect().width;
      const barWidth = bar.getBoundingClientRect().width;

      expect(trackWidth).to.be.greaterThan(100);
      expect(Math.abs(barWidth - trackWidth / 2)).to.be.lessThan(1);
    });

    it('should keep the track thin so it reads as progress, not as a control', () => {
      const card = createGoalCard();
      document.getElementById('timer-container').appendChild(card);

      const height = card.querySelector('.timer-progress').getBoundingClientRect().height;
      expect(height).to.be.at.least(2);
      expect(height).to.be.at.most(8);
    });

    it('should switch the bar colour when the card is over target', () => {
      const timerContainer = document.getElementById('timer-container');
      const underTarget = createGoalCard();
      const overTarget = createGoalCard('Goal 02:00:00 · 00:10:00 over');
      overTarget.classList.add('over-target');
      timerContainer.appendChild(underTarget);
      timerContainer.appendChild(overTarget);

      const underColor = rgbChannels(window.getComputedStyle(underTarget.querySelector('.timer-progress-bar')).backgroundColor);
      const overColor = rgbChannels(window.getComputedStyle(overTarget.querySelector('.timer-progress-bar')).backgroundColor);

      expect(overColor).to.not.deep.equal(underColor);
      expect(overColor).to.not.deep.equal([0, 0, 0]);
    });

    it('should style the reached chip differently from a pending chip', () => {
      const timerContainer = document.getElementById('timer-container');
      const pending = createGoalCard();
      const reached = createGoalCard('Goal 02:00:00 · 00:10:00 over');
      reached.classList.add('over-target');
      timerContainer.appendChild(pending);
      timerContainer.appendChild(reached);

      const pendingColor = window.getComputedStyle(pending.querySelector('.timer-goal-btn')).color;
      const reachedColor = window.getComputedStyle(reached.querySelector('.timer-goal-btn')).color;

      expect(reachedColor).to.not.equal(pendingColor);
    });

    it('should show the chip in tabular numerals', () => {
      const card = createGoalCard();
      document.getElementById('timer-container').appendChild(card);

      const styles = window.getComputedStyle(card.querySelector('.timer-goal-btn'));
      expect(styles.fontVariantNumeric).to.include('tabular-nums');
    });

    it('should outline an invalid goal input in the danger colour and show the message', () => {
      const card = createInvalidGoalCard();
      document.getElementById('timer-container').appendChild(card);
      const danger = computedToken('--danger');

      const inputStyles = window.getComputedStyle(card.querySelector('.timer-goal-input'));
      const error = card.querySelector('.timer-goal-error');
      const errorStyles = window.getComputedStyle(error);

      expect(danger).to.match(/^rgb/);
      expect(inputStyles.borderTopColor).to.equal(danger);
      expect(errorStyles.display).to.not.equal('none');
      expect(error.getBoundingClientRect().height).to.be.greaterThan(0);
      expect(errorStyles.color).to.equal(danger);
    });

    it('should wrap the error message inside the card on a narrow layout', () => {
      const card = createInvalidGoalCard();
      const timerContainer = document.getElementById('timer-container');
      timerContainer.style.width = '220px';
      timerContainer.appendChild(card);

      const cardRect = card.getBoundingClientRect();
      const errorRect = card.querySelector('.timer-goal-error').getBoundingClientRect();

      expect(errorRect.right).to.be.at.most(cardRect.right + 1);
      expect(errorRect.left).to.be.at.least(cardRect.left - 1);
      expect(errorRect.height).to.be.greaterThan(errorRect.width / 8, 'message should wrap onto more than one line');
    });

    it('should keep the chip and editor inside the card on a narrow layout', () => {
      const card = createGoalCard('Budget 125:00:00 · 00:00:42 over');
      card.querySelector('.timer-goal-editor').hidden = false;
      const timerContainer = document.getElementById('timer-container');
      timerContainer.style.width = '250px';
      timerContainer.appendChild(card);

      const cardRect = card.getBoundingClientRect();
      ['.timer-goal-btn', '.timer-goal-kind', '.timer-goal-input', '.timer-progress'].forEach(selector => {
        const rect = card.querySelector(selector).getBoundingClientRect();
        expect(rect.right).to.be.at.most(cardRect.right + 1, `${selector} should stay inside the card`);
        expect(rect.left).to.be.at.least(cardRect.left - 1, `${selector} should stay inside the card`);
      });
    });

    it('should lay the kind toggle out as two visible, clickable options', () => {
      const card = createGoalCard();
      card.querySelector('.timer-goal-editor').hidden = false;
      document.getElementById('timer-container').appendChild(card);

      const options = card.querySelectorAll('.timer-goal-kind-option');
      expect(options).to.have.lengthOf(2);
      options.forEach(option => {
        const rect = option.getBoundingClientRect();
        expect(rect.width).to.be.greaterThan(30);
        expect(rect.height).to.be.at.least(24);
      });

      const checked = window.getComputedStyle(options[0]);
      const unchecked = window.getComputedStyle(options[1]);
      expect(checked.backgroundColor).to.not.equal(unchecked.backgroundColor);
    });

    it('should colour an exceeded budget differently from a reached goal and from pending', () => {
      const timerContainer = document.getElementById('timer-container');
      const pending = createBudgetCard();
      const overBudget = createBudgetCard('Budget 02:00:00 · 00:10:00 over');
      overBudget.classList.add('over-budget');
      const overTarget = createGoalCard('Goal 02:00:00 · 00:10:00 over');
      overTarget.classList.add('over-target');
      timerContainer.appendChild(pending);
      timerContainer.appendChild(overBudget);
      timerContainer.appendChild(overTarget);
      const danger = computedToken('--danger');

      const barColor = card => rgbChannels(window.getComputedStyle(card.querySelector('.timer-progress-bar')).backgroundColor);
      const chipColor = card => window.getComputedStyle(card.querySelector('.timer-goal-btn')).color;

      expect(barColor(overBudget)).to.deep.equal(rgbChannels(danger));
      expect(barColor(overBudget)).to.not.deep.equal(barColor(pending));
      expect(barColor(overBudget)).to.not.deep.equal(barColor(overTarget));
      expect(chipColor(overBudget)).to.equal(danger);
      expect(chipColor(overBudget)).to.not.equal(chipColor(pending));
      expect(chipColor(overBudget)).to.not.equal(chipColor(overTarget));
    });

    it('should colour a reached goal green, not amber', () => {
      const overTarget = createGoalCard('Goal 02:00:00 · 00:10:00 over');
      overTarget.classList.add('over-target');
      document.getElementById('timer-container').appendChild(overTarget);

      expectGreen(window.getComputedStyle(overTarget.querySelector('.timer-progress-bar')).backgroundColor, 'bar');
      expectGreen(window.getComputedStyle(overTarget.querySelector('.timer-goal-btn')).color, 'chip');
      expectGreen(window.getComputedStyle(overTarget.querySelector('.timer-goal-btn')).borderColor, 'chip border');
    });

    it('should heat the budget bar from the accent to red as --budget-heat rises', () => {
      const timerContainer = document.getElementById('timer-container');
      const atHeat = heat => {
        const card = createBudgetCard();
        card.querySelector('.timer-progress-bar').style.setProperty('--budget-heat', heat);
        timerContainer.appendChild(card);
        return window.getComputedStyle(card.querySelector('.timer-progress-bar')).backgroundColor;
      };
      const accent = computedToken('--accent');
      const danger = computedToken('--danger');

      const cold = rgbChannels(atHeat('0%'));
      const warm = rgbChannels(atHeat('50%'));
      const hot = rgbChannels(atHeat('100%'));
      const unsetCard = createBudgetCard();
      timerContainer.appendChild(unsetCard);
      const unset = rgbChannels(window.getComputedStyle(unsetCard.querySelector('.timer-progress-bar')).backgroundColor);

      expect(cold).to.deep.equal(rgbChannels(accent));
      expect(hot).to.deep.equal(rgbChannels(danger));
      expect(warm).to.not.deep.equal(cold);
      expect(warm).to.not.deep.equal(hot);
      const [coldR] = cold;
      const [warmR, warmG] = warm;
      const [hotR, , hotB] = hot;
      expect(warmR).to.be.at.least(coldR);
      expect(warmG).to.be.greaterThan(hotB, 'the midpoint should still read warm, not red');
      expect(hotR).to.be.greaterThan(warmG);
      expect(unset, 'a bar without the property is the plain accent').to.deep.equal(rgbChannels(accent));
    });
  });

  describe('Time added animation', () => {
    const TIME_ADDED_ANIMATIONS = ['time-added-fill', 'time-added-glow', 'time-added-ring'];

    function animationNames(card) {
      return card.getAnimations({ subtree: true }).map(animation => animation.animationName).sort();
    }

    it('should raise a fill behind the card, glow the display and pulse a ring while time-added is set', () => {
      const card = createTestTimerCard();
      card.classList.add('time-added');
      document.getElementById('timer-container').appendChild(card);

      expect(window.getComputedStyle(card, '::before').animationName).to.equal('time-added-fill');
      expect(window.getComputedStyle(card, '::before').zIndex).to.equal('-1');
      expect(window.getComputedStyle(card).isolation).to.equal('isolate');
      expect(window.getComputedStyle(card.querySelector('.timer-display')).animationName).to.equal('time-added-glow');
      expect(window.getComputedStyle(card, '::after').animationName).to.equal('time-added-ring');
      expect(animationNames(card)).to.deep.equal(TIME_ADDED_ANIMATIONS);
    });

    it('should let the ring finish last so it can mark the end of the sequence', async () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);
      card.classList.add('time-added');

      const endedInOrder = await new Promise(resolve => {
        const names = [];
        card.addEventListener('animationend', e => {
          names.push(e.animationName);
          if (names.length === TIME_ADDED_ANIMATIONS.length) resolve(names);
        });
      });
      expect(endedInOrder[endedInOrder.length - 1]).to.equal('time-added-ring');
      expect(animationNames(card)).to.deep.equal([]);
    });

    it('should leave no fill showing once the fill has finished while the ring is still playing', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);
      card.classList.add('time-added');

      card.getAnimations({ subtree: true })
        .filter(animation => animation.animationName !== 'time-added-ring')
        .forEach(animation => animation.finish());

      expect(window.getComputedStyle(card, '::before').opacity).to.equal('0');
    });

    it('should not animate a card that has not just received time', () => {
      const card = createTestTimerCard();
      document.getElementById('timer-container').appendChild(card);

      expect(window.getComputedStyle(card, '::before').animationName).to.equal('none');
      expect(window.getComputedStyle(card, '::after').animationName).to.equal('none');
      expect(window.getComputedStyle(card.querySelector('.timer-display')).animationName).to.equal('none');
    });
  });

  describe('Top bar', () => {
    function createTopBar() {
      const header = document.createElement('header');
      header.className = 'topbar';
      header.innerHTML = `
        <div class="brand">
          <h1>Productivity Timers</h1>
          <p class="subtitle">One clock runs at a time</p>
        </div>
        <div class="summary">
          <span class="summary-label">Total</span>
          <span id="total-time" class="summary-value">00:00:00</span>
        </div>
        <div class="controls">
          <button id="reset-all-btn" class="btn btn-secondary">Reset all</button>
          <button id="add-timer-btn" class="btn btn-primary">Add timer</button>
        </div>
      `;
      return header;
    }

    it('should not overflow horizontally on a phone-width layout', () => {
      const appContainer = document.querySelector('.app-container');
      appContainer.style.width = '320px';
      const topBar = createTopBar();
      appContainer.prepend(topBar);

      const containerRect = appContainer.getBoundingClientRect();
      topBar.querySelectorAll('.btn, .summary, .brand').forEach(el => {
        const rect = el.getBoundingClientRect();
        expect(rect.right).to.be.at.most(containerRect.right + 1,
          `${el.className} should stay inside the container`);
        expect(rect.left).to.be.at.least(containerRect.left - 1,
          `${el.className} should stay inside the container`);
      });
    });

    it('should show the total using tabular numerals', () => {
      const appContainer = document.querySelector('.app-container');
      const topBar = createTopBar();
      appContainer.prepend(topBar);

      const styles = window.getComputedStyle(topBar.querySelector('#total-time'));
      expect(styles.fontVariantNumeric).to.include('tabular-nums');
    });
  });
});
