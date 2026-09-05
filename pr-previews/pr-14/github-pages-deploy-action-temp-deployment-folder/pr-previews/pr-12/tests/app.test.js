import { expect } from '@esm-bundle/chai';
import { App } from '../js/app.js';
import { TimerManager } from '../js/timerManager.js';
import { setHidden, restoreHidden, dispatchVisibilityChange, heartbeatAgo } from './helpers.js';

describe('App', () => {
  let container;
  let app;

  function tick(ms = 20) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function seedRunningTimer() {
    const seed = new TimerManager(2);
    const timer = seed.getAllTimers()[0];
    seed.startTimer(timer.id);
    return timer.id;
  }

  function createApp() {
    app = new App();
    app.init();
    return app;
  }

  function hide() {
    setHidden(true);
    dispatchVisibilityChange();
  }

  async function show() {
    setHidden(false);
    dispatchVisibilityChange();
    await tick();
  }

  // Hide the tab, pretend `ms` passed, and show it again
  async function returnAfter(ms) {
    hide();
    heartbeatAgo(ms);
    await show();
  }

  function modals() {
    return document.querySelectorAll('.allocation-modal');
  }

  function applyPreviousTimer() {
    document.querySelector('.allocation-modal input[value="previous-timer"]').click();
    document.querySelector('.allocation-modal button.btn-apply').click();
  }

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement('div');
    container.innerHTML = `
      <div id="timer-container" class="timer-container"></div>
      <div class="controls">
        <button id="reset-all-btn" class="btn btn-secondary">Reset All</button>
        <button id="add-timer-btn" class="btn btn-primary">Add Timer</button>
      </div>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (app) {
      app.destroy();
      app = null;
    }
    modals().forEach(el => el.remove());
    restoreHidden();
    container.remove();
    localStorage.clear();
  });

  describe('Startup', () => {
    it('should open exactly one allocation modal on load when idle time exceeds the threshold', async () => {
      heartbeatAgo(15000);

      createApp();
      await tick();

      expect(modals().length).to.equal(1);
    });

    it('should offer the previously running timer after a reload with idle time', async () => {
      const runningId = seedRunningTimer();
      heartbeatAgo(15000);

      createApp();
      await tick();

      const radio = document.querySelector('.allocation-modal input[value="previous-timer"]');
      expect(radio.disabled).to.be.false;

      applyPreviousTimer();
      await tick();

      const timer = app.timerManager.getTimer(runningId);
      expect(timer.getElapsedMs()).to.be.at.least(15000);
      expect(timer.isRunning()).to.be.true;
      expect(modals().length).to.equal(0);
    });

    it('should resume a timer paused by the unload visibility change after a quick refresh', () => {
      const seed = new TimerManager(2);
      const timer = seed.getAllTimers()[0];
      seed.startTimer(timer.id);
      seed.pauseTimer(timer.id);
      localStorage.setItem('app_hidden_running_timers', JSON.stringify([timer.id]));
      heartbeatAgo(300);

      createApp();

      expect(app.timerManager.getTimer(timer.id).isRunning()).to.be.true;
      expect(localStorage.getItem('app_hidden_running_timers')).to.be.null;
    });

    it('should pause a restored running timer when the app loads in a hidden tab', () => {
      const runningId = seedRunningTimer();
      setHidden(true);

      createApp();
      expect(app.timerManager.getTimer(runningId).isRunning()).to.be.false;

      setHidden(false);
      dispatchVisibilityChange();
      expect(app.timerManager.getTimer(runningId).isRunning()).to.be.true;
    });

    it('should ignore corrupted hidden-timer state in localStorage', () => {
      localStorage.setItem('app_hidden_running_timers', '{not json');

      expect(() => createApp()).to.not.throw();
      expect(app.hiddenRunningTimers.size).to.equal(0);
    });

    it('should share one idle threshold with the IdleDetector', () => {
      createApp();
      expect(app.idleThreshold).to.equal(app.idleDetector.idleThreshold);
    });
  });

  describe('Visibility changes', () => {
    it('should resume the running timer after a short hidden period without a modal', async () => {
      const runningId = seedRunningTimer();
      createApp();

      hide();
      expect(app.timerManager.getTimer(runningId).isRunning()).to.be.false;

      heartbeatAgo(5000);
      await show();

      expect(app.timerManager.getTimer(runningId).isRunning()).to.be.true;
      expect(modals().length).to.equal(0);
      expect(localStorage.getItem('accumulated_idle_ms')).to.be.null;
    });

    it('should keep the timer paused and show a modal after a long hidden period', async () => {
      const runningId = seedRunningTimer();
      createApp();

      await returnAfter(15000);

      expect(modals().length).to.equal(1);
      expect(app.timerManager.getTimer(runningId).isRunning()).to.be.false;

      document.querySelector('.allocation-modal button.btn-cancel').click();
      await tick();

      const timer = app.timerManager.getTimer(runningId);
      expect(timer.isRunning()).to.be.true;
      expect(timer.getElapsedMs()).to.be.below(15000);
      expect(localStorage.getItem('accumulated_idle_ms')).to.be.null;
    });

    it('should keep a single modal when the tab is hidden and shown again while allocating', async () => {
      seedRunningTimer();
      createApp();

      await returnAfter(15000);
      expect(modals().length).to.equal(1);

      await returnAfter(15000);
      expect(modals().length).to.equal(1);
    });

    it('should allocate the idle total shown in the modal, including time added while it was open', async () => {
      const runningId = seedRunningTimer();
      createApp();

      await returnAfter(15000);
      await returnAfter(15000);
      await tick(700);

      applyPreviousTimer();
      await tick();

      expect(app.timerManager.getTimer(runningId).getElapsedMs()).to.be.at.least(30000);
    });

    it('should still offer the previous timer after a reload while the modal was open', async () => {
      const runningId = seedRunningTimer();
      createApp();

      await returnAfter(15000);
      expect(modals().length).to.equal(1);

      // A reload fires visibilitychange -> hidden on unload before the page goes away
      hide();
      app.destroy();
      modals().forEach(el => el.remove());
      restoreHidden();

      createApp();
      await tick();

      expect(modals().length).to.equal(1);
      expect(document.querySelector('.allocation-modal input[value="previous-timer"]').disabled).to.be.false;

      applyPreviousTimer();
      await tick();

      const timer = app.timerManager.getTimer(runningId);
      expect(timer.isRunning()).to.be.true;
      expect(timer.getElapsedMs()).to.be.at.least(15000);
    });

    it('should still resume the previous timer and clear tracking if allocation throws', async () => {
      const runningId = seedRunningTimer();
      createApp();

      await returnAfter(15000);

      app.timerManager.distributeTime = () => { throw new Error('boom'); };
      applyPreviousTimer();
      await tick();

      expect(app.timerManager.getTimer(runningId).isRunning()).to.be.true;
      expect(localStorage.getItem('accumulated_idle_ms')).to.be.null;
      expect(app.allocationInProgress).to.be.false;
      expect(modals().length).to.equal(0);
    });
  });

  describe('Persistence', () => {
    it('should persist Reset All so a reload does not restore the old times', () => {
      createApp();
      const timer = app.timerManager.getAllTimers()[0];
      timer.addMs(5000);
      app.timerManager.startTimer(timer.id);

      document.getElementById('reset-all-btn').click();

      expect(app.timerManager.getRunningTimer()).to.be.null;
      const reloaded = new TimerManager();
      expect(reloaded.getRunningTimer()).to.be.null;
      reloaded.getAllTimers().forEach(t => expect(t.getElapsedMs()).to.equal(0));
    });

    it("should persist a running timer's progress as it ticks so a crash does not lose it", () => {
      createApp();
      const timer = app.timerManager.getAllTimers()[0];
      app.timerManager.startTimer(timer.id);

      timer.addMs(1000);
      app.updateAllTimerDisplays();

      const reloaded = new TimerManager();
      expect(reloaded.getTimer(timer.id).getElapsedMs()).to.be.at.least(1000);
    });
  });

  describe('Rendering', () => {
    it('should not touch the DOM on an update frame when nothing changed', () => {
      createApp();
      const card = container.querySelector('.timer-card');
      app.updateAllTimerDisplays();

      const observer = new MutationObserver(() => {});
      observer.observe(card, { attributes: true, characterData: true, childList: true, subtree: true });

      app.updateAllTimerDisplays();

      const records = observer.takeRecords();
      observer.disconnect();
      expect(records.length).to.equal(0);
    });

    it('should update the toggle button and card when the running state changes', () => {
      createApp();
      const card = container.querySelector('.timer-card');
      const button = card.querySelector('.btn');

      button.click();

      expect(button.className).to.equal('btn btn-pause');
      expect(button.textContent).to.equal('Pause');
      expect(card.classList.contains('active')).to.be.true;

      button.click();

      expect(button.className).to.equal('btn btn-start');
      expect(card.classList.contains('active')).to.be.false;
    });

    it('should reflect the trimmed title back into the input', () => {
      createApp();
      const timer = app.timerManager.getAllTimers()[0];
      const input = container.querySelector('.timer-title');

      input.value = '  Deep Work  ';
      input.dispatchEvent(new Event('blur'));

      expect(input.value).to.equal('Deep Work');
      expect(timer.title).to.equal('Deep Work');
    });
  });

  describe('Reordering', () => {
    function cards() {
      return Array.from(container.querySelectorAll('.timer-card'));
    }

    function domOrder() {
      return cards().map(card => card.dataset.timerId);
    }

    function managerOrder() {
      return app.timerManager.getAllTimers().map(timer => timer.id);
    }

    function handleOf(card) {
      return card.querySelector('.timer-drag-handle');
    }

    function dragEvent(type, extra = {}) {
      return new DragEvent(type, {
        bubbles: true,
        cancelable: true,
        dataTransfer: new DataTransfer(),
        ...extra
      });
    }

    function dragOver(target) {
      const rect = target.getBoundingClientRect();
      return target.dispatchEvent(dragEvent('dragover', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      }));
    }

    // Full native drag-and-drop sequence: press the handle, drag the card over `target`, release
    function drag(card, target) {
      handleOf(card).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      card.dispatchEvent(dragEvent('dragstart'));
      dragOver(target);
      target.dispatchEvent(dragEvent('drop'));
      card.dispatchEvent(dragEvent('dragend'));
    }

    function pressKey(element, key) {
      element.focus();
      return element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }

    function createAppWithTimers(count) {
      new TimerManager(count).persist();
      return createApp();
    }

    describe('Drag handle', () => {
      it('should render an accessible grip in each card header', () => {
        createAppWithTimers(2);

        cards().forEach(card => {
          const handle = card.querySelector('.timer-header .timer-drag-handle');
          expect(handle, 'handle in header').to.not.be.null;
          expect(handle.getAttribute('aria-label')).to.equal('Drag to reorder');
          expect(handle.title).to.equal('Drag to reorder');
          expect(handle.getAttribute('role')).to.equal('button');
          expect(handle.tabIndex).to.equal(0);
        });
      });

      it('should keep the header order as handle, title, remove button', () => {
        createAppWithTimers(1);

        const children = Array.from(container.querySelector('.timer-header').children);
        expect(children.map(el => el.className)).to.deep.equal(['timer-drag-handle', 'timer-title', 'timer-remove']);
      });

      it('should only make the card draggable while the handle is pressed', () => {
        createAppWithTimers(1);
        const [card] = cards();
        expect(card.draggable).to.be.false;

        handleOf(card).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(card.draggable).to.be.true;

        card.dispatchEvent(dragEvent('dragend'));
        expect(card.draggable).to.be.false;
      });

      it('should make the card non-draggable again after a plain click on the handle', () => {
        createAppWithTimers(1);
        const [card] = cards();

        handleOf(card).dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        handleOf(card).dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

        expect(card.draggable).to.be.false;
      });

      it('should not treat text dragged out of the title input as a card drag', () => {
        createAppWithTimers(2);
        const [first, second] = cards();

        first.querySelector('.timer-title').dispatchEvent(dragEvent('dragstart'));
        dragOver(second);

        expect(first.classList.contains('dragging')).to.be.false;
        expect(domOrder()).to.deep.equal(managerOrder());
        expect(cards()[0]).to.equal(first);
      });
    });

    describe('Drag and drop', () => {
      it('should mark the card as dragging and allow a move while a drag is in progress', () => {
        createAppWithTimers(2);
        const [first, second] = cards();
        const start = dragEvent('dragstart');

        first.dispatchEvent(start);

        expect(first.classList.contains('dragging')).to.be.true;
        // effectAllowed is read-only on a DataTransfer outside a real drag session, so only the data is checked
        expect(start.dataTransfer.getData('text/plain')).to.equal(first.dataset.timerId);
        expect(dragOver(second), 'dragover default should be prevented so a drop is allowed').to.be.false;
      });

      it('should move a card after the card it is dragged over when moving later', () => {
        createAppWithTimers(3);
        const [a, b, c] = cards();

        drag(a, c);

        expect(cards()).to.deep.equal([b, c, a]);
        expect(managerOrder()).to.deep.equal([b, c, a].map(card => card.dataset.timerId));
        expect(a.classList.contains('dragging')).to.be.false;
      });

      it('should move a card before the card it is dragged over when moving earlier', () => {
        createAppWithTimers(3);
        const [a, b, c] = cards();

        drag(c, a);

        expect(cards()).to.deep.equal([c, a, b]);
        expect(managerOrder()).to.deep.equal([c, a, b].map(card => card.dataset.timerId));
      });

      it('should leave the order alone when dragged over itself or the grid gap', () => {
        createAppWithTimers(3);
        const [a, b, c] = cards();

        a.dispatchEvent(dragEvent('dragstart'));
        dragOver(a);
        dragOver(container.querySelector('#timer-container'));
        a.dispatchEvent(dragEvent('dragend'));

        expect(cards()).to.deep.equal([a, b, c]);
      });

      it('should not persist when a drag ends where it started', () => {
        createAppWithTimers(2);
        const [a, b] = cards();
        let persisted = 0;
        const persist = app.timerManager.persist.bind(app.timerManager);
        app.timerManager.persist = () => { persisted++; return persist(); };

        drag(a, a);

        expect(cards()).to.deep.equal([a, b]);
        expect(persisted).to.equal(0);
      });

      it('should keep the running timer running across a drop', () => {
        createAppWithTimers(3);
        const [a, , c] = cards();
        const runningId = a.dataset.timerId;
        a.querySelector('.btn').click();

        drag(a, c);

        expect(app.timerManager.getRunningTimer().id).to.equal(runningId);
        expect(app.timerManager.getAllTimers().filter(t => t.isRunning())).to.have.lengthOf(1);
        expect(a.classList.contains('active')).to.be.true;
      });

      it('should keep updating the moved card through the existing element map', () => {
        createAppWithTimers(3);
        const [a, , c] = cards();
        const timer = app.timerManager.getTimer(a.dataset.timerId);

        drag(a, c);
        timer.addMs(61000);
        app.updateAllTimerDisplays();

        expect(app.timerElements.get(timer.id)).to.equal(a);
        expect(a.querySelector('.timer-display').textContent).to.equal('00:01:01');
      });

      it('should persist the dropped order so a reloaded app renders it', () => {
        createAppWithTimers(3);
        const [a, b, c] = cards();
        drag(a, c);
        const expected = [b, c, a].map(card => card.dataset.timerId);

        app.destroy();
        createApp();

        expect(domOrder()).to.deep.equal(expected);
        expect(managerOrder()).to.deep.equal(expected);
      });

      it('should still append new timers after a reorder', () => {
        createAppWithTimers(3);
        const [a, , c] = cards();
        drag(a, c);

        document.getElementById('add-timer-btn').click();

        const added = app.timerManager.getAllTimers()[3];
        expect(domOrder()[3]).to.equal(added.id);
        expect(cards()).to.have.lengthOf(4);
      });
    });

    describe('Keyboard', () => {
      it('should move the timer one position later on ArrowRight and keep focus on the handle', () => {
        createAppWithTimers(3);
        const [a, b, c] = cards();
        const handle = handleOf(a);

        const notCancelled = pressKey(handle, 'ArrowRight');

        expect(notCancelled).to.be.false;
        expect(cards()).to.deep.equal([b, a, c]);
        expect(managerOrder()).to.deep.equal([b, a, c].map(card => card.dataset.timerId));
        expect(document.activeElement).to.equal(handle);
      });

      it('should move the timer one position earlier on ArrowLeft', () => {
        createAppWithTimers(3);
        const [a, b, c] = cards();

        pressKey(handleOf(c), 'ArrowLeft');

        expect(cards()).to.deep.equal([a, c, b]);
        expect(managerOrder()).to.deep.equal([a, c, b].map(card => card.dataset.timerId));
      });

      it('should treat ArrowDown as later and ArrowUp as earlier', () => {
        createAppWithTimers(3);
        const [a, b, c] = cards();

        pressKey(handleOf(a), 'ArrowDown');
        expect(cards()).to.deep.equal([b, a, c]);

        pressKey(handleOf(a), 'ArrowUp');
        expect(cards()).to.deep.equal([a, b, c]);
      });

      it('should ignore moves past either end and other keys', () => {
        createAppWithTimers(2);
        const [a, b] = cards();

        pressKey(handleOf(a), 'ArrowLeft');
        pressKey(handleOf(b), 'ArrowRight');
        const notCancelled = pressKey(handleOf(a), 'Enter');

        expect(notCancelled).to.be.true;
        expect(cards()).to.deep.equal([a, b]);
        expect(document.activeElement).to.equal(handleOf(a));
      });

      it('should persist keyboard moves so a reloaded app renders the new order', () => {
        createAppWithTimers(3);
        const [a, b, c] = cards();
        pressKey(handleOf(c), 'ArrowLeft');
        pressKey(handleOf(c), 'ArrowLeft');
        const expected = [c, a, b].map(card => card.dataset.timerId);

        app.destroy();
        createApp();

        expect(domOrder()).to.deep.equal(expected);
      });
    });
  });
});
