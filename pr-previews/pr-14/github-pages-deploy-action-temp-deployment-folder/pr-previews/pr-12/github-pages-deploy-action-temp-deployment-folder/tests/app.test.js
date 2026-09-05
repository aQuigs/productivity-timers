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
});
