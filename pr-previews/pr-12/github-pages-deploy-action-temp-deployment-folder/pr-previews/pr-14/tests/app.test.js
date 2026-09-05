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

        expect(goalButton(card).textContent).to.equal('Set goal');
        expect(goalButton(card).classList.contains('is-set')).to.be.false;
        expect(goalInput(card).hidden).to.be.true;
        expect(progress(card).hidden).to.be.true;
        expect(card.classList.contains('over-target')).to.be.false;
      });

      it('should reveal the goal input in place of the button when clicked', () => {
        createApp({ notifier });
        const card = firstCard();

        goalButton(card).click();

        expect(goalInput(card).hidden).to.be.false;
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
        expect(goalInput(card).hidden).to.be.true;
        expect(progress(card).hidden).to.be.false;
        expect(new TimerManager().getTimer(timer.id).targetMs).to.equal(25 * 60 * 1000);
      });

      it('should apply the typed goal on blur', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];

        goalButton(card).click();
        goalInput(card).value = '2h';
        goalInput(card).dispatchEvent(new Event('blur'));

        expect(timer.targetMs).to.equal(2 * 60 * 60 * 1000);
        expect(goalInput(card).hidden).to.be.true;
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
        expect(goalInput(card).hidden).to.be.true;
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
        goalInput(card).dispatchEvent(new Event('blur'));

        expect(timer.targetMs).to.be.null;
      });

      it('should clear the goal when the input is emptied', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '25m');

        enterGoal(card, '   ');

        expect(timer.targetMs).to.be.null;
        expect(goalButton(card).textContent).to.equal('Set goal');
        expect(goalButton(card).classList.contains('is-set')).to.be.false;
        expect(progress(card).hidden).to.be.true;
        expect(new TimerManager().getTimer(timer.id).targetMs).to.be.null;
      });

      it('should keep the previous goal when the input is not a valid duration', () => {
        createApp({ notifier });
        const card = firstCard();
        const timer = app.timerManager.getAllTimers()[0];
        enterGoal(card, '25m');

        enterGoal(card, 'soon');

        expect(timer.targetMs).to.equal(25 * 60 * 1000);
        expect(goalInput(card).hidden).to.be.true;
        expect(goalButton(card).textContent).to.equal('Goal 00:25:00');
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
  });
});
