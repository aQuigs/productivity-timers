# Quickstart Guide: Multi-Timer Time Tracker

**Feature**: 001-time-tracker
**Date**: 2026-01-02
**Status**: Ready for Implementation

## Overview

This quickstart guide provides developers with everything needed to understand, set up, and work on the multi-timer time tracking web application. This is a static HTML/CSS/JavaScript application designed for deployment to GitHub Pages.

## Table of Contents

1. [Project Summary](#project-summary)
2. [Prerequisites](#prerequisites)
3. [Local Development Setup](#local-development-setup)
4. [Architecture Overview](#architecture-overview)
5. [Running Tests](#running-tests)
6. [Development Workflow](#development-workflow)
7. [Deployment](#deployment)
8. [Key Files and Directories](#key-files-and-directories)

---

## Project Summary

**What it does**: Browser-based time tracker with multiple timers that function like a chess clock - only one timer runs at a time, and starting another automatically pauses all others.

**Key features**:
- ⏱️ Multiple timers (default 2, expandable to 20)
- ♟️ Chess-clock behavior (mutual exclusivity)
- ✏️ Editable timer titles
- ↻ Global reset functionality
- ➕/➖ Dynamic add/remove timers
- 🌐 Static deployment to GitHub Pages

**Tech stack**:
- Frontend: Vanilla HTML5, CSS3, JavaScript (ES6+)
- Testing: Web Test Runner with Chromium browser
- CI/CD: GitHub Actions
- Hosting: GitHub Pages

**No frameworks**: React, Vue, Angular - intentionally avoiding build complexity for this simple application.

**No backend**: Fully client-side, no server required, no persistence (future enhancement).

---

## Prerequisites

### Required

- **Node.js**: v18 or later (for running tests)
- **npm**: v9 or later (comes with Node.js)
- **Modern browser**: Chrome, Firefox, Safari, or Edge (released within last 2 years)
- **Git**: For version control

### Optional

- **VS Code**: Recommended editor with extensions:
  - Live Server (for local preview)
  - ESLint (for code quality)
  - Prettier (for code formatting)

### Installation Check

```bash
# Verify Node.js and npm are installed
node --version  # Should be v18+
npm --version   # Should be v9+

# Clone the repository
git clone https://github.com/aQuigs/timers.git
cd timers
```

---

## Local Development Setup

### Step 1: Install Dependencies

```bash
# Install testing framework and browser automation
npm install
```

This installs:
- `@web/test-runner` - Test framework for vanilla JavaScript
- `@web/test-runner-puppeteer` - Browser automation for tests
- Optional: `chai` - Assertion library for better test error messages

### Step 2: Open the Application

#### Option A: Using Live Server (VS Code)

1. Install "Live Server" extension in VS Code
2. Right-click `index.html`
3. Select "Open with Live Server"
4. App opens at `http://127.0.0.1:5500`

#### Option B: Using Python's Built-in Server

```bash
# Python 3
python3 -m http.server 8000

# Open browser to http://localhost:8000
```

#### Option C: Direct File Access

Simply double-click `index.html` to open in browser (works but no hot reload).

### Step 3: Verify It Works

You should see:
- Two default timers labeled "Timer 1" and "Timer 2"
- Each timer showing "00:00:00"
- Start/Pause button on each timer
- "Add Timer" button
- "Reset All" button

Click "Start" on Timer 1, verify it counts up. Click "Start" on Timer 2, verify Timer 1 pauses.

---

## Architecture Overview

### Directory Structure

```text
/
├── index.html              # Main entry point
├── css/
│   └── styles.css          # Application styles
├── js/
│   ├── timer.js            # Timer class (model)
│   ├── timerManager.js     # TimerManager class (orchestration)
│   └── app.js              # DOM manipulation and event handling (view/controller)
├── tests/
│   ├── timer.test.js       # Unit tests for Timer class
│   ├── timerManager.test.js # Unit tests for TimerManager class
│   └── integration.test.js # Integration tests for UI interactions
├── specs/
│   └── 001-time-tracker/   # Design documentation
├── package.json            # npm dependencies and scripts
└── web-test-runner.config.js # Test configuration
```

### Component Responsibilities

**Timer class** (`js/timer.js`):
- Manages individual timer state (stopped/running/paused)
- Calculates elapsed time using `performance.now()`
- Provides formatted time display (HH:MM:SS)
- No DOM manipulation

**TimerManager class** (`js/timerManager.js`):
- Orchestrates multiple Timer instances
- Enforces mutual exclusivity (only one running timer)
- Handles add/remove timer operations
- Maintains global state
- No DOM manipulation

**App module** (`js/app.js`):
- Initializes TimerManager on page load
- Binds DOM events to TimerManager methods
- Updates UI based on timer state
- Renders timer cards dynamically
- Uses `requestAnimationFrame` for smooth updates

**Styles** (`css/styles.css`):
- Flexbox layout for responsive timer cards
- Clean, minimal design
- Active timer highlighting
- Mobile-friendly responsive design

### Data Flow

```text
User Action (click)
  ↓
DOM Event (app.js)
  ↓
TimerManager Method (timerManager.startTimer)
  ↓
Timer Method (timer.start)
  ↓
State Update (timer.state = "running")
  ↓
UI Refresh (app.js updates DOM)
  ↓
Display Updated (user sees change)
```

### Timer Accuracy Implementation

Uses `performance.now()` for high-resolution timing:

```javascript
// When timer starts
startTimeMs = performance.now(); // e.g., 123456.789

// To calculate elapsed time
currentElapsed = performance.now() - startTimeMs; // e.g., 5432.123 (5.4 seconds)
```

**Why `performance.now()` instead of `Date.now()`**:
- Microsecond precision vs. millisecond precision
- Monotonically increasing (not affected by system clock changes)
- Continues accurately even when browser tab is throttled

---

## Running Tests

### Run All Tests

```bash
npm test
```

This runs Web Test Runner with Chromium browser in headless mode.

### Run Tests in Watch Mode

```bash
npm run test:watch
```

Tests re-run automatically when you save changes to source or test files.

### Run Tests in Interactive Mode

```bash
npm run test:debug
```

Opens browser with debugger attached, allowing you to set breakpoints in tests.

### Test Categories

**Unit Tests** (`tests/timer.test.js`, `tests/timerManager.test.js`):
- Test Timer and TimerManager classes in isolation
- No DOM manipulation
- Fast execution (~100ms total)

**Integration Tests** (`tests/integration.test.js`):
- Test UI interactions with real DOM
- Verify timer display updates
- Test mutual exclusivity behavior
- Slower execution (~1-2 seconds total)

### Expected Output

```text
✔ Timer starts from 00:00:00
✔ Timer pauses and preserves elapsed time
✔ Timer formats time as HH:MM:SS
✔ TimerManager enforces mutual exclusivity
✔ Starting Timer B pauses Timer A
✔ Reset all timers to 00:00:00
✔ Cannot remove last timer
✔ Maximum 20 timers allowed

Passed: 23 tests (542ms)
```

---

## Development Workflow

### 1. Create Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Changes

Edit files in `js/`, `css/`, or `index.html` as needed.

### 3. Test Locally

```bash
# Run tests
npm test

# View in browser
# (Use Live Server or python -m http.server)
```

### 4. Commit and Push

```bash
git add .
git commit -m "feat: add your feature description"
git push origin feature/your-feature-name
```

### 5. Create Pull Request

1. Go to GitHub repository
2. Click "New Pull Request"
3. Select your feature branch
4. Wait for CI tests to pass
5. Request review

### 6. Merge to Main

Once PR is approved and tests pass:
1. Merge to `main` branch
2. GitHub Actions automatically deploys to GitHub Pages
3. Live site updates within 1-2 minutes

---

## Deployment

### Automatic Deployment (Recommended)

**Trigger**: Every push to `main` branch

**Process**:
1. GitHub Actions runs tests
2. If tests pass, deploys to GitHub Pages
3. Site available at `https://aQuigs.github.io/timers`

**Configuration** (`.github/workflows/deploy.yml`):
```yaml
name: Test and Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    # Runs npm test
  deploy:
    needs: test
    # Deploys to GitHub Pages
```

### Manual Deployment

If needed, you can manually enable GitHub Pages:

1. Go to repository Settings
2. Navigate to "Pages" section
3. Source: "Deploy from a branch"
4. Branch: `main` / `root`
5. Save

Site deploys within 1-2 minutes.

### Deployment Verification

After deployment, verify:
- Site loads at GitHub Pages URL
- All timers function correctly
- No console errors (open DevTools)
- Responsive design works on mobile

---

## Key Files and Directories

### Source Code

| File/Directory | Purpose |
|----------------|---------|
| `index.html` | Main HTML structure, loads CSS/JS modules |
| `css/styles.css` | Application styling (layout, colors, responsive design) |
| `js/timer.js` | Timer class implementation |
| `js/timerManager.js` | TimerManager class implementation |
| `js/app.js` | DOM initialization and event handling |

### Tests

| File | Purpose |
|------|---------|
| `tests/timer.test.js` | Unit tests for Timer class |
| `tests/timerManager.test.js` | Unit tests for TimerManager class |
| `tests/integration.test.js` | Integration tests for UI interactions |
| `web-test-runner.config.js` | Test runner configuration |

### Configuration

| File | Purpose |
|------|---------|
| `package.json` | npm dependencies and scripts |
| `.github/workflows/deploy.yml` | GitHub Actions CI/CD pipeline |
| `.gitignore` | Files to exclude from version control |

### Documentation

| File/Directory | Purpose |
|----------------|---------|
| `specs/001-time-tracker/spec.md` | Feature specification |
| `specs/001-time-tracker/plan.md` | Implementation plan (this workflow) |
| `specs/001-time-tracker/research.md` | Technical research findings |
| `specs/001-time-tracker/data-model.md` | Data structures and state management |
| `specs/001-time-tracker/contracts/timer-api.md` | JavaScript API contract |
| `specs/001-time-tracker/quickstart.md` | This file |

---

## Common Development Tasks

### Add a New Feature

1. Review spec and plan documents in `specs/001-time-tracker/`
2. Write tests first (TDD approach recommended)
3. Implement feature in appropriate module (timer.js, timerManager.js, or app.js)
4. Verify tests pass
5. Test manually in browser
6. Commit and push

### Debug Timer Accuracy Issues

```javascript
// Add logging to timer.js
start() {
  this.startTimeMs = performance.now();
  console.log('[Timer] Started at:', this.startTimeMs);
}

getElapsedMs() {
  const now = performance.now();
  const elapsed = this.state === 'running'
    ? this.elapsedMs + (now - this.startTimeMs)
    : this.elapsedMs;
  console.log('[Timer] Elapsed:', elapsed, 'ms');
  return elapsed;
}
```

### Optimize Performance

**Check render performance**:
1. Open DevTools → Performance tab
2. Start recording
3. Interact with timers (start/pause/switch)
4. Stop recording
5. Look for long tasks (should be <100ms)

**Check timer accuracy**:
```javascript
// In browser console
const timer = new Timer("Test");
timer.start();
// Wait exactly 10 seconds using phone stopwatch
timer.pause();
console.log(timer.getFormattedTime()); // Should show ~00:00:10
```

### Update Styles

Edit `css/styles.css`. Changes apply immediately with Live Server hot reload.

**Key CSS classes**:
- `.timer-container` - Flexbox container for timer cards
- `.timer-card` - Individual timer layout
- `.timer-card.active` - Styling for running timer
- `.timer-display` - HH:MM:SS time display
- `.timer-controls` - Button layout

---

## Troubleshooting

### Tests Fail: "Cannot find module"

**Problem**: Missing npm dependencies

**Solution**:
```bash
npm install
```

### Timer Display Doesn't Update

**Problem**: JavaScript not loaded or errors in console

**Solution**:
1. Open DevTools Console (F12)
2. Look for JavaScript errors
3. Verify `js/` files are loaded in Network tab
4. Check browser supports ES6 modules

### GitHub Pages Shows 404

**Problem**: GitHub Pages not configured or deployment failed

**Solution**:
1. Go to repository Settings → Pages
2. Verify source is set to `main` branch
3. Check GitHub Actions tab for deployment status
4. Wait 1-2 minutes for deployment to complete

### Timer Loses Accuracy Over Time

**Problem**: Using `setInterval` count instead of `performance.now()` difference

**Solution**: Verify Timer class uses:
```javascript
// CORRECT
getElapsedMs() {
  return this.elapsedMs + (performance.now() - this.startTimeMs);
}

// INCORRECT (don't do this)
getElapsedMs() {
  return this.intervalCount * 1000; // Loses accuracy
}
```

---

## Next Steps

1. **Implement Core Features**: Start with Timer class, then TimerManager, then UI (app.js)
2. **Write Tests**: Follow TDD approach - write tests first, then implementation
3. **Set Up CI/CD**: Configure GitHub Actions for automated testing and deployment
4. **Deploy**: Push to `main` and verify deployment to GitHub Pages

For detailed implementation guidance, see:
- **Spec**: `specs/001-time-tracker/spec.md` - Functional requirements and user stories
- **Plan**: `specs/001-time-tracker/plan.md` - Technical approach and architecture
- **Data Model**: `specs/001-time-tracker/data-model.md` - State management details
- **API Contract**: `specs/001-time-tracker/contracts/timer-api.md` - JavaScript module interfaces

---

## Support

- **Issues**: Report bugs on GitHub Issues tab
- **Questions**: Open a GitHub Discussion
- **Documentation**: All design docs in `specs/001-time-tracker/`

---

**Ready to start coding? Begin with the Timer class unit tests in `tests/timer.test.js`!**
