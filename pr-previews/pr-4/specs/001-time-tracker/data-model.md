# Data Model: Multi-Timer Time Tracker

**Feature**: 001-time-tracker
**Date**: 2026-01-02
**Status**: Completed

## Overview

This document defines the data structures and state management for the multi-timer time tracking application. Since this is a client-side only application with no backend or persistence, the data model focuses on in-memory JavaScript objects and their relationships.

## Entities

### 1. Timer

Represents a single time tracking unit.

**Properties**:

| Property | Type | Description | Validation Rules |
|----------|------|-------------|------------------|
| `id` | string | Unique identifier for the timer | Required, auto-generated UUID or sequential ID |
| `title` | string | User-editable label identifying the activity | Required, max 50 characters, defaults to "Timer {n}" |
| `elapsedMs` | number | Accumulated time in milliseconds | Required, non-negative integer, ≥ 0 |
| `state` | string | Current timer state | Required, enum: "stopped", "running", "paused" |
| `startTimeMs` | number \| null | Timestamp when timer was last started (from `performance.now()`) | null when stopped/paused, number when running |

**State Transitions**:

```text
┌─────────┐
│ stopped │ (initial state, after reset)
└────┬────┘
     │ start()
     ▼
┌─────────┐
│ running │◄─────┐
└────┬────┘      │
     │ pause()   │ resume()
     ▼           │
┌─────────┐      │
│ paused  │──────┘
└─────────┘
     │ reset()
     ▼
┌─────────┐
│ stopped │
└─────────┘
```

**Derived Values**:

| Method | Returns | Description |
|--------|---------|-------------|
| `getElapsedMs()` | number | If running: `elapsedMs + (performance.now() - startTimeMs)`, else: `elapsedMs` |
| `getFormattedTime()` | string | Returns time in HH:MM:SS format (e.g., "01:23:45") |
| `isRunning()` | boolean | Returns `true` if `state === "running"` |

**Invariants**:
- Only one timer in the system can have `state === "running"` at any given moment (enforced by TimerManager)
- `elapsedMs` must never decrease (except when reset to 0)
- `startTimeMs` must be `null` when `state !== "running"`
- Timer must handle hours > 99 (e.g., "125:30:45" for 125 hours, 30 minutes, 45 seconds)

### 2. TimerManager

Orchestrates multiple timers and enforces mutual exclusivity.

**Properties**:

| Property | Type | Description | Validation Rules |
|----------|------|-------------|------------------|
| `timers` | Array\<Timer\> | Collection of all timer instances | Required, min length 1, max length 20 |
| `runningTimerId` | string \| null | ID of currently running timer, if any | null or valid timer ID from `timers` array |

**Methods**:

| Method | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `addTimer()` | title?: string | Timer | Creates new timer with default or custom title, adds to `timers` array |
| `removeTimer(id)` | id: string | boolean | Removes timer by ID, returns false if last timer (min 1 required) |
| `startTimer(id)` | id: string | void | Pauses currently running timer (if any), starts specified timer |
| `pauseTimer(id)` | id: string | void | Pauses specified timer if it's running |
| `resetAll()` | none | void | Stops and resets all timers to 00:00:00 |
| `getTimer(id)` | id: string | Timer \| undefined | Retrieves timer by ID |
| `getAllTimers()` | none | Array\<Timer\> | Returns all timers |

**Invariants**:
- At most one timer can be running at any time
- Must maintain at least 1 timer (cannot remove last timer)
- Maximum of 20 timers allowed
- Starting an already-running timer is a no-op (no state change)

## State Management

### In-Memory State

Since the application has no persistence requirement (per spec assumptions), all state is maintained in memory:

```javascript
// Global application state (conceptual structure)
{
  timerManager: TimerManager {
    timers: [
      Timer { id: "1", title: "Coding", elapsedMs: 3665000, state: "paused", startTimeMs: null },
      Timer { id: "2", title: "Meetings", elapsedMs: 1825000, state: "running", startTimeMs: 123456789.123 }
    ],
    runningTimerId: "2"
  }
}
```

### Update Cycle

1. **User Action** (click start/pause/reset/add/remove)
2. **State Update** (TimerManager modifies Timer objects)
3. **UI Refresh** (app.js updates DOM to reflect new state)

Update frequency:
- Timer display: Every 1000ms (1 second) via `setInterval`
- User interactions: Immediate (<100ms requirement)

### Persistence Strategy (Future)

While not required in this version, future persistence could be added via:
- **localStorage**: Simple key-value storage for timer state
- **IndexedDB**: Structured storage for timer history/sessions
- **Backend API**: Cloud sync across devices

Implementation would require serialization/deserialization of Timer and TimerManager objects.

## Validation Rules

### Timer Title Validation

```javascript
function validateTitle(title) {
  if (title.length === 0) {
    return { valid: false, error: "Title cannot be empty" };
  }
  if (title.length > 50) {
    return { valid: false, error: "Title cannot exceed 50 characters" };
  }
  return { valid: true };
}
```

### Timer Count Validation

```javascript
function canAddTimer(currentCount) {
  return currentCount < 20; // Max 20 timers
}

function canRemoveTimer(currentCount) {
  return currentCount > 1; // Min 1 timer
}
```

## Time Formatting

### HH:MM:SS Display Format

```javascript
function formatTime(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Pad minutes and seconds to 2 digits, hours can exceed 2 digits
  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');

  return `${hh}:${mm}:${ss}`;
}

// Examples:
// formatTime(0) → "00:00:00"
// formatTime(3665000) → "01:01:05" (1 hour, 1 min, 5 sec)
// formatTime(451865000) → "125:30:05" (125 hours, 30 min, 5 sec)
```

## Edge Cases

### Timer Running > 24 Hours

- Display must handle hours exceeding 99 (e.g., "125:30:45")
- No rollover to days (keep HH:MM:SS format)
- Maximum supported: 999 hours, 59 minutes, 59 seconds ("999:59:59")

### Rapid State Changes

- Clicking start on already-running timer: No-op (timer continues)
- Rapidly switching between timers: Each start() call pauses previous timer cleanly
- Clicking pause immediately after start: Timer pauses at ~0-100ms elapsed

### Editing Title While Running

- Timer continues running without interruption
- Title updates in real-time
- No state change to timer (only title property modified)

### Reset During Running Timer

- Immediately stops timer
- Resets elapsed time to 0
- Sets state to "stopped"
- Applies to all timers simultaneously

### Removing Currently Running Timer

- If removed timer is running, set `runningTimerId = null`
- No other timer auto-starts (mutual exclusivity maintained)
- Remaining timers preserve their elapsed times and paused states

## Implementation Notes

### Timer Accuracy

Use `performance.now()` instead of `Date.now()` for timer calculations:

```javascript
// CORRECT: High-resolution, monotonically increasing
const start = performance.now();
// ... time passes ...
const elapsed = performance.now() - start;

// INCORRECT: Subject to system clock changes
const start = Date.now();
// ... if user changes system clock, elapsed will be wrong ...
const elapsed = Date.now() - start;
```

### Performance Optimization

- Update timer displays using `requestAnimationFrame` for smooth 60fps rendering
- Cache DOM references to timer elements (avoid repeated `querySelector` calls)
- Batch DOM updates when adding/removing multiple timers
- Use event delegation for timer controls (single event listener for all timers)

### Browser Tab Throttling

Modern browsers throttle background tabs to save resources. Considerations:

- `setInterval` may run less frequently than 1000ms in background tabs
- `performance.now()` continues accurately even when throttled
- Timer accuracy maintained because elapsed time is calculated from `performance.now()` difference, not interval count
- UI updates may lag in background tab, but state remains accurate

## Testing Considerations

### Unit Tests (Timer Logic)

- Test state transitions (stopped → running → paused → stopped)
- Verify elapsed time calculation accuracy
- Test edge cases (24+ hour timers, rapid state changes)
- Validate time formatting for various durations

### Integration Tests (TimerManager)

- Test mutual exclusivity (only one running timer)
- Verify add/remove timer operations
- Test global reset functionality
- Validate minimum (1) and maximum (20) timer constraints

### UI Tests (DOM Manipulation)

- Test timer display updates every second
- Verify start/pause button state changes
- Test title editing while timer is running
- Validate responsive layout with multiple timers

## Summary

The data model is intentionally simple to match the application's requirements:

- **2 core entities**: Timer (individual timer) and TimerManager (orchestration)
- **3 timer states**: stopped, running, paused
- **In-memory only**: No persistence (future enhancement)
- **Mutual exclusivity**: Enforced at TimerManager level
- **High accuracy**: Using `performance.now()` for precise timing
- **Clear validation**: Title length, timer count constraints

This model supports all functional requirements (FR-001 through FR-016) defined in the feature specification.
