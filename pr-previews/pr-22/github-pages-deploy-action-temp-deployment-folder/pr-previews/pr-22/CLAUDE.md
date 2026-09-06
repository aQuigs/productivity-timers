# timers Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-01-02

## Active Technologies

- HTML5, CSS3, JavaScript (ES6+, vanilla - no framework) + None (framework-free static web app) (001-time-tracker)

## Project Overview

**Productivity Timers** is a multi-timer web application with chess-clock behavior. Only one timer can run at a time. When you start a timer, any currently running timer automatically pauses. The app features a dark theme redesign and persists timer state to localStorage.

**Key Features:**
- Multiple concurrent timers (1-20) with independent time tracking
- Chess-clock mutual exclusivity: only one timer runs at a time
- Editable timer titles
- Drag a card's grip handle to reorder timers (arrow keys on the handle as the keyboard/touch fallback); the order is persisted
- Optional per-timer goal or budget (e.g. `25m`, `1h30m`, `1:30`): a goal is a minimum to reach (`over-target`, green, "Goal reached" notification), a budget a maximum not to exceed (`over-budget`, red, "Budget exceeded" notification); both show a progress bar on the card and, once passed, the chip counts the time over the target (`Goal HH:MM:SS · HH:MM:SS over`); a budget bar warms from the accent toward red through the second half of the budget
- Page visibility / window focus handling: pauses running timers when the tab becomes hidden or the window loses focus
- localStorage persistence: timer state persists across page reloads
- Dark UI by default with a light palette via `prefers-color-scheme`; responsive down to phone widths
- Header shows the running total across all timers

## Project Structure

```
timers/
├── index.html                 # Main HTML entry point (top bar, timer grid; loads js/main.js)
├── css/styles.css            # Styling: design tokens, dark + light (prefers-color-scheme)
├── js/
│   ├── main.js              # Bootstrap: creates App on DOMContentLoaded (keeps app.js importable in tests)
│   ├── app.js               # App: DOM rendering, event binding, RAF update loop, idle flow
│   ├── timer.js             # Timer: individual timer state (private fields)
│   ├── timerManager.js      # TimerManager: orchestrates timers, enforces chess-clock
│   ├── storageService.js    # StorageService: localStorage persistence + validation
│   ├── storageNamespace.js  # namespacedKey(): per-PR localStorage key prefix so previews never share production state
│   ├── idleDetector.js      # IdleDetector: heartbeat-based away-time tracking
│   ├── allocationModal.js   # AllocationModal: "where should idle time go" dialog
│   ├── timeDistributor.js   # Pure allocation strategies (single/fixed/percentage)
│   ├── parseDuration.js     # Pure goal-input parser: "25m", "1h 30m", "1:30", bare minutes -> ms or null
│   ├── notifier.js          # createNotifier(): Notification API wrapper App takes as an injectable
│   └── formatDuration.js    # Shared HH:MM:SS formatter used by Timer, modal, header
├── tests/                    # Web Test Runner test suite (Mocha/Chai)
│   ├── helpers.js            # Shared test helpers (visibility simulation)
│   ├── app.test.js           # App flows: startup, visibility, persistence, rendering
│   ├── timer.test.js
│   ├── timerManager.test.js
│   ├── storageService.test.js
│   ├── storageNamespace.test.js
│   ├── idleDetector.test.js
│   ├── allocationModal.test.js
│   ├── timeDistributor.test.js
│   ├── parseDuration.test.js
│   ├── notifier.test.js
│   ├── formatDuration.test.js
│   ├── integration.test.js
│   ├── layout.test.js        # CSS contracts: grid widths, tabular digits, top bar overflow
│   ├── closeButton.test.js   # Remove button must stay 36px square with red tint
│   └── closeButtonReal.test.js
├── web-test-runner.config.js # Test runner configuration
└── package.json              # Dependencies: @web/test-runner, Playwright
```

## Architecture & Design Patterns

### Module Organization

**Timer (timer.js)**
- Manages individual timer state with private fields (#)
- State machine: 'stopped' → 'running' → 'paused' (or reset)
- Uses `performance.now()` for high-resolution, monotonic timing
- Serializable via `toJSON()` / `fromJSON()` for storage
- Title validation: must be non-empty string, max 50 characters
- `Timer.VALID_STATES`: public static API containing `['stopped', 'paused', 'running']`

**TimerManager (timerManager.js)**
- Orchestrates multiple Timer instances
- Enforces chess-clock constraint: `#runningTimerId` tracks only one active timer
- When `startTimer(id)` is called, pauses any currently running timer automatically
- Delegates to StorageService for persistence
- Limits total timers to 1-20
- `moveTimer(id, toIndex)` / `reorderTimers(orderedIds)` change the array order (which is the saved order) without touching the running timer; bad input is rejected like elsewhere (unknown id → `false`, bad index or non-permutation → throws) and an unchanged order does not persist

**StorageService (storageService.js)**
- localStorage wrapper with schema validation
- Validates state structure and timer constraints before load/save
- Handles version checking and corrupted data cleanup
- Gracefully handles localStorage unavailability
- Default key is `namespacedKey('productivity-timers-v1')`: unchanged on production and local dev, prefixed with `pr-<n>:` on a PR preview

**App (app.js)**
- DOM initialization and event binding; exported as a class, bootstrapped by `main.js`
- Renders timer cards dynamically
- Uses `requestAnimationFrame` for efficient display updates
- Tracks running timers that should resume when page visibility changes
- The RAF loop only touches the DOM when a timer's formatted time or state changes (`lastDisplayedValues` / `lastDisplayedStates`); `applyTimerState()` is the single place that syncs button, `.active` class and status label
- Persists a running timer's elapsed time once per second (on display tick) so a crash loses at most a second
- Reordering uses native HTML5 drag and drop: only the `.timer-drag-handle` makes a card `draggable`, `dragover` on the container moves the dragged card before/after the card under the pointer, and `drop`/`dragend` commit the container's child order via `reorderTimers()`; cards are moved, never rebuilt, so `timerElements` stays valid. Arrow keys on the handle call `moveTimer()` one step at a time
- `destroy()` tears down the RAF loop and the IdleDetector (used by tests)

**IdleDetector (idleDetector.js)**
- The page is "active" while it is visible AND its window has focus (`isActive()` = `!document.hidden && document.hasFocus()`); switching to another app or clicking into browser UI counts as inactive even though the tab stays visible
- Listens to `visibilitychange` plus window `blur`/`focus`, all through one handler that recomputes `isActive()` and only acts when it changes, so a tab switch (which fires both blur and hidden) transitions once
- Stamps `last_heartbeat` in localStorage every second while active
- On going inactive: stamps once, stops the heartbeat (so the next check measures the whole inactive period), and calls `onInactive`
- On becoming active/on load: folds the gap since the last stamp into `accumulated_idle_ms`; on return calls `onActive(total)`; invokes `callback(total)` when the total exceeds the threshold (`DEFAULT_IDLE_THRESHOLD_MS`, 10 s)
- `checkIdle()` returns the accumulated total and is safe to call repeatedly

**AllocationModal (allocationModal.js)** / **TimeDistributor (timeDistributor.js)**
- Modal resolves `{ strategy, config, idleMs }`; `idleMs` is the total it last displayed (it polls `accumulated_idle_ms` while open)
- For `selected-timer`, `config.makeRunning` mirrors the "Make this the running timer" checkbox; App then resumes that timer instead of the previous one
- Default selection is `previous-timer` when a timer was running before the tab went idle, otherwise `discard` (the `previous-timer` option is disabled in that case)
- Distributor functions add the remainder to a timer that already has a share; with no remainder timer, rounding dust goes to the largest share
- Either partial split can throw the leftover away, but never by accident — each needs an explicit act. The fixed form's "Remainder goes to" select ends with a "Discard the rest" option (the first timer stays the default). The percentage form accepts any total from just above 0 up to 100, and a short one raises a `.percentage-discard-label` checkbox ("Discard the remaining 20%") that gates Apply: unticked the total reads `Total: 80% · 20% unallocated` and is invalid, ticked it reads `· 20% discarded` and applies. The tick is cleared whenever the leftover disappears, so a later short split has to be confirmed again
- Both pass `remainderTimerId: DISCARD_REMAINDER` (`timeDistributor.js`), which makes `assignRemainder()` drop the leftover instead of routing it to a timer; a percentage split that totals exactly 100 sends no remainder id, so rounding dust still lands on the largest share

### Key Behaviors

**Chess-Clock Mechanism:**
When a user starts timer B while timer A is running:
1. App calls `timerManager.startTimer(timerB.id)`
2. TimerManager automatically pauses timer A
3. Timer B begins running
4. Only one timer's time advances at a time

**Page Visibility / Window Focus Handling:**
- IdleDetector owns the `visibilitychange` and window `blur`/`focus` listeners and calls App's `onInactive` / `onActive(total)` hooks; App registers no listener of its own. Hidden tab and unfocused window are the same idle flow with the same 10 s threshold
- On inactive (`App.handleInactive()`): running timers are paused and their IDs stored in `hiddenRunningTimers`, mirrored to localStorage because browsers fire `visibilitychange` → hidden on unload. While a modal is open the set is only replaced if something was actually running, so it keeps naming the timer to resume
- On active and on load (`App.handleIdleReturn(total)`): within the threshold, `hiddenRunningTimers` are resumed; otherwise the allocation modal opens and the previous timer resumes after it closes (or the chosen timer, when the user ticked "Make this the running timer"). Guarded by `allocationInProgress` so there is one modal at a time (the open modal picks up further idle time itself)
- After the modal applies, every card that received time (`> 0` ms) plays a 1.4 s sequence unless `App.reducedMotion` (read once from `prefers-reduced-motion`) is set: `App.#animateTimeAdded()` adds the `time-added` class and records a roll in `timeAddedRolls`. In CSS the card gets `isolation: isolate` so `::before` can sit at `z-index: -1` between the card background and its content and play `time-added-fill` (an accent fill rising from the bottom, then fading), the display plays `time-added-glow` and `::after` plays `time-added-ring` (delayed so it pulses as the roll settles; it must finish last). In JS the RAF loop shows `elapsed - #unrolledMs()` for 0.88 s (`TIME_ADDED_ROLL_MS`, ease-out cubic) so the digits, the header total and the goal bar/chip roll up from the old time to the new one; the goal notification still fires on the real crossing, a running timer's once-per-second persist is skipped while rolling, and a second allocation mid-roll carries the unshown remainder into the new roll. The card's `animationend` handler removes the class once no `time-added-*` animation is still playing (the running-state `pulse` is ignored); re-adding the class forces a reflow so it replays
- If the app loads in a hidden tab or an unfocused window (`idleDetector.isActive()` false), `init()` calls `handleInactive()` instead

**Goals and budgets:**
- A timer has at most one target: `Timer.targetMs` (`null` = none) plus `Timer.targetKind`, `'goal'` (a minimum to reach) or `'budget'` (a maximum not to exceed), `null` without a target. `Timer.TARGET_KINDS` lists the two. Set through `TimerManager.setTimerTarget(id, ms, kind = 'goal')`, persisted with the timer (a target saved before kinds existed loads as a goal; absent target loads as `null`) and survives `reset()`
- The card's `.timer-goal-btn` ("Set goal or budget", or the `Goal HH:MM:SS` / `Budget HH:MM:SS` chip) swaps for `.timer-goal-editor`: a `.timer-goal-kind` radiogroup (Goal / Budget, one radio `name` per card, preselecting the current kind) beside `.timer-goal-input`. Enter applies, Escape cancels, empty clears, unparseable text keeps the editor open with the input flagged `is-invalid`/`aria-invalid` and a `.timer-goal-error` alert (cleared on input, Escape or a valid commit)
- Leaving the editor applies too, via `focusout` on the wrapper: focus moving between its own controls (`relatedTarget` inside) is ignored; a bare blur is treated as leaving unless the pointer last went down inside the editor (`App.pointerDownEditor`, tracked by a document-level `pointerdown` listener), which is what a tap on the kind toggle looks like on touch screens. Mouse clicks on the toggle `preventDefault` on `mousedown` so focus never leaves the input, and any `click` on the toggle refocuses the input (a tap still moves focus on touch screens); arrow-key changes fire no click, so keyboard users stay on the radio
- `applyGoalState()` alone syncs the chip words (`· HH:MM:SS over` once passed, "Edit goal" / "Edit budget" titles, progressbar `aria-label` and, while over, `aria-valuetext` "HH:MM:SS over goal/budget"), `.timer-progress-bar` width and its `--budget-heat` custom property (budgets only: 0% up to half the budget, 100% at the budget; the CSS mixes accent toward `--danger` by that amount, goal bars have no property and stay accent) and the card's `over-target` (goal, green) or `over-budget` (budget, red) class. The RAF loop calls it only when the kind, whole-number percentage, reached flag or whole-second overage changes, so a card past its target redraws once a second. The words per kind live in the `TARGET_KINDS` table at the top of `app.js`
- `goalReachedTimers` mirrors "currently at/over target" for both kinds: a crossing seen on the display tick calls `notifier.notify()` once ("Goal reached" / "Budget exceeded"), and dropping below (reset, raised target) re-arms it; cards rendered already over target and targets set below the elapsed time are adopted silently. `notifier.requestPermission()` runs only when the user sets a target

**Persistence:**
- Every state change (start, pause, add, remove, title update, goal/budget update, reset) triggers `TimerManager.persist()`
- Individual timer operations: `resetTimer(id)`, `updateTimerTitle(id, newTitle)` - all trigger persistence
- On page load, TimerManager attempts to restore timers from localStorage
- The previously running timer is auto-started on restore (from its saved elapsed time); the gap since the last save is handled by the IdleDetector
- `App.handleResetAll()` delegates to `TimerManager.resetAll()` so the reset is persisted like every other state change
- **PR preview isolation**: previews deploy to `/pr-previews/pr-<n>/` on the same origin as production, so every localStorage key (timer state, `last_heartbeat`, `accumulated_idle_ms`, `app_hidden_running_timers`) goes through `storageNamespace.js`, which prefixes it with `pr-<n>:` there and leaves it untouched elsewhere. Each preview gets its own bucket and production keeps its historical keys. IdleDetector and App resolve their keys once at construction; tests simulate a preview with `atPreviewPath()` from `tests/helpers.js`

## Commands

```bash
npm test                # Run tests once
npm test:watch        # Run tests with file watching
npm test:debug        # Run tests in manual/debug mode
npm run lint          # (Note: not configured; would need eslint/setup)
```

## Pull Requests and Merging

- **Never merge a PR while any CI check is failing**, including checks that GitHub does not mark as required (such as `deploy-preview`). A red check blocks the merge.
- If a failure looks flaky (for example `deploy-preview` failing with `rsync ... exit code 24`, caused by a stale nested temp folder on the `gh-pages` branch), re-run the failed job with `gh run rerun <run-id> --failed` and wait for it to pass before merging. If it keeps failing, fix the cause first.

## Code Style

**HTML5, CSS3, JavaScript (ES6+, vanilla - no framework):**
- Follow standard ES6+ conventions
- Use private fields (#) for encapsulation where appropriate
- Avoid self-describing comments; only explain *why*, not *what*
- Use semantic HTML5 elements
- CSS uses Flexbox layout, CSS custom properties for theming

## Testing Requirements

**Test-Driven Development (TDD) is REQUIRED for all tests:**

1. **Red-Green-Refactor Cycle**: Always follow strict TDD workflow
   - Write a failing test first (Red)
   - Write minimal code to make it pass (Green)
   - Refactor for clarity and efficiency (Refactor)

2. **No Code Without Tests**: All new functionality must have tests written BEFORE implementation

3. **Test First Philosophy**:
   - Define expected behavior in tests before writing implementation
   - Tests serve as executable specifications
   - Implementation should only do what tests require

**Test Coverage Requirements:**
- Minimum 80% coverage (statements, branches, functions, lines)
- Integration tests required for: inter-module contracts, storage persistence, DOM interactions
- Unit tests for: Timer state machine, TimerManager chess-clock logic, StorageService validation

## Testing Infrastructure

- **Framework**: Mocha (ui: 'bdd') + Chai assertions
- **Runner**: @web/test-runner with Playwright (Chromium)
- **Environment**: Real browser (not jsdom), so DOM APIs are available
- **Coverage Threshold**: 80% for all metrics

## Important Implementation Notes

1. **Timer.getElapsedMs()** returns different values depending on state:
   - Running: accumulated + (now - startTimeMs)
   - Paused/Stopped: just accumulated

2. **Storage serialization** normalizes running timers to paused (see Timer.toJSON and fromJSON)

3. **CSS classes** updated in real-time:
   - `.active` added to timer card when running
   - `.btn-start` / `.btn-pause` toggled on button

4. **RAF optimization**: App only updates DOM if display value changed, reducing reflows

5. **Chess-clock contract**: TimerManager.startTimer() always auto-pauses other timers before starting the requested one

## Recent Changes

- 001-time-tracker: Added HTML5, CSS3, JavaScript (ES6+, vanilla - no framework) + None (framework-free static web app)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
