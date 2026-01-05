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
- Page visibility handling: pauses running timers when tab becomes hidden
- localStorage persistence: timer state persists across page reloads
- Dark theme UI with responsive design

## Project Structure

```
timers/
├── index.html                 # Main HTML entry point
├── css/styles.css            # Styling (dark theme)
├── js/
│   ├── app.js               # App: DOM rendering, event binding, RAF update loop
│   ├── timer.js             # Timer: individual timer state (private fields)
│   ├── timerManager.js      # TimerManager: orchestrates timers, enforces chess-clock
│   └── storageService.js    # StorageService: localStorage persistence + validation
├── tests/                    # Web Test Runner test suite (Mocha/Chai)
│   ├── timer.test.js
│   ├── timerManager.test.js
│   ├── storageService.test.js
│   ├── integration.test.js   # Currently a placeholder
│   ├── layout.test.js
│   ├── closeButton.test.js
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

**StorageService (storageService.js)**
- localStorage wrapper with schema validation
- Validates state structure and timer constraints before load/save
- Handles version checking and corrupted data cleanup
- Gracefully handles localStorage unavailability

**App (app.js)**
- DOM initialization and event binding
- Renders timer cards dynamically
- Uses `requestAnimationFrame` for efficient display updates
- Tracks running timers that should resume when page visibility changes
- Only updates DOM when display values actually change (optimization)

### Key Behaviors

**Chess-Clock Mechanism:**
When a user starts timer B while timer A is running:
1. App calls `timerManager.startTimer(timerB.id)`
2. TimerManager automatically pauses timer A
3. Timer B begins running
4. Only one timer's time advances at a time

**Page Visibility Handling:**
- When document becomes hidden: running timers are paused, IDs stored in `hiddenRunningTimers`
- When document becomes visible again: timers in `hiddenRunningTimers` are resumed
- Prevents time accumulation when tab is in background

**Persistence:**
- Every state change (start, pause, add, remove, title update) triggers `#persist()`
- Individual timer operations: `resetTimer(id)`, `updateTimerTitle(id, newTitle)` - all trigger persistence
- On page load, TimerManager attempts to restore timers from localStorage
- Running timers are converted to paused on restore (can't restore `performance.now()` baseline)
- **Note**: `App.handleResetAll()` currently calls `timer.reset()` directly on each timer instead of delegating to `TimerManager.resetAll()`. This works but violates separation of concerns; should be refactored for consistency.

## Commands

```bash
npm test                # Run tests once
npm test:watch        # Run tests with file watching
npm test:debug        # Run tests in manual/debug mode
npm run lint          # (Note: not configured; would need eslint/setup)
```

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
