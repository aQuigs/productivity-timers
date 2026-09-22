# ADR-002: Idle Tab Time Allocation

**Status**: Proposed
**Date**: 2026-01-04
**Feature Branch**: `002-idle-allocation`

## Context & Problem

When a user hides/closes the browser tab while a timer is running, the current implementation pauses all timers (via `handleVisibilityChange()` in App.js). When the user returns, timers resume but **the idle time is lost** - it is not attributed to any activity.

Users need a way to allocate idle time to their timers when they return from extended absences. This is especially important for users who:
- Step away from their computer while working on a task
- Leave a tab open overnight and return the next morning
- Forget which activity they were doing during the idle period

**Decision Drivers**:
- Must be backwards compatible (existing behavior is preserved if user declines allocation)
- Must handle edge cases (timer deleted during idle, very long idle periods)
- Modal must not interfere with normal short-duration visibility changes
- Must integrate cleanly with existing chess-clock constraint (one timer at a time)

## Requirements Summary

When user returns after >10 seconds idle (tab hidden/closed):
1. Detect idle duration and calculate elapsed time
2. Show modal with 5 distribution strategies:
   - Add all to previously-active timer (if one was running)
   - Add all to user-selected timer
   - Fixed time distribution + remainder to specific timer
   - Percentage distribution + remainder to specific timer
   - Discard idle time (current behavior)
3. Apply selected distribution to timers
4. Resume previously-running timer if it still exists
5. Update all displays

## Approach

### Architecture Overview

Follow the existing separation of concerns pattern:

```
IdleDetector (NEW)        - Tracks visibility changes, calculates idle duration
TimeDistributor (NEW)     - Strategies for allocating time to timers
AllocationModal (NEW)     - DOM component for user selection
Timer.js                  - Add addMs(amount) method
TimerManager.js           - Add distributeTime(allocations) method
App.js                    - Coordinate components, invoke modal on return
StorageService.js         - Store hidden timestamp for cross-session idle
```

### Component Responsibilities

**IdleDetector** (`/js/idleDetector.js`)
- Listens to `visibilitychange` events
- Records timestamp when document becomes hidden
- Calculates idle duration when document becomes visible
- Emits event/callback when idle exceeds threshold (10s)
- Persists `hiddenTimestamp` to localStorage for tab-close scenarios

**TimeDistributor** (`/js/timeDistributor.js`)
- Pure computation module with no side effects
- Implements 5 allocation strategies:
  1. `allocateToSingle(totalMs, timerId)` - All time to one timer
  2. `allocateFixed(totalMs, fixedAmounts, remainderTimerId)` - Fixed ms per timer
  3. `allocatePercentage(totalMs, percentages, remainderTimerId)` - Percentage-based
  4. `allocateDiscard()` - Returns empty allocation (no-op)
- Returns `Map<timerId, addMs>` for TimerManager to apply

**AllocationModal** (`/js/allocationModal.js`)
- Creates and manages modal DOM element
- Displays idle duration, timer options
- Renders appropriate input fields per strategy
- Returns Promise resolving to user's selection
- Handles cancel/close (defaults to discard)

**Timer.addMs(amount)**
- New method on Timer class
- Adds milliseconds to accumulated `#elapsedMs`
- Validates: amount must be non-negative integer
- Works regardless of timer state

**TimerManager.distributeTime(allocations)**
- New method accepting `Map<timerId, addMs>`
- Iterates allocations, calls `timer.addMs()` for each
- Persists after all allocations applied
- Returns boolean success

### Flow Diagram

```
User returns from idle
        |
        v
IdleDetector.onVisible()
        |
        v
Calculate idle duration from hiddenTimestamp
        |
        v
[idle > 10s?] --No--> Resume timer normally (existing behavior)
        |
       Yes
        v
App.showAllocationModal(idleMs, timers, previousRunningId)
        |
        v
AllocationModal displays options
        |
        v
User selects strategy + configuration
        |
        v
TimeDistributor.calculate(strategy, config, idleMs)
        |
        v
Returns Map<timerId, addMs>
        |
        v
TimerManager.distributeTime(allocations)
        |
        v
Resume previous timer if exists (via startTimer)
        |
        v
Update all displays
```

### Storage Schema Extension

```javascript
// Existing schema in localStorage
{
  version: 1,
  timestamp: Date.now(),
  data: {
    timers: [...],
    runningTimerId: string | null,
    // NEW: Track hidden state for cross-session idle
    hiddenAt: number | null,  // timestamp when tab was hidden
    runningTimerIdBeforeHide: string | null  // which timer was running
  }
}
```

### Modal UI Design

```
+----------------------------------------------------------+
|  Time Away: 2 hours, 34 minutes, 12 seconds              |
+----------------------------------------------------------+
|                                                          |
|  How would you like to allocate this time?               |
|                                                          |
|  ( ) Add all to [previously active timer: "Coding"]      |
|  ( ) Add all to: [dropdown of all timers]                |
|  ( ) Distribute fixed amounts:                           |
|        Timer 1: [____] min  Timer 2: [____] min          |
|        Remainder to: [dropdown]                          |
|  ( ) Distribute by percentage:                           |
|        Timer 1: [__]%  Timer 2: [__]%                    |
|        Remainder to: [dropdown]                          |
|  (x) Discard (don't allocate)                           |
|                                                          |
|           [Cancel]            [Apply]                    |
+----------------------------------------------------------+
```

## Trade-offs

**Accepted**:
| Trade-off | Impact | Rationale |
|-----------|--------|-----------|
| Modal interrupts workflow | ~3s user attention per return | Necessary for user agency over time allocation |
| Additional localStorage fields | ~100 bytes | Minimal; enables cross-session idle tracking |
| IdleDetector adds visibility listener | 1 extra listener | Required; existing one in App.js will delegate to IdleDetector |

**Mitigations**:
- Modal only appears after 10s+ idle (not on brief tab switches)
- "Discard" is default selection for quick dismissal
- ESC key closes modal with discard behavior
- Modal auto-closes after 60s with discard if user doesn't interact

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Timer deleted during idle | Low | Modal shows invalid option | Filter timers at modal display time; handle missing timer gracefully |
| Very long idle (days) | Low | Large time values could overflow | Use BigInt for calculations >24h; display warning for >24h idle |
| User closes modal without selecting | Medium | Unexpected state | Default to discard; restore previous timer state |
| Performance.now() reset on page reload | High | Cannot calculate cross-session idle | Store hiddenAt as Date.now() timestamp in localStorage |
| Modal blocks RAF update loop | Medium | Display freeze during modal | Continue RAF loop; modal is overlay, not blocking |

## Backwards Compatibility

- **Default behavior unchanged**: Without user interaction, no time is allocated (discard)
- **Storage version**: Same version (1), new fields are optional with null defaults
- **Existing tests pass**: No changes to Timer/TimerManager public API signatures
- **Graceful degradation**: If localStorage unavailable, idle tracking limited to current session

## Implementation Workstreams

### Workstream A: Core Domain Logic (No DOM)
Independent unit-testable components:

1. **Timer.addMs()** - Add method to Timer class
2. **TimeDistributor module** - All 5 allocation strategies
3. **IdleDetector module** - Visibility tracking, idle calculation

### Workstream B: TimerManager Integration
Depends on: Workstream A (Timer.addMs)

1. **TimerManager.distributeTime()** - Apply allocations to timers
2. **StorageService schema extension** - hiddenAt, runningTimerIdBeforeHide

### Workstream C: Modal UI Component
Independent of A/B until integration:

1. **AllocationModal component** - DOM creation, event handling
2. **Modal CSS styles** - Consistent with existing dark theme

### Workstream D: Integration & App.js
Depends on: A, B, C complete

1. **Refactor App.handleVisibilityChange()** - Delegate to IdleDetector
2. **Wire up modal invocation** - Show modal when idle > threshold
3. **Apply allocation and resume** - Complete flow

## Task Breakdown with Dependencies

```
Phase 1: Core Components (Parallelizable)
├── [A1] Timer.addMs() + tests
├── [A2] TimeDistributor module + tests
├── [A3] IdleDetector module + tests
└── [C1] AllocationModal component + tests
    └── [C2] Modal CSS styles

Phase 2: Integration Layer
├── [B1] TimerManager.distributeTime() + tests (depends: A1)
└── [B2] StorageService schema extension + tests

Phase 3: Final Integration
├── [D1] Refactor App.handleVisibilityChange() (depends: A3, B1, B2)
├── [D2] Wire up modal invocation (depends: D1, C1, C2)
└── [D3] Integration tests (depends: D2)

Phase 4: Polish
├── [E1] Manual acceptance testing
└── [E2] Edge case handling (long idle, deleted timers)
```

## Testing Strategy

### Unit Tests (per component)
- **Timer.addMs()**: Positive values, zero, negative rejection, state preservation
- **TimeDistributor**: Each strategy with various inputs, remainder handling, edge cases
- **IdleDetector**: Visibility transitions, threshold logic, timestamp persistence
- **AllocationModal**: Renders correctly, returns proper selection, handles cancel

### Integration Tests
- Full flow: hide -> wait -> show -> select strategy -> verify timer values
- Storage persistence across simulated page reloads
- Timer deletion during idle scenario
- Chess-clock constraint maintained after allocation

### Manual Acceptance Tests
1. Hide tab for >10s, return, select "add all to previously active" - verify time added
2. Hide tab for <10s, return - verify no modal shown
3. Select percentage allocation 50%/50% - verify even split
4. Select fixed allocation with remainder - verify correct distribution
5. Close modal with X or ESC - verify no time allocated
6. Timer deleted during idle - verify graceful handling

## File Modifications Summary

| File | Changes |
|------|---------|
| `/js/timer.js` | Add `addMs(amount)` method |
| `/js/timerManager.js` | Add `distributeTime(allocations)` method |
| `/js/storageService.js` | Add hiddenAt, runningTimerIdBeforeHide to schema |
| `/js/app.js` | Refactor handleVisibilityChange, add modal integration |
| `/js/idleDetector.js` | NEW: Visibility tracking module |
| `/js/timeDistributor.js` | NEW: Allocation strategy module |
| `/js/allocationModal.js` | NEW: Modal UI component |
| `/css/styles.css` | Add modal overlay and form styles |
| `/index.html` | No changes needed (modal created dynamically) |
| `/tests/timer.test.js` | Add addMs() tests |
| `/tests/timerManager.test.js` | Add distributeTime() tests |
| `/tests/timeDistributor.test.js` | NEW: Strategy tests |
| `/tests/idleDetector.test.js` | NEW: Visibility tests |
| `/tests/allocationModal.test.js` | NEW: Modal tests |
| `/tests/integration.test.js` | Add full-flow integration tests |

## Acceptance Criteria by Task

### A1: Timer.addMs()
- [ ] `timer.addMs(5000)` increases elapsedMs by 5000
- [ ] `timer.addMs(0)` is no-op (no error)
- [ ] `timer.addMs(-100)` throws RangeError
- [ ] Works on stopped, paused, and running timers
- [ ] Running timer: adds to accumulated, not to running session

### A2: TimeDistributor
- [ ] `allocateToSingle(60000, 'timer-1')` returns `{'timer-1': 60000}`
- [ ] `allocateFixed(60000, {'t1': 20000, 't2': 20000}, 't3')` returns correct map with t3 getting 20000 remainder
- [ ] `allocatePercentage(60000, {'t1': 50, 't2': 30}, 't3')` returns t1: 30000, t2: 18000, t3: 12000
- [ ] `allocateDiscard()` returns empty Map
- [ ] Handles rounding correctly (no lost milliseconds)

### A3: IdleDetector
- [ ] Emits callback when document hidden -> visible and idle > 10s
- [ ] Does NOT emit when idle <= 10s
- [ ] Persists hiddenTimestamp to localStorage
- [ ] Calculates correct idle duration across page reloads
- [ ] Clears hiddenTimestamp after emission

### B1: TimerManager.distributeTime()
- [ ] Applies allocations to correct timers
- [ ] Persists state after allocation
- [ ] Skips missing timer IDs gracefully (logs warning)
- [ ] Returns true on success, false if all allocations failed

### B2: StorageService Schema
- [ ] Saves/loads hiddenAt field
- [ ] Saves/loads runningTimerIdBeforeHide field
- [ ] Validates new fields (null or valid timestamp/id)
- [ ] Backwards compatible (loads old schema without new fields)

### C1: AllocationModal
- [ ] Renders with correct idle time display
- [ ] Shows all 5 strategy options
- [ ] Returns selected strategy and configuration on Apply
- [ ] Returns discard on Cancel/ESC/X
- [ ] Validates inputs (percentages sum to <=100, fixed amounts <= total)

### C2: Modal CSS
- [ ] Modal overlay covers viewport
- [ ] Consistent with existing dark theme variables
- [ ] Responsive on mobile viewports
- [ ] Focus trap within modal

### D1-D3: Integration
- [ ] Full flow works end-to-end
- [ ] Previous timer resumes after allocation
- [ ] Chess-clock constraint maintained
- [ ] UI updates reflect new timer values

## Estimated Effort

| Task | Estimate | Notes |
|------|----------|-------|
| A1: Timer.addMs | 0.5h | Simple method addition |
| A2: TimeDistributor | 2h | 5 strategies with tests |
| A3: IdleDetector | 2h | Visibility API, localStorage |
| B1: TimerManager.distributeTime | 1h | Integration with Timer |
| B2: StorageService extension | 1h | Schema migration |
| C1: AllocationModal | 3h | Complex UI with multiple inputs |
| C2: Modal CSS | 1h | Styling only |
| D1-D3: Integration | 2h | Wiring components |
| E1-E2: Testing/Polish | 2h | Manual testing, edge cases |
| **Total** | **~14.5h** | |

## Open Questions

1. **Should allocation be undoable?** Current design does not include undo. Consider adding "Undo last allocation" option that appears for 10s after allocation.

2. **Should threshold be configurable?** Currently hardcoded at 10s. Could be user preference stored in localStorage.

3. **What about tab-close vs tab-hide?** Current design handles both the same way via localStorage. Confirm this meets user expectations.
