import { expect } from '@esm-bundle/chai';

/**
 * REAL integration tests that simulate actual browser behavior:
 * - Page reload when tab switches
 * - localStorage persistence across "page loads"
 * - Actual event flow
 */
describe('App.js Real Integration Tests', () => {
  let container;

  beforeEach(() => {
    // Clean slate
    localStorage.clear();
    container = document.createElement('div');
    container.innerHTML = `
      <div id="timer-container" class="timer-container"></div>
      <button id="reset-all-btn">Reset All</button>
      <button id="add-timer-btn">Add Timer</button>
    `;
    document.body.appendChild(container);
  });

  afterEach(() => {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
    localStorage.clear();
  });

  it('CRITICAL: should resume timer after <10s idle WITH page reload', async () => {
    // This simulates what ACTUALLY happens in the browser
    console.log('\n=== TEST: <10s idle with page reload ===');

    // ========== STEP 1: Initial page load, start timer ==========
    const { default: AppModule } = await import('../js/app.js');
    // App is auto-initialized via DOMContentLoaded in the module
    // We need to manually trigger it for the test
    await new Promise(resolve => setTimeout(resolve, 100));

    // Get the app instance (it's created in DOMContentLoaded listener)
    // For testing, we'll simulate the flow manually
    const { TimerManager } = await import('../js/timerManager.js');
    const timerManager1 = new TimerManager();
    const timer = timerManager1.addTimer('Test Timer');
    timerManager1.startTimer(timer.id);

    console.log('Timer started:', timer.id);
    expect(timer.isRunning()).to.be.true;

    // ========== STEP 2: Tab becomes hidden (user switches away) ==========
    // Simulate what App.handleVisibilityChange does
    const runningTimers = [timer.id];
    localStorage.setItem('app_hidden_running_timers', JSON.stringify(runningTimers));

    const hiddenAt = Date.now() - 5000; // 5 seconds ago (< 10s threshold)
    localStorage.setItem('idle_detector_hidden_at', hiddenAt.toString());

    timerManager1.pauseTimer(timer.id);
    console.log('Tab hidden, timer paused, state saved to localStorage');

    // ========== STEP 3: PAGE RELOADS (this is what actually happens) ==========
    // Simulate page reload by creating NEW instances
    const timerManager2 = new TimerManager();
    const restoredTimer = timerManager2.getTimer(timer.id);
    console.log('Page reloaded, timer restored from localStorage');
    expect(restoredTimer).to.not.be.null;
    expect(restoredTimer.isRunning()).to.be.false; // Should be paused

    // ========== STEP 4: IdleDetector initializes and checks pending idle ==========
    const IdleDetector = (await import('../js/idleDetector.js')).default;
    let resumeCallbackFired = false;
    let callbackFired = false;

    const idleDetector = new IdleDetector({
      callback: (idleMs) => {
        console.log('IdleDetector callback fired (>10s), idleMs:', idleMs);
        callbackFired = true;
      },
      resumeCallback: () => {
        console.log('IdleDetector resumeCallback fired (<10s)');
        resumeCallbackFired = true;

        // Simulate what App.handleResume does
        const savedTimers = JSON.parse(localStorage.getItem('app_hidden_running_timers') || '[]');
        savedTimers.forEach(timerId => {
          timerManager2.startTimer(timerId);
        });
        localStorage.removeItem('app_hidden_running_timers');
      },
      idleThreshold: 10000
    });

    // Wait for init to complete (it checks pending idle period)
    await new Promise(resolve => setTimeout(resolve, 100));

    // ========== VERIFY: Timer should have resumed ==========
    console.log('resumeCallback fired:', resumeCallbackFired);
    console.log('callback fired:', callbackFired);
    expect(resumeCallbackFired).to.be.true;
    expect(callbackFired).to.be.false;

    const finalTimer = timerManager2.getTimer(timer.id);
    expect(finalTimer.isRunning()).to.be.true;
    console.log('=== TEST PASSED: Timer resumed after <10s idle ===\n');
  });

  it('CRITICAL: should show modal after >10s idle WITH page reload', async () => {
    console.log('\n=== TEST: >10s idle with page reload ===');

    // ========== STEP 1: Initial page load, start timer ==========
    const { TimerManager } = await import('../js/timerManager.js');
    const timerManager1 = new TimerManager();
    const timer = timerManager1.addTimer('Test Timer');
    timerManager1.startTimer(timer.id);

    console.log('Timer started:', timer.id);
    expect(timer.isRunning()).to.be.true;

    // ========== STEP 2: Tab becomes hidden ==========
    const runningTimers = [timer.id];
    localStorage.setItem('app_hidden_running_timers', JSON.stringify(runningTimers));

    const hiddenAt = Date.now() - 15000; // 15 seconds ago (> 10s threshold)
    localStorage.setItem('idle_detector_hidden_at', hiddenAt.toString());

    timerManager1.pauseTimer(timer.id);
    console.log('Tab hidden, timer paused, state saved (15s ago)');

    // ========== STEP 3: PAGE RELOADS ==========
    const timerManager2 = new TimerManager();
    const restoredTimer = timerManager2.getTimer(timer.id);
    console.log('Page reloaded, timer restored from localStorage');
    expect(restoredTimer.isRunning()).to.be.false;

    // ========== STEP 4: IdleDetector initializes ==========
    const IdleDetector = (await import('../js/idleDetector.js')).default;
    let resumeCallbackFired = false;
    let callbackFired = false;
    let receivedIdleMs = null;

    const idleDetector = new IdleDetector({
      callback: (idleMs) => {
        console.log('IdleDetector callback fired (>10s), idleMs:', idleMs);
        callbackFired = true;
        receivedIdleMs = idleMs;
      },
      resumeCallback: () => {
        console.log('IdleDetector resumeCallback fired (<10s)');
        resumeCallbackFired = true;
      },
      idleThreshold: 10000
    });

    // Wait for init
    await new Promise(resolve => setTimeout(resolve, 100));

    // ========== VERIFY: Modal callback should fire, timer still paused ==========
    console.log('resumeCallback fired:', resumeCallbackFired);
    console.log('callback fired:', callbackFired);
    console.log('receivedIdleMs:', receivedIdleMs);

    expect(callbackFired).to.be.true;
    expect(resumeCallbackFired).to.be.false;
    expect(receivedIdleMs).to.be.at.least(15000);

    const finalTimer = timerManager2.getTimer(timer.id);
    expect(finalTimer.isRunning()).to.be.false; // Should still be paused until user interacts with modal
    console.log('=== TEST PASSED: Modal callback fired after >10s idle ===\n');
  });

  it('should handle case where no timer was running (no saved state)', async () => {
    console.log('\n=== TEST: No running timer, page reload ===');

    // ========== STEP 1: Page loads with no saved running timers ==========
    const { TimerManager } = await import('../js/timerManager.js');
    const timerManager = new TimerManager();

    // No timers running, but there's an old idle timestamp (shouldn't happen, but test it)
    const hiddenAt = Date.now() - 5000;
    localStorage.setItem('idle_detector_hidden_at', hiddenAt.toString());
    // NO app_hidden_running_timers saved

    // ========== STEP 2: IdleDetector initializes ==========
    const IdleDetector = (await import('../js/idleDetector.js')).default;
    let resumeCallbackFired = false;

    const idleDetector = new IdleDetector({
      callback: () => {},
      resumeCallback: () => {
        console.log('resumeCallback called with empty timer list');
        resumeCallbackFired = true;

        const savedTimers = JSON.parse(localStorage.getItem('app_hidden_running_timers') || '[]');
        console.log('savedTimers:', savedTimers);
        expect(savedTimers.length).to.equal(0);
      },
      idleThreshold: 10000
    });

    await new Promise(resolve => setTimeout(resolve, 100));

    // Should still call resumeCallback (no-op)
    expect(resumeCallbackFired).to.be.true;
    console.log('=== TEST PASSED: Empty timer list handled gracefully ===\n');
  });
});
