# Feature Specification: Multi-Timer Time Tracker

**Feature Branch**: `001-time-tracker`
**Created**: 2026-01-02
**Status**: Draft
**Input**: User description: "I want to create a simple webapp for tracking where time is spent. I want it to function similar to a chess clock where there are several clocks and only one is running at any moment. Starting another one pauses all others. Except these will count up from 0. They should show hours, minutes, sec. Include a reset button for each clock and that resets them all. This should be something that will be set up to run in the browser and automatically hosted on github.io. It should defualt to 2 timers but enable adding/removing timers. Each timer should have a title that can be edited"

## Clarifications

### Session 2026-01-02

- Q: How should the timers be visually arranged on the page? → A: Horizontal row (side-by-side, wrapping to new rows as needed)
- Q: How should users control each timer (start/pause/stop)? → A: Single toggle button per timer (shows "Start" when paused, "Pause" when running)
- Q: What level of keyboard accessibility should be supported? → A: Mouse/touch only (no keyboard support beyond basic browser defaults)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Track Time Between Two Activities (Priority: P1)

A user opens the webapp and sees two default timers with editable titles. They can start one timer to track time spent on an activity, then switch to the other timer when changing activities. The first timer automatically pauses when the second starts.

**Why this priority**: This is the core value proposition - the ability to track time across multiple activities with mutual exclusivity. Without this, there is no viable product.

**Independent Test**: Can be fully tested by starting Timer A, verifying it counts up, then starting Timer B and verifying Timer A pauses while Timer B runs. Delivers immediate value for basic time tracking between two activities.

**Acceptance Scenarios**:

1. **Given** webapp is loaded, **When** user views the page, **Then** two timers are displayed showing 00:00:00 with default titles
2. **Given** Timer A is stopped at 00:00:00, **When** user clicks start on Timer A, **Then** Timer A begins counting up (00:00:01, 00:00:02, etc.)
3. **Given** Timer A is running at 00:05:23, **When** user clicks start on Timer B, **Then** Timer A pauses at 00:05:23 and Timer B begins counting from 00:00:00
4. **Given** Timer B is running at 00:02:15, **When** user clicks start on Timer A, **Then** Timer B pauses at 00:02:15 and Timer A resumes counting from 00:05:23
5. **Given** Timer A is running, **When** user clicks on Timer A's title and types "Coding", **Then** the timer's title updates to "Coding"

---

### User Story 2 - Reset Accumulated Time (Priority: P2)

A user who has been tracking time across multiple activities wants to start fresh, resetting all timers back to zero to begin a new tracking session.

**Why this priority**: Essential for daily or session-based use, but the app still delivers value without it (users can just reload the page). This makes the tool more convenient and professional.

**Independent Test**: Can be tested by accumulating time on multiple timers, clicking the reset button, and verifying all timers return to 00:00:00. Delivers value for users who want to reuse the tool across multiple sessions.

**Acceptance Scenarios**:

1. **Given** Timer A shows 01:23:45 and Timer B shows 00:45:12, **When** user clicks the global reset button, **Then** both timers display 00:00:00 and all timers are stopped
2. **Given** Timer C is currently running at 00:10:30, **When** user clicks the global reset button, **Then** Timer C stops and resets to 00:00:00

---

### User Story 3 - Manage Multiple Activities (Priority: P3)

A user tracking more than two activities needs to add additional timers beyond the default two, or remove timers they no longer need.

**Why this priority**: Enhances flexibility but not required for basic use case. Users can accomplish significant value with just two timers. This extends the tool's utility for power users.

**Independent Test**: Can be tested by adding a third timer, verifying it works like the others, and removing a timer to verify the remaining timers continue functioning. Delivers value for users with complex tracking needs.

**Acceptance Scenarios**:

1. **Given** two timers are displayed, **When** user clicks "Add Timer" button, **Then** a third timer appears showing 00:00:00 with a default title
2. **Given** three timers exist (Timer A at 00:15:00, Timer B at 00:30:00, Timer C at 00:05:00), **When** user clicks remove on Timer B, **Then** only Timer A and Timer C remain with their accumulated times preserved
3. **Given** four timers exist with Timer C running, **When** user clicks start on Timer A, **Then** Timer C pauses and Timer A begins running
4. **Given** one timer exists, **When** user attempts to remove that timer, **Then** the remove button is disabled and the timer cannot be removed (minimum of 1 timer must always exist)

---

### Edge Cases

- What happens when a timer has been running for over 24 hours? Display should handle hours exceeding 99 (e.g., 125:30:45)
- What happens if user clicks start on an already running timer? Timer should continue running without interruption
- What happens when user edits a timer title while it's running? Timer should continue running and update the title without pausing
- What happens if user rapidly clicks between different timers? System should handle state changes cleanly without timing errors or display glitches
- What happens when user closes the browser tab or navigates away? Assume session is lost (no persistence requirement specified - documented in assumptions)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display timers in HH:MM:SS format (hours:minutes:seconds)
- **FR-002**: System MUST initialize with exactly 2 timers by default
- **FR-003**: System MUST ensure only one timer can be running at any given moment
- **FR-004**: System MUST automatically pause any running timer when a different timer is started
- **FR-005**: System MUST provide a single toggle button for each timer that displays "Start" when the timer is paused and "Pause" when the timer is running
- **FR-006**: System MUST count up from 00:00:00 when a timer is started
- **FR-007**: System MUST preserve accumulated time when a timer is paused
- **FR-008**: System MUST provide a global reset button that resets all timers to 00:00:00
- **FR-009**: System MUST stop all timers when global reset is triggered
- **FR-010**: System MUST allow users to edit each timer's title
- **FR-011**: System MUST provide the ability to add new timers
- **FR-012**: System MUST provide the ability to remove existing timers
- **FR-013**: System MUST preserve timer state and accumulated time when new timers are added or removed
- **FR-014**: System MUST be deployable as a static website to GitHub Pages
- **FR-015**: System MUST run entirely in the browser without requiring a backend server
- **FR-016**: System MUST maintain at least one timer at all times (cannot remove the last timer)

### Key Entities

- **Timer**: Represents a single time tracking unit with properties including:
  - Title (editable text label identifying the activity)
  - Elapsed time (accumulated time in hours, minutes, seconds)
  - State (running or paused)
  - Unique identifier (to distinguish between multiple timers)

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can switch between timers and see the previous timer pause within 100 milliseconds of clicking the new timer
- **SC-002**: Timer display updates every second with accurate elapsed time (no drift over 1-hour period exceeding 1 second)
- **SC-003**: Users can successfully add up to 10 timers without performance degradation (UI remains responsive)
- **SC-004**: 95% of users can complete the primary workflow (start timer, switch timer, reset all) on first attempt without instructions
- **SC-005**: Webapp loads and becomes interactive within 2 seconds on standard broadband connection
- **SC-006**: All timer state changes (start, pause, reset, add, remove) are reflected in the UI within 100 milliseconds

## Assumptions

- **Persistence**: Timer data is **intentionally NOT persisted** between browser sessions in this initial version. Closing or refreshing the page will reset all timers. Data persistence will be implemented as a separate follow-on feature.
- **Browser Compatibility**: Targets modern browsers (Chrome, Firefox, Safari, Edge) released within the last 2 years.
- **Single User**: Application is designed for single-user, single-device use (no synchronization across devices).
- **No Analytics**: No user tracking or analytics required in initial version.
- **Accessibility**: Primary interaction model is mouse/touch-based. Standard browser keyboard defaults apply (e.g., tab to inputs), but no additional keyboard shortcuts or enhanced accessibility features are required for this initial version.
- **Styling**: Clean, minimal interface following standard web design patterns. Timers arranged in horizontal row layout (side-by-side) using flexbox with wrapping enabled for responsive behavior when multiple timers are present.
- **Timer Limit**: Maximum of 20 timers can be created (reasonable upper bound to prevent abuse).
- **Title Length**: Timer titles limited to 50 characters to maintain clean UI.
- **Default Titles**: New timers receive sequential default titles ("Timer 1", "Timer 2", etc.) until user edits them.
