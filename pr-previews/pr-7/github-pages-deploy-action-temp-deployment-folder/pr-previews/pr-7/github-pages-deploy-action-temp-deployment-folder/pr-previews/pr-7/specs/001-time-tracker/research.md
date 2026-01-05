# Research: Multi-Timer Time Tracker

**Feature**: 001-time-tracker
**Date**: 2026-01-02
**Status**: Completed

## Overview

This document captures research findings and technical decisions made during Phase 0 planning for the multi-timer time tracking web application. All "NEEDS CLARIFICATION" items from the Technical Context have been resolved.

## 1. Testing Framework Selection

### Decision
**Web Test Runner (@web/test-runner)** as primary testing framework, with option to add **Playwright** for end-to-end scenarios if needed.

### Rationale
Web Test Runner is optimal for this vanilla JavaScript timer application because:

- **No build step required**: Designed specifically for buildless development - serves code untransformed to the browser, perfectly matching the constraint of "no build step, no frameworks"
- **Real browser testing**: Runs tests in actual browsers (Chromium, Firefox, WebKit) using Puppeteer or Playwright, providing confidence in cross-browser compatibility without mocking DOM APIs
- **Native ES modules support**: Works out-of-the-box with ES6 modules, aligning with modern vanilla JavaScript practices
- **Developer experience**: Features watch mode, parallel test execution, interactive debugging, and detailed error reporting from real browser consoles
- **Minimal setup**: Requires only npm installation with no complex configuration, transpilation, or bundling

### Alternatives Considered

**Jest** (rejected):
- Requires complex configuration for ES modules and DOM testing
- Uses jsdom which doesn't perfectly replicate browser behavior
- Designed for Node.js environment, not ideal for pure browser code
- Heavier setup with more dependencies than needed for a simple project

**Vitest** (rejected for primary testing):
- Optimized for projects using Vite build tool - overkill for buildless vanilla JS
- Uses happy-dom or jsdom for DOM simulation rather than real browsers
- While Vitest 4 has stable browser mode, Web Test Runner is purpose-built for buildless vanilla JS

**Manual browser testing** (rejected as sole approach):
- Not reproducible or automatable for CI/CD
- Time-consuming and error-prone for regression testing
- Cannot provide test coverage metrics
- Useful as supplement but insufficient as primary strategy

**Playwright alone** (considered as complement):
- Excellent for end-to-end testing and user interaction flows
- Can be used alongside Web Test Runner for comprehensive coverage
- Better suited for integration tests than unit tests of timer logic

## 2. DOM Manipulation Testing Best Practices

### Decision
**Separation of concerns with unit + integration testing strategy**

### Rationale

The recommended testing approach follows a layered architecture:

**Architecture Pattern**:
- **Model layer** (timer.js): Pure JavaScript timer logic with no DOM dependencies - easily unit testable
- **Manager layer** (timerManager.js): Orchestrates multiple timers and mutual exclusivity - testable with minimal DOM
- **View layer** (app.js): DOM manipulation and event binding - requires browser environment testing

**Testing Strategy by Layer**:

1. **Timer Logic Testing** (unit tests):
   - Test elapsed time calculations using `performance.now()` for accuracy
   - Verify state transitions (stopped → running → paused)
   - Test edge cases (timer running 24+ hours, rapid state changes)
   - These tests run fast with minimal browser simulation

2. **DOM Manipulation Testing** (integration tests):
   - Use Web Test Runner with real browser instances
   - Test timer display updates (HH:MM:SS format rendering)
   - Verify mutual exclusivity behavior (starting one timer pauses others)
   - Test user interactions (clicking start/pause, editing titles, add/remove timers)
   - Validate UI responsiveness (<100ms response requirement)

3. **Key Best Practices Applied**:
   - **Cache DOM references**: Store element references in variables to minimize DOM access
   - **Batch DOM updates**: Use DocumentFragment when adding multiple timers
   - **Efficient selectors**: Use `.querySelector()` with specific IDs rather than complex selectors
   - **Test timing accuracy**: Use `performance.now()` for high-resolution timer testing (not affected by browser throttling)
   - **Avoid layout thrashing**: Batch reads and writes separately in tests

### Alternatives Considered

**jsdom/happy-dom simulation** (rejected):
- jsdom is more complete but slower; happy-dom is faster but less complete
- Both simulate browser APIs rather than using real browsers
- Can miss browser-specific timing issues critical for timer accuracy
- Web Test Runner's real browser approach provides higher confidence

**Monolithic testing** (rejected):
- Testing everything through the UI layer is slower and harder to debug
- Makes it difficult to isolate timer logic bugs from rendering bugs
- Separation of concerns enables faster test execution and clearer failure diagnosis

## 3. GitHub Actions Integration

### Decision
**GitHub Actions workflow with Web Test Runner + headless Chromium browser**

### Rationale

The recommended CI/CD approach provides automated testing before GitHub Pages deployment:

**Workflow Strategy**:

1. **Test Execution**:
   - Use Web Test Runner with headless Chromium browser in CI (fastest)
   - Optional: Add Firefox/WebKit for cross-browser testing on PRs to main
   - Run tests on every push and pull request before deployment

2. **Deployment Pipeline**:
   - **Stage 1**: Lint and validate HTML/CSS/JS (optional, can use pre-commit hooks)
   - **Stage 2**: Run unit tests (timer logic)
   - **Stage 3**: Run integration tests (DOM manipulation, user flows)
   - **Stage 4**: Deploy to GitHub Pages only if all tests pass

3. **GitHub Actions Configuration**:
   - Install browsers with `npx playwright install --with-deps chromium`
   - Run tests with `npx web-test-runner --node-resolve --puppeteer --browsers chromium`
   - Cache npm dependencies and browser binaries for faster builds (5-10x speedup)
   - Generate test reports and upload as artifacts for debugging failures

**Best Practices Applied**:
- **Fail fast**: Tests run before deployment attempt
- **Branch protection**: Require passing tests for PR merge to main
- **Artifact storage**: Save test reports and screenshots for debugging failures
- **Caching**: Cache node_modules and browser binaries
- **Parallel execution**: Run independent tests concurrently
- **Rollback capability**: GitHub Pages deployment history enables quick rollback

### Alternatives Considered

**BrowserStack/Cloud Testing** (rejected for initial version):
- Requires paid account, slower than local headless browsers
- Overkill for simple timer app
- Could be added later for comprehensive cross-browser validation on real devices

**Manual testing before deploy** (rejected):
- Not scalable or reliable
- Human error prone
- Slows development velocity
- Cannot enforce quality gates

**TestCafe/Cypress** (considered but unnecessary):
- TestCafe: No browser driver needed, simple setup, but Web Test Runner is lighter for vanilla JS
- Cypress: Excellent DX but heavier framework, designed for complex SPAs
- Both are viable but Web Test Runner better matches the "minimal tooling" constraint

## Recommended Testing Stack Summary

**Minimal Setup** (recommended starting point):
- **Framework**: Web Test Runner (@web/test-runner)
- **Browser Driver**: @web/test-runner-puppeteer
- **Browsers**: Chromium (headless in CI, headed for local development)
- **Assertion Library**: Built-in browser APIs or optionally Chai for better assertion messages
- **CI/CD**: GitHub Actions with test → deploy workflow
- **Test Types**: Unit tests (timer logic) + Integration tests (DOM/user flows)

**Total npm dependencies**: 2-3 packages
- @web/test-runner (required)
- @web/test-runner-puppeteer (required for browser automation)
- chai (optional, for better assertions)

**Estimated setup time**: 30-60 minutes including GitHub Actions configuration

## Additional Technical Decisions

### Timer Accuracy Implementation
- Use `performance.now()` for high-resolution time measurements (microsecond precision)
- Avoids issues with `Date.now()` being affected by system clock changes
- Provides accurate elapsed time calculation even with browser tab throttling

### State Management
- Simple in-memory state (no persistence in this version per spec assumptions)
- TimerManager class maintains single source of truth for all timer states
- Mutual exclusivity enforced at manager level, not individual timer level

### Browser Compatibility
- Target ES6+ features (arrow functions, classes, template literals, const/let)
- All target browsers (Chrome, Firefox, Safari, Edge - last 2 years) fully support ES6
- No transpilation needed, reducing complexity

### Performance Optimization
- Use `requestAnimationFrame` for smooth UI updates (60 fps)
- Debounce title edits to avoid excessive DOM updates
- Lazy render timers only when visible (if many timers added)

## References

This research synthesized findings from:
- Modern Web Test Runner documentation and best practices
- Vanilla JavaScript testing patterns and DOM manipulation guides
- GitHub Actions CI/CD configuration for browser-based testing
- Timer implementation patterns using `performance.now()` for accuracy
- Web performance optimization techniques for vanilla JS

## Next Steps

With all technical clarifications resolved, the project is ready to proceed to:
1. **Phase 1**: Generate data model, API contracts (if applicable), and quickstart guide
2. **Phase 2**: Task breakdown and implementation planning (executed via `/speckit.tasks` command)
