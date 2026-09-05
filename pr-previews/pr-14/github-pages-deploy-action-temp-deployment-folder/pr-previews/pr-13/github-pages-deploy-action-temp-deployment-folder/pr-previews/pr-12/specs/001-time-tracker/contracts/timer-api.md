# Timer API Contract

**Feature**: 001-time-tracker
**Date**: 2026-01-02
**Type**: Internal JavaScript Module Interface

## Overview

This document defines the public API contracts for the Timer and TimerManager JavaScript modules. Since this is a client-side only application with no backend REST/GraphQL API, this contract specifies the JavaScript class interfaces that constitute the application's internal API.

## Timer Class

### Constructor

```javascript
/**
 * Creates a new Timer instance
 * @param {string} title - Initial title for the timer
 * @param {string} [id] - Optional unique identifier (auto-generated if not provided)
 */
constructor(title, id)
```

**Parameters**:
- `title` (string, required): Initial title, max 50 characters
- `id` (string, optional): Unique identifier, auto-generated UUID if not provided

**Returns**: Timer instance

**Throws**:
- `TypeError` if title is not a string
- `RangeError` if title length exceeds 50 characters

**Example**:
```javascript
const timer = new Timer("Coding");
const timer2 = new Timer("Meetings", "custom-id-123");
```

---

### Properties

#### `id` (read-only)

```javascript
get id(): string
```

**Description**: Unique identifier for this timer

**Returns**: string

**Example**:
```javascript
const timer = new Timer("Task");
console.log(timer.id); // "a1b2c3d4-..."
```

---

#### `title` (read/write)

```javascript
get title(): string
set title(value: string): void
```

**Description**: User-editable label for the timer

**Getter Returns**: Current title string

**Setter Parameters**:
- `value` (string): New title, max 50 characters

**Setter Throws**:
- `TypeError` if value is not a string
- `RangeError` if value length exceeds 50 characters or is empty

**Example**:
```javascript
const timer = new Timer("Initial Title");
timer.title = "Updated Title"; // OK
timer.title = ""; // Throws RangeError
timer.title = "x".repeat(51); // Throws RangeError
```

---

#### `state` (read-only)

```javascript
get state(): "stopped" | "running" | "paused"
```

**Description**: Current state of the timer

**Returns**: One of: "stopped", "running", "paused"

**Example**:
```javascript
const timer = new Timer("Task");
console.log(timer.state); // "stopped"
```

---

### Methods

#### `start()`

```javascript
start(): void
```

**Description**: Starts the timer from its current elapsed time. If already running, this is a no-op.

**Side Effects**:
- Sets `state` to "running"
- Records current timestamp in `startTimeMs` using `performance.now()`
- Timer begins accumulating elapsed time

**Example**:
```javascript
const timer = new Timer("Task");
timer.start(); // Timer begins running from 00:00:00
```

---

#### `pause()`

```javascript
pause(): void
```

**Description**: Pauses the timer, preserving accumulated elapsed time. If not running, this is a no-op.

**Side Effects**:
- Sets `state` to "paused"
- Adds time since last `start()` to `elapsedMs`
- Clears `startTimeMs` (sets to null)

**Example**:
```javascript
const timer = new Timer("Task");
timer.start();
// ... 5 seconds pass ...
timer.pause(); // Timer shows 00:00:05, state is "paused"
```

---

#### `reset()`

```javascript
reset(): void
```

**Description**: Stops the timer and resets elapsed time to zero.

**Side Effects**:
- Sets `state` to "stopped"
- Resets `elapsedMs` to 0
- Clears `startTimeMs` (sets to null)

**Example**:
```javascript
const timer = new Timer("Task");
timer.start();
// ... 30 seconds pass ...
timer.reset(); // Timer shows 00:00:00, state is "stopped"
```

---

#### `getElapsedMs()`

```javascript
getElapsedMs(): number
```

**Description**: Returns total elapsed time in milliseconds, including time from current running session if timer is active.

**Returns**: Non-negative integer representing milliseconds

**Calculation**:
- If `state === "running"`: `elapsedMs + (performance.now() - startTimeMs)`
- Otherwise: `elapsedMs`

**Example**:
```javascript
const timer = new Timer("Task");
timer.start();
// ... 2.5 seconds pass ...
console.log(timer.getElapsedMs()); // ~2500
```

---

#### `getFormattedTime()`

```javascript
getFormattedTime(): string
```

**Description**: Returns elapsed time formatted as HH:MM:SS. Hours can exceed 99 (e.g., "125:30:45").

**Returns**: String in format "HH:MM:SS"

**Format Rules**:
- Hours: Zero-padded to 2 digits minimum, can exceed 99
- Minutes: Zero-padded to exactly 2 digits (00-59)
- Seconds: Zero-padded to exactly 2 digits (00-59)

**Example**:
```javascript
const timer = new Timer("Task");
timer.start();
// ... 1 hour, 1 minute, 5 seconds pass ...
console.log(timer.getFormattedTime()); // "01:01:05"

// ... 124 hours, 29 minutes, 40 seconds later ...
console.log(timer.getFormattedTime()); // "125:30:45"
```

---

#### `isRunning()`

```javascript
isRunning(): boolean
```

**Description**: Convenience method to check if timer is currently running.

**Returns**: `true` if `state === "running"`, otherwise `false`

**Example**:
```javascript
const timer = new Timer("Task");
console.log(timer.isRunning()); // false
timer.start();
console.log(timer.isRunning()); // true
timer.pause();
console.log(timer.isRunning()); // false
```

---

## TimerManager Class

### Constructor

```javascript
/**
 * Creates a new TimerManager instance with initial timers
 * @param {number} [initialCount=2] - Number of timers to create initially
 */
constructor(initialCount = 2)
```

**Parameters**:
- `initialCount` (number, optional): Number of timers to create, defaults to 2

**Returns**: TimerManager instance

**Throws**:
- `RangeError` if initialCount < 1 or > 20

**Side Effects**:
- Creates `initialCount` Timer instances with default titles ("Timer 1", "Timer 2", etc.)

**Example**:
```javascript
const manager = new TimerManager(); // Creates 2 timers
const manager2 = new TimerManager(5); // Creates 5 timers
```

---

### Methods

#### `addTimer()`

```javascript
/**
 * Adds a new timer with default or custom title
 * @param {string} [title] - Optional title for new timer
 * @returns {Timer} The newly created timer
 */
addTimer(title?: string): Timer
```

**Parameters**:
- `title` (string, optional): Custom title for new timer. If not provided, generates "Timer {n}" where n is the next sequential number.

**Returns**: The newly created Timer instance

**Throws**:
- `RangeError` if maximum timer count (20) already reached
- `TypeError` if title is provided but not a string
- `RangeError` if title exceeds 50 characters

**Side Effects**:
- Adds new Timer to internal `timers` array
- New timer starts in "stopped" state with 00:00:00 elapsed time

**Example**:
```javascript
const manager = new TimerManager();
const timer3 = manager.addTimer(); // Creates "Timer 3"
const timer4 = manager.addTimer("Custom Task"); // Creates timer with custom title
```

---

#### `removeTimer()`

```javascript
/**
 * Removes a timer by ID
 * @param {string} id - ID of timer to remove
 * @returns {boolean} true if removed, false if not found or cannot remove (last timer)
 */
removeTimer(id: string): boolean
```

**Parameters**:
- `id` (string, required): Unique identifier of timer to remove

**Returns**:
- `true` if timer was successfully removed
- `false` if timer ID not found or removal would violate minimum timer constraint (1 timer must always exist)

**Side Effects**:
- Removes timer from internal `timers` array
- If removed timer was running, sets `runningTimerId` to null (no other timer auto-starts)
- Remaining timers preserve their state and elapsed times

**Constraints**:
- Cannot remove last remaining timer (minimum 1 timer required)

**Example**:
```javascript
const manager = new TimerManager(3);
const timers = manager.getAllTimers();
const removed = manager.removeTimer(timers[1].id); // true
const cannotRemove = manager.removeTimer("invalid-id"); // false

// Try to remove last timer
const manager2 = new TimerManager(1);
const result = manager2.removeTimer(manager2.getAllTimers()[0].id); // false (min 1 timer)
```

---

#### `startTimer()`

```javascript
/**
 * Starts specified timer, automatically pausing any currently running timer
 * @param {string} id - ID of timer to start
 * @returns {boolean} true if started, false if timer ID not found
 */
startTimer(id: string): boolean
```

**Parameters**:
- `id` (string, required): Unique identifier of timer to start

**Returns**:
- `true` if timer was started successfully
- `false` if timer ID not found

**Side Effects**:
- Pauses currently running timer (if any) by calling its `pause()` method
- Starts specified timer by calling its `start()` method
- Updates `runningTimerId` to the specified timer's ID
- Enforces mutual exclusivity (only one timer running at a time)

**Idempotency**: If specified timer is already running, this is a no-op (timer continues running)

**Example**:
```javascript
const manager = new TimerManager();
const timers = manager.getAllTimers();

manager.startTimer(timers[0].id); // Starts Timer 1
manager.startTimer(timers[1].id); // Pauses Timer 1, starts Timer 2
manager.startTimer(timers[1].id); // No-op, Timer 2 continues running
```

---

#### `pauseTimer()`

```javascript
/**
 * Pauses specified timer if it's currently running
 * @param {string} id - ID of timer to pause
 * @returns {boolean} true if paused, false if timer ID not found
 */
pauseTimer(id: string): boolean
```

**Parameters**:
- `id` (string, required): Unique identifier of timer to pause

**Returns**:
- `true` if timer was paused successfully
- `false` if timer ID not found

**Side Effects**:
- Calls `pause()` method on specified timer
- If timer was running, sets `runningTimerId` to null
- Timer's elapsed time is preserved

**Idempotency**: If timer is already paused/stopped, this is a no-op

**Example**:
```javascript
const manager = new TimerManager();
const timers = manager.getAllTimers();

manager.startTimer(timers[0].id);
manager.pauseTimer(timers[0].id); // Pauses Timer 1, preserves elapsed time
manager.pauseTimer(timers[0].id); // No-op, already paused
```

---

#### `resetAll()`

```javascript
/**
 * Resets all timers to 00:00:00 and stops any running timer
 * @returns {void}
 */
resetAll(): void
```

**Description**: Stops all timers and resets them to zero elapsed time.

**Side Effects**:
- Calls `reset()` on every timer in the collection
- Sets `runningTimerId` to null
- All timers transition to "stopped" state with 00:00:00

**Example**:
```javascript
const manager = new TimerManager();
manager.startTimer(manager.getAllTimers()[0].id);
// ... some time passes ...
manager.resetAll(); // All timers show 00:00:00, all stopped
```

---

#### `getTimer()`

```javascript
/**
 * Retrieves a timer by ID
 * @param {string} id - ID of timer to retrieve
 * @returns {Timer | undefined} Timer instance or undefined if not found
 */
getTimer(id: string): Timer | undefined
```

**Parameters**:
- `id` (string, required): Unique identifier of timer to retrieve

**Returns**:
- Timer instance if found
- `undefined` if no timer with specified ID exists

**Example**:
```javascript
const manager = new TimerManager();
const timers = manager.getAllTimers();
const timer = manager.getTimer(timers[0].id); // Returns Timer instance
const notFound = manager.getTimer("invalid-id"); // Returns undefined
```

---

#### `getAllTimers()`

```javascript
/**
 * Returns all timers managed by this instance
 * @returns {Timer[]} Array of all Timer instances
 */
getAllTimers(): Timer[]
```

**Description**: Retrieves all timers in the collection.

**Returns**: Array of Timer instances (minimum length 1, maximum length 20)

**Note**: Returns a reference to internal array. Callers should not mutate this array directly; use `addTimer()` and `removeTimer()` instead.

**Example**:
```javascript
const manager = new TimerManager(3);
const allTimers = manager.getAllTimers(); // Array of 3 Timer instances
console.log(allTimers.length); // 3
```

---

#### `getRunningTimer()`

```javascript
/**
 * Returns the currently running timer, if any
 * @returns {Timer | null} Running Timer instance or null if no timer is running
 */
getRunningTimer(): Timer | null
```

**Description**: Retrieves the currently running timer.

**Returns**:
- Timer instance if a timer is running
- `null` if no timer is currently running

**Example**:
```javascript
const manager = new TimerManager();
const timers = manager.getAllTimers();

console.log(manager.getRunningTimer()); // null (no timer running)

manager.startTimer(timers[0].id);
console.log(manager.getRunningTimer()); // Timer instance for Timer 1

manager.pauseTimer(timers[0].id);
console.log(manager.getRunningTimer()); // null (timer paused)
```

---

## Event Handling (UI Layer)

The UI layer (app.js) should handle DOM events and call the appropriate Timer/TimerManager methods:

### User Actions → API Calls Mapping

| User Action | UI Event | API Call |
|-------------|----------|----------|
| Click "Start" button on Timer A | `click` on button | `timerManager.startTimer(timerA.id)` |
| Click "Pause" button on Timer A | `click` on button | `timerManager.pauseTimer(timerA.id)` |
| Edit timer title | `blur` or `enter` on input | `timer.title = newValue` |
| Click "Add Timer" | `click` on button | `timerManager.addTimer()` |
| Click "Remove" on Timer A | `click` on button | `timerManager.removeTimer(timerA.id)` |
| Click "Reset All" | `click` on button | `timerManager.resetAll()` |

### Display Updates

The UI layer should update the DOM based on timer state:

| State Change | DOM Update Trigger | Display Update |
|--------------|-------------------|----------------|
| Timer running | Every ~1000ms via `setInterval` | Call `timer.getFormattedTime()` and update display |
| Timer started | Immediately after `startTimer()` | Change button text to "Pause", highlight timer as active |
| Timer paused | Immediately after `pauseTimer()` | Change button text to "Start", remove active highlight |
| Timer reset | Immediately after `reset()` or `resetAll()` | Update display to "00:00:00", button shows "Start" |
| Title changed | Immediately after `title` setter | Update title display in DOM |
| Timer added | Immediately after `addTimer()` | Render new timer card in UI |
| Timer removed | Immediately after `removeTimer()` | Remove timer card from UI |

---

## Error Handling

All API methods handle errors consistently:

### Validation Errors

Methods throw standard JavaScript errors for invalid inputs:

```javascript
try {
  const timer = new Timer("x".repeat(51)); // Title too long
} catch (e) {
  console.error(e); // RangeError: Title cannot exceed 50 characters
}
```

### Not Found Errors

Methods that accept IDs return `false` or `undefined` for non-existent IDs rather than throwing:

```javascript
const success = manager.startTimer("invalid-id"); // Returns false
const timer = manager.getTimer("invalid-id"); // Returns undefined
```

### Constraint Violations

Methods return `false` when operations violate constraints:

```javascript
const manager = new TimerManager(20); // Max timers
const timer = manager.addTimer(); // Throws RangeError: Maximum 20 timers reached

const manager2 = new TimerManager(1); // Min timers
const removed = manager2.removeTimer(manager2.getAllTimers()[0].id); // Returns false
```

---

## Performance Considerations

### High-Resolution Timing

All time measurements use `performance.now()` for microsecond precision:

```javascript
// Internal implementation (conceptual)
start() {
  this.startTimeMs = performance.now(); // Not Date.now()
}

getElapsedMs() {
  if (this.state === "running") {
    return this.elapsedMs + (performance.now() - this.startTimeMs);
  }
  return this.elapsedMs;
}
```

### Update Frequency

- **Display updates**: Every 1000ms using `setInterval`
- **State changes**: Immediate (<100ms requirement)
- **Time calculations**: On-demand via `getElapsedMs()` (no continuous polling)

### Memory Management

- Maximum 20 timers × ~200 bytes each ≈ 4KB total memory footprint
- No memory leaks from intervals (cleared on timer pause/reset)
- DOM references cached to minimize lookups

---

## Contract Versioning

**Current Version**: 1.0.0

**Breaking Changes Policy**:
- Changes to method signatures require major version bump
- Adding new methods is non-breaking (minor version bump)
- Bug fixes and documentation updates are patches

**Future Considerations**:
- Persistence (localStorage/IndexedDB integration)
- Timer history/sessions
- Export functionality (CSV, JSON)
- Keyboard shortcuts
- Timer categories/tags

---

## Testing Contract Compliance

Tests should verify that implementations adhere to this contract:

### Unit Tests (Timer)
- Constructor accepts valid title and optional ID
- State transitions follow defined state machine
- `getElapsedMs()` accurately calculates running vs. paused time
- `getFormattedTime()` returns correct HH:MM:SS format
- Validation errors thrown for invalid inputs

### Unit Tests (TimerManager)
- Mutual exclusivity enforced (only one timer running)
- Minimum (1) and maximum (20) timer constraints respected
- `startTimer()` pauses currently running timer
- `resetAll()` resets all timers to 00:00:00
- Methods return correct values for not-found IDs

### Integration Tests
- UI interactions trigger correct API calls
- Display updates reflect timer state changes
- Timer accuracy maintained over extended periods (1+ hour)
- No race conditions with rapid state changes

---

## Summary

This API contract defines:
- **Timer class**: Individual timer with start/pause/reset operations
- **TimerManager class**: Orchestrates multiple timers with mutual exclusivity
- **Error handling**: Consistent validation and constraint enforcement
- **Performance**: High-resolution timing with efficient update cycles
- **Testing**: Clear contract compliance verification points

All public methods and properties are documented with parameters, return values, side effects, and examples to ensure correct implementation and usage.
