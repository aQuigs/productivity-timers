import { expect } from '@esm-bundle/chai';
import { App } from '../js/app.js';
import { TimerManager } from '../js/timerManager.js';
import { setHidden, restoreHidden, dispatchVisibilityChange, heartbeatAgo, atPreviewPath } from './helpers.js';

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

  function createApp(options) {
    app = new App(options);
    app.init();
    return app;
  }

  function fakeNotifier() {
    return {
      requests: 0,
      notifications: [],
      requestPermission() {
        this.requests++;
      },
      notify(title, body) {
        this.notifications.push({ title, body });
      }
    };
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
    applyDefault();
  }

  function applyDefault() {
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

    it('should add idle time to the previously running timer when Apply is clicked without choosing a strategy', async () => {
      const runningId = seedRunningTimer();
      heartbeatAgo(15000);

      createApp();
      await tick();

      applyDefault();
      await tick();

      const timer = app.timerManager.getTimer(runningId);
      expect(timer.getElapsedMs()).to.be.at.least(15000);
      expect(timer.isRunning()).to.be.true;
      expect(modals().length).to.equal(0);
    });

    it('should discard idle time by default when nothing was running before', async () => {
      heartbeatAgo(15000);

      createApp();
      await tick();

      applyDefault();
      await tick();

      const elapsed = app.timerManager.getAllTimers().map(timer => timer.getElapsedMs());
      expect(elapsed).to.not.be.empty;
      expect(elapsed.every(ms => ms === 0)).to.be.true;
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

    it('should fall back to the browser notifier when none is injected', () => {
      createApp();
      expect(app.notifier.requestPermission).to.be.a('function');
      expect(app.notifier.notify).to.be.a('function');
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

  describe('Goals', () => {
    const TEN_SECONDS = 10000;
    let notifier;

    beforeEach(() => {
      notifier = fakeNotifier();
    });

    function firstCard() {
      return container.querySelector('.timer-card');
    }

    function goalButton(card) {
      return card.querySelector('.timer-goal-btn');
    }

    function goalInput(card) {
      return card.querySelector('.timer-goal-input');
    }

    function goalEditor(card) {
      return card.querySelector('.timer-goal-editor');
    }

    function kindRadio(card, kind) {
      return card.querySelector(`.timer-goal-kind input[value="${kind}"]`);
    }

    // Focus leaving the goal input, as when the user clicks or tabs away
    function focusOut(card, relatedTarget = null) {
      goalInput(card).dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget }));
    }

    function progress(card) {
      return card.querySelector('.timer-progress');
    }

    function progressBar(card) {
      return card.querySelector('.timer-progress-bar');
    }

    function keydown(input, key) {
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
    }

    function enterGoal(card, text) {
      goalButton(card).click();
      const input = goalInput(card);
      input.value = text;
      keydown(input, 'Enter');
    }

    function observeMutations(card, action) {
      const observer = new MutationObserver(() => {});
      observer.observe(card, { attributes: true, characterData: true, childList: true, subtree: true });
      action();
      const records = observer.takeRecords();
      observer.disconnect();
      return records;
    }

    describe('editing', () => {
      it('should offer a Set goal control and no progress bar for a timer without a goal', () => {
        createApp({ notifier });
        const card = firstCard();

        expect(goalButton(card).textContent).to.equal('Set goal or budget');
        expect(goalButton(card).classList.contains('is-set')).to.be.false;
        expect(goalEditor(card).hidden).to.be.true;
        expect(progress(card).hidden).to.be.true;
        expect(card.classList.contains('over-target')).to.be.false;
      });

      it('should reveal the goal input in place of the button when clicked', () => {
        createApp({ notifier });
        const card = firstCard();

        goalButton(card).click();

        expect(goalEditor(card).hidden).to.be.false;
        expect(goalButton(card).hidden).to.be.true;
        expect(goalInput(card).placeholder).to.equal('25m, 2h, 1:30');
      });

      it('should apply the typed goal on Enter, show it as a chip and persist it', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];

        enterGoal(card, '25m');

        expect(timer.targetMs).to.equal(25 * 60 * 1000);
        expect(goalButton(card).textContent).to.equal('Goal 00:25:00');
        expect(goalButton(card).classList.contains('is-set')).to.be.true;
        expect(goalButton(card).hidden).to.be.false;
        expect(goalEditor(card).hidden).to.be.true;
        expect(progress(card).hidden).to.be.false;
        expect(new TimerManager().getTimer(timer.id).targetMs).to.equal(25 * 60 * 1000);
      });

      it('should apply the typed goal on blur', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];

        goalButton(card).click();
        goalInput(card).value = '2h';
        focusOut(card);

        expect(timer.targetMs).to.equal(2 * 60 * 60 * 1000);
        expect(goalEditor(card).hidden).to.be.true;
      });

      it('should prefill the input with the current goal when editing again', () => {
        createApp({ notifier });
        const card = firstCard();
        enterGoal(card, '1h30m');

        goalButton(card).click();

        expect(goalInput(card).value).to.equal('01:30:00');
      });

      it('should cancel the edit on Escape without changing the goal', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '25m');

        goalButton(card).click();
        goalInput(card).value = '5m';
        keydown(goalInput(card), 'Escape');

        expect(timer.targetMs).to.equal(25 * 60 * 1000);
        expect(goalEditor(card).hidden).to.be.true;
        expect(goalButton(card).hidden).to.be.false;
        expect(goalButton(card).textContent).to.equal('Goal 00:25:00');
      });

      it('should not re-apply a cancelled edit when the hidden input later blurs', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];

        goalButton(card).click();
        goalInput(card).value = '5m';
        keydown(goalInput(card), 'Escape');
        focusOut(card);

        expect(timer.targetMs).to.be.null;
      });

      it('should clear the goal when the input is emptied', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '25m');

        enterGoal(card, '   ');

        expect(timer.targetMs).to.be.null;
        expect(goalButton(card).textContent).to.equal('Set goal or budget');
        expect(goalButton(card).classList.contains('is-set')).to.be.false;
        expect(progress(card).hidden).to.be.true;
        expect(new TimerManager().getTimer(timer.id).targetMs).to.be.null;
      });

      it('should render the chip and progress bar for a goal restored from storage', () => {
        const seed = new TimerManager();
        const timerId = seed.getAllTimers()[1].id;
        seed.setTimerTarget(timerId, 2 * 60 * 60 * 1000);

        createApp({ notifier });
        const card = container.querySelectorAll('.timer-card')[1];

        expect(goalButton(card).textContent).to.equal('Goal 02:00:00');
        expect(progress(card).hidden).to.be.false;
      });
    });

    describe('unreadable input', () => {
      const ERROR_MESSAGE = "Couldn't read that time. Try 25m, 1h 30m or 1:30";

      function goalError(card) {
        return card.querySelector('.timer-goal-error');
      }

      function expectInvalid(card) {
        const input = goalInput(card);
        const error = goalError(card);
        expect(goalEditor(card).hidden).to.be.false;
        expect(input.classList.contains('is-invalid')).to.be.true;
        expect(input.getAttribute('aria-invalid')).to.equal('true');
        expect(error.hidden).to.be.false;
        expect(error.textContent).to.equal(ERROR_MESSAGE);
        expect(error.getAttribute('role')).to.equal('alert');
        expect(error.id).to.be.a('string').that.is.not.empty;
        expect(input.getAttribute('aria-describedby')).to.equal(error.id);
      }

      function expectValid(card) {
        const input = goalInput(card);
        expect(input.classList.contains('is-invalid')).to.be.false;
        expect(input.hasAttribute('aria-invalid')).to.be.false;
        expect(input.hasAttribute('aria-describedby')).to.be.false;
        expect(goalError(card).hidden).to.be.true;
      }

      it('should build the error element into the card, hidden and inside the goal block', () => {
        createApp({ notifier });
        const card = firstCard();

        const error = goalError(card);
        expect(error).to.not.be.null;
        expect(error.hidden).to.be.true;
        expect(error.closest('.timer-goal')).to.not.be.null;
      });

      it('should keep the editor open with an error on Enter and leave the goal alone', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '25m');

        enterGoal(card, 'soon');

        expectInvalid(card);
        expect(goalInput(card).value).to.equal('soon');
        expect(goalButton(card).hidden).to.be.true;
        expect(timer.targetMs).to.equal(25 * 60 * 1000);
        expect(notifier.requests).to.equal(1);
      });

      it('should keep focus in the input without selecting the text on an invalid Enter', () => {
        createApp({ notifier });
        const card = firstCard();

        enterGoal(card, 'soon');

        const input = goalInput(card);
        expect(document.activeElement.classList.contains('timer-goal-input')).to.be.true;
        expect(input.selectionStart).to.equal(input.selectionEnd);
      });

      it('should keep the editor open with an error when the input blurs with unreadable text', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];

        goalButton(card).click();
        goalInput(card).value = 'soon';
        focusOut(card);

        expectInvalid(card);
        expect(goalInput(card).value).to.equal('soon');
        expect(timer.targetMs).to.be.null;
        expect(notifier.requests).to.equal(0);
      });

      it('should clear the error as soon as the user types again', () => {
        createApp({ notifier });
        const card = firstCard();
        enterGoal(card, 'soon');

        goalInput(card).value = 'soo';
        goalInput(card).dispatchEvent(new Event('input'));

        expectValid(card);
        expect(goalEditor(card).hidden).to.be.false;
      });

      it('should close the editor and clear the error on Escape', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, 'soon');

        keydown(goalInput(card), 'Escape');

        expectValid(card);
        expect(goalEditor(card).hidden).to.be.true;
        expect(goalButton(card).hidden).to.be.false;
        expect(timer.targetMs).to.be.null;
      });

      it('should set the goal and clear the error when valid text follows an invalid attempt', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, 'soon');

        goalInput(card).value = '25m';
        keydown(goalInput(card), 'Enter');

        expectValid(card);
        expect(goalEditor(card).hidden).to.be.true;
        expect(timer.targetMs).to.equal(25 * 60 * 1000);
        expect(goalButton(card).textContent).to.equal('Goal 00:25:00');
        expect(notifier.requests).to.equal(1);
      });
    });

    describe('permission', () => {
      it('should request notification permission when a goal is set', () => {
        createApp({ notifier });
        enterGoal(firstCard(), '25m');
        expect(notifier.requests).to.equal(1);
      });

      it('should not request permission on load, even with a saved goal', () => {
        const seed = new TimerManager();
        seed.setTimerTarget(seed.getAllTimers()[0].id, TEN_SECONDS);

        createApp({ notifier });
        app.updateAllTimerDisplays();

        expect(notifier.requests).to.equal(0);
      });

      it('should not request permission when clearing a goal or cancelling', () => {
        createApp({ notifier });
        const card = firstCard();

        enterGoal(card, '');
        goalButton(card).click();
        keydown(goalInput(card), 'Escape');

        expect(notifier.requests).to.equal(0);
      });
    });

    describe('progress', () => {
      it('should size the bar to the whole-number percentage of the goal', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '10s');

        timer.addMs(2500);
        app.updateAllTimerDisplays();

        expect(progressBar(card).style.width).to.equal('25%');
      });

      it('should leave the DOM alone until the whole-number percentage changes', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '10s');
        timer.addMs(2500);
        app.updateAllTimerDisplays();

        timer.addMs(40);
        const records = observeMutations(card, () => app.updateAllTimerDisplays());

        expect(records.length).to.equal(0);

        timer.addMs(60);
        app.updateAllTimerDisplays();
        expect(progressBar(card).style.width).to.equal('26%');
      });

      it('should mark the card, fill the bar and label the chip once the goal is reached', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '10s');

        timer.addMs(TEN_SECONDS);
        app.updateAllTimerDisplays();

        expect(card.classList.contains('over-target')).to.be.true;
        expect(progressBar(card).style.width).to.equal('100%');
        expect(goalButton(card).textContent).to.equal('Goal 00:00:10 · reached');

        timer.addMs(TEN_SECONDS);
        app.updateAllTimerDisplays();
        expect(progressBar(card).style.width).to.equal('100%');
      });

      it('should not touch the DOM on later frames while staying over the goal', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '10s');
        timer.addMs(TEN_SECONDS + 500);
        app.updateAllTimerDisplays();

        timer.addMs(200);
        const records = observeMutations(card, () => app.updateAllTimerDisplays());

        expect(records.length).to.equal(0);
      });

      it('should drop the reached state after a reset', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '10s');
        timer.addMs(TEN_SECONDS);
        app.updateAllTimerDisplays();

        document.getElementById('reset-all-btn').click();

        expect(card.classList.contains('over-target')).to.be.false;
        expect(progressBar(card).style.width).to.equal('0%');
        expect(goalButton(card).textContent).to.equal('Goal 00:00:10');
      });
    });

    describe('notification', () => {
      it('should notify once when a timer crosses its goal', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '10s');

        timer.addMs(TEN_SECONDS - 1000);
        app.updateAllTimerDisplays();
        expect(notifier.notifications).to.have.lengthOf(0);

        timer.addMs(1000);
        app.updateAllTimerDisplays();
        expect(notifier.notifications).to.deep.equal([
          { title: 'Goal reached', body: 'Timer 1 hit 00:00:10' }
        ]);

        timer.addMs(5000);
        app.updateAllTimerDisplays();
        app.updateAllTimerDisplays();
        expect(notifier.notifications).to.have.lengthOf(1);
      });

      it('should notify again after a reset re-crosses the goal', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '10s');
        timer.addMs(TEN_SECONDS);
        app.updateAllTimerDisplays();

        document.getElementById('reset-all-btn').click();
        timer.addMs(TEN_SECONDS);
        app.updateAllTimerDisplays();

        expect(notifier.notifications).to.have.lengthOf(2);
      });

      it('should re-arm when the goal is raised above the elapsed time', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '10s');
        timer.addMs(TEN_SECONDS);
        app.updateAllTimerDisplays();

        enterGoal(card, '1h');
        expect(card.classList.contains('over-target')).to.be.false;
        expect(goalButton(card).textContent).to.equal('Goal 01:00:00');

        timer.addMs(60 * 60 * 1000);
        app.updateAllTimerDisplays();

        expect(notifier.notifications).to.have.lengthOf(2);
        expect(notifier.notifications[1].body).to.equal('Timer 1 hit 01:00:00');
      });

      it('should not notify when a goal is set below the time already elapsed', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        timer.addMs(2 * TEN_SECONDS);

        enterGoal(card, '10s');
        app.updateAllTimerDisplays();

        expect(card.classList.contains('over-target')).to.be.true;
        expect(notifier.notifications).to.have.lengthOf(0);
      });

      it('should not notify for a timer already past its goal when the app loads', () => {
        const seed = new TimerManager();
        const timer = seed.getAllTimers()[0];
        timer.addMs(2 * TEN_SECONDS);
        seed.setTimerTarget(timer.id, TEN_SECONDS);

        createApp({ notifier });
        app.updateAllTimerDisplays();

        const card = firstCard();
        expect(card.classList.contains('over-target')).to.be.true;
        expect(goalButton(card).textContent).to.equal('Goal 00:00:10 · reached');
        expect(notifier.notifications).to.have.lengthOf(0);
      });

      it('should notify when allocated idle time carries a timer past its goal', async () => {
        const runningId = seedRunningTimer();
        new TimerManager().setTimerTarget(runningId, TEN_SECONDS);
        heartbeatAgo(15000);

        createApp({ notifier });
        await tick();
        expect(notifier.notifications).to.have.lengthOf(0);

        applyPreviousTimer();
        await tick();
        app.updateAllTimerDisplays();

        expect(notifier.notifications).to.deep.equal([
          { title: 'Goal reached', body: 'Timer 1 hit 00:00:10' }
        ]);
      });

      it('should forget a removed timer so a new card with the same slot starts clean', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '10s');
        timer.addMs(TEN_SECONDS);
        app.updateAllTimerDisplays();

        card.querySelector('.timer-remove').click();

        expect(app.goalReachedTimers.has(timer.id)).to.be.false;
        expect(app.lastDisplayedGoals.has(timer.id)).to.be.false;
      });
    });

    describe('budget', () => {
      function enterTarget(card, kind, text) {
        goalButton(card).click();
        kindRadio(card, kind).click();
        goalInput(card).value = text;
        keydown(goalInput(card), 'Enter');
      }

      function enterBudget(card, text) {
        enterTarget(card, 'budget', text);
      }

      // Comparing elements with `equal` is avoided on purpose: on failure the
      // runner tries to serialise them and never finishes
      function hasFocus(element) {
        return document.activeElement === element;
      }

      function pointerDown(target) {
        target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerType: 'touch' }));
      }

      describe('kind toggle', () => {
        it('should offer Goal and Budget in the editor with Goal preselected for a fresh timer', () => {
          createApp({ notifier });
          const card = firstCard();

          goalButton(card).click();

          const group = card.querySelector('.timer-goal-kind');
          expect(group.getAttribute('role')).to.equal('radiogroup');
          expect(group.getAttribute('aria-label')).to.be.a('string').that.is.not.empty;
          expect(goalEditor(card).contains(group)).to.be.true;
          expect(kindRadio(card, 'goal').checked).to.be.true;
          expect(kindRadio(card, 'budget').checked).to.be.false;
          expect(goalButton(card).title).to.equal('Set a goal or budget for this timer');
        });

        it('should keep the radios of different cards independent', () => {
          createApp({ notifier });
          const [first, second] = container.querySelectorAll('.timer-card');

          goalButton(first).click();
          kindRadio(first, 'budget').click();

          expect(kindRadio(first, 'goal').name).to.not.equal(kindRadio(second, 'goal').name);
          expect(kindRadio(second, 'goal').checked).to.be.true;
        });

        it('should apply the typed time as a budget, show it as a chip and persist the kind', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];

          enterBudget(card, '2h');

          expect(timer.targetMs).to.equal(2 * 60 * 60 * 1000);
          expect(timer.targetKind).to.equal('budget');
          expect(goalButton(card).textContent).to.equal('Budget 02:00:00');
          expect(goalButton(card).title).to.equal('Edit budget');
          expect(goalButton(card).classList.contains('is-set')).to.be.true;
          expect(goalEditor(card).hidden).to.be.true;
          expect(progress(card).hidden).to.be.false;
          expect(progress(card).getAttribute('aria-label')).to.equal('Budget used');
          expect(notifier.requests).to.equal(1);

          const restored = new TimerManager().getTimer(timer.id);
          expect(restored.targetKind).to.equal('budget');
          expect(restored.targetMs).to.equal(2 * 60 * 60 * 1000);
        });

        it('should label a goal chip for editing and its bar as progress', () => {
          createApp({ notifier });
          const card = firstCard();

          enterGoal(card, '25m');

          expect(goalButton(card).title).to.equal('Edit goal');
          expect(progress(card).getAttribute('aria-label')).to.equal('Progress toward goal');
        });

        it('should preselect the current kind when editing again', () => {
          createApp({ notifier });
          const card = firstCard();
          enterBudget(card, '2h');

          goalButton(card).click();

          expect(kindRadio(card, 'budget').checked).to.be.true;
          expect(goalInput(card).value).to.equal('02:00:00');
        });

        it('should switch a goal to a budget of the same length and redraw the chip', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          enterGoal(card, '25m');

          enterBudget(card, '25m');

          expect(timer.targetKind).to.equal('budget');
          expect(goalButton(card).textContent).to.equal('Budget 00:25:00');
        });

        it('should render a budget restored from storage', () => {
          const seed = new TimerManager();
          const timerId = seed.getAllTimers()[1].id;
          seed.setTimerTarget(timerId, 2 * 60 * 60 * 1000, 'budget');

          createApp({ notifier });
          const card = container.querySelectorAll('.timer-card')[1];

          expect(goalButton(card).textContent).to.equal('Budget 02:00:00');
          expect(progress(card).hidden).to.be.false;
        });

        it('should clear a budget when the input is emptied', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          enterBudget(card, '2h');

          enterGoal(card, '');

          expect(timer.targetMs).to.be.null;
          expect(timer.targetKind).to.be.null;
          expect(goalButton(card).textContent).to.equal('Set goal or budget');
        });
      });

      describe('focus while switching kind', () => {
        it('should keep focus in the input when the kind toggle is clicked with a mouse', () => {
          createApp({ notifier });
          const card = firstCard();
          goalButton(card).click();

          const label = kindRadio(card, 'budget').closest('label');
          const mousedown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
          label.dispatchEvent(mousedown);

          expect(mousedown.defaultPrevented).to.be.true;
          expect(hasFocus(goalInput(card))).to.be.true;
        });

        it('should not apply the edit when focus moves from the input to the kind toggle', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          goalButton(card).click();
          goalInput(card).value = '2h';

          focusOut(card, kindRadio(card, 'budget'));

          expect(timer.targetMs).to.be.null;
          expect(goalEditor(card).hidden).to.be.false;
        });

        it('should apply the edit when focus leaves the editor from the kind toggle', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          goalButton(card).click();
          goalInput(card).value = '2h';
          const budget = kindRadio(card, 'budget');
          budget.click();

          budget.dispatchEvent(new FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));

          expect(timer.targetMs).to.equal(2 * 60 * 60 * 1000);
          expect(timer.targetKind).to.equal('budget');
          expect(goalEditor(card).hidden).to.be.true;
        });

        it('should keep the editor open when a tap on the kind toggle blurs the input, then hand focus back', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          goalButton(card).click();
          goalInput(card).value = '2h';
          const budget = kindRadio(card, 'budget');

          // Touch screens blur the input before the tap reaches the radio
          pointerDown(budget.closest('label'));
          goalInput(card).blur();

          expect(timer.targetMs).to.be.null;
          expect(goalEditor(card).hidden).to.be.false;
          expect(goalEditor(card).contains(document.activeElement)).to.be.false;

          budget.click();

          expect(budget.checked).to.be.true;
          expect(hasFocus(goalInput(card))).to.be.true;

          keydown(goalInput(card), 'Enter');
          expect(timer.targetMs).to.equal(2 * 60 * 60 * 1000);
          expect(timer.targetKind).to.equal('budget');
        });

        it('should apply the edit when a tap elsewhere blurs the input', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          goalButton(card).click();
          kindRadio(card, 'budget').click();
          goalInput(card).value = '2h';

          pointerDown(document.body);
          goalInput(card).blur();

          expect(timer.targetMs).to.equal(2 * 60 * 60 * 1000);
          expect(timer.targetKind).to.equal('budget');
          expect(goalEditor(card).hidden).to.be.true;
        });

        it('should apply the edit on a bare blur, as when the window loses focus', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          goalButton(card).click();
          goalInput(card).value = '25m';

          goalInput(card).blur();

          expect(timer.targetMs).to.equal(25 * 60 * 1000);
          expect(goalEditor(card).hidden).to.be.true;
        });

        it('should leave focus on the radio when the kind is changed from the keyboard', () => {
          createApp({ notifier });
          const card = firstCard();
          goalButton(card).click();
          const budget = kindRadio(card, 'budget');
          budget.focus();

          budget.checked = true;
          budget.dispatchEvent(new Event('change', { bubbles: true }));

          expect(hasFocus(budget)).to.be.true;
          expect(goalEditor(card).hidden).to.be.false;
        });

        it('should stop tracking the pointer once destroyed', () => {
          createApp({ notifier });
          const card = firstCard();
          goalButton(card).click();

          app.destroy();
          pointerDown(kindRadio(card, 'budget').closest('label'));

          expect(app.pointerDownEditor).to.be.null;
          app = null;
        });
      });

      describe('exceeding', () => {
        it('should mark the card over budget, not over target, once the budget is used up', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          enterBudget(card, '10s');
          timer.addMs(TEN_SECONDS - 1);
          app.updateAllTimerDisplays();

          expect(card.classList.contains('over-budget')).to.be.false;
          expect(goalButton(card).textContent).to.equal('Budget 00:00:10');

          timer.addMs(1);
          app.updateAllTimerDisplays();

          expect(card.classList.contains('over-budget')).to.be.true;
          expect(card.classList.contains('over-target')).to.be.false;
          expect(progressBar(card).style.width).to.equal('100%');
          expect(goalButton(card).textContent).to.equal('Budget 00:00:10 · exceeded');
        });

        it('should never mark a goal card as over budget', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          enterGoal(card, '10s');

          timer.addMs(TEN_SECONDS);
          app.updateAllTimerDisplays();

          expect(card.classList.contains('over-target')).to.be.true;
          expect(card.classList.contains('over-budget')).to.be.false;
        });

        it('should swap the over state when an exceeded budget becomes a goal, without notifying again', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          enterBudget(card, '10s');
          timer.addMs(TEN_SECONDS);
          app.updateAllTimerDisplays();
          expect(notifier.notifications).to.have.lengthOf(1);

          enterTarget(card, 'goal', '10s');
          app.updateAllTimerDisplays();

          expect(card.classList.contains('over-budget')).to.be.false;
          expect(card.classList.contains('over-target')).to.be.true;
          expect(goalButton(card).textContent).to.equal('Goal 00:00:10 · reached');
          expect(notifier.notifications).to.have.lengthOf(1);
        });

        it('should drop the over-budget state after a reset', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          enterBudget(card, '10s');
          timer.addMs(TEN_SECONDS);
          app.updateAllTimerDisplays();

          document.getElementById('reset-all-btn').click();

          expect(card.classList.contains('over-budget')).to.be.false;
          expect(goalButton(card).textContent).to.equal('Budget 00:00:10');
        });

        it('should notify once when a timer exceeds its budget', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          enterBudget(card, '10s');

          timer.addMs(TEN_SECONDS - 1000);
          app.updateAllTimerDisplays();
          expect(notifier.notifications).to.have.lengthOf(0);

          timer.addMs(1000);
          app.updateAllTimerDisplays();
          expect(notifier.notifications).to.deep.equal([
            { title: 'Budget exceeded', body: 'Timer 1 passed 00:00:10' }
          ]);

          timer.addMs(5000);
          app.updateAllTimerDisplays();
          expect(notifier.notifications).to.have.lengthOf(1);
        });

        it('should not notify for a budget set below the time already elapsed', () => {
          createApp({ notifier });
          const card = firstCard();
          const timer = app.timerManager.getAllTimers()[0];
          timer.addMs(2 * TEN_SECONDS);

          enterBudget(card, '10s');
          app.updateAllTimerDisplays();

          expect(card.classList.contains('over-budget')).to.be.true;
          expect(goalButton(card).textContent).to.equal('Budget 00:00:10 · exceeded');
          expect(notifier.notifications).to.have.lengthOf(0);
        });
      });
    });
  });

  describe('PR Preview Isolation', () => {
    it('should keep a preview\'s timers apart from production\'s', async () => {
      const prodId = seedRunningTimer();
      const prodState = localStorage.getItem('productivity-timers-v1');

      await atPreviewPath('pr-12', async () => {
        createApp();
        await tick();
        app.timerManager.startTimer(app.timerManager.getAllTimers()[0].id);
      });

      expect(app.timerManager.getAllTimers().map(t => t.id)).to.not.include(prodId);
      expect(localStorage.getItem('pr-12:productivity-timers-v1')).to.not.be.null;
      expect(localStorage.getItem('productivity-timers-v1')).to.equal(prodState);
    });

    it('should not open the allocation modal for idle time that belongs to production', async () => {
      heartbeatAgo(15000);

      await atPreviewPath('pr-12', async () => {
        createApp();
        await tick();
      });

      expect(modals().length).to.equal(0);
      expect(localStorage.getItem('accumulated_idle_ms')).to.be.null;
    });

    it('should remember hidden running timers and the heartbeat per preview', async () => {
      await atPreviewPath('pr-12', async () => {
        createApp();
        await tick();
        const id = app.timerManager.getAllTimers()[0].id;
        app.timerManager.startTimer(id);

        hide();

        expect(JSON.parse(localStorage.getItem('pr-12:app_hidden_running_timers'))).to.deep.equal([id]);
        expect(localStorage.getItem('app_hidden_running_timers')).to.be.null;
        expect(localStorage.getItem('pr-12:last_heartbeat')).to.not.be.null;
        expect(localStorage.getItem('last_heartbeat')).to.be.null;
      });
    });
  });
});
