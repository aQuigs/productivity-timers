# Tasks: Multi-Timer Time Tracker

**Input**: Design documents from `/specs/001-time-tracker/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/timer-api.md

**Tests**: Included per quickstart.md (Web Test Runner with Chromium)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- Static web app: all files at repository root
- Source: `js/` directory
- Styles: `css/` directory
- Tests: `tests/` directory

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create project directory structure (index.html, js/, css/, tests/)
- [X] T002 Initialize package.json with Web Test Runner dependencies
- [X] T003 [P] Create web-test-runner.config.js for test configuration
- [X] T004 [P] Create .gitignore for node_modules and test artifacts
- [X] T005 [P] Setup GitHub Actions workflow in .github/workflows/deploy.yml for testing and GitHub Pages deployment

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core Timer class that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until Timer class is complete

- [X] T006 Write unit tests for Timer class in tests/timer.test.js (constructor, state transitions, time formatting)
- [X] T007 Implement Timer class in js/timer.js (properties: id, title, elapsedMs, state, startTimeMs)
- [X] T008 Implement Timer.start() method with performance.now() timestamp tracking
- [X] T009 Implement Timer.pause() method preserving accumulated elapsed time
- [X] T010 Implement Timer.reset() method setting state to stopped and elapsedMs to 0
- [X] T011 Implement Timer.getElapsedMs() method calculating current elapsed time
- [X] T012 Implement Timer.getFormattedTime() method returning HH:MM:SS format (supporting hours > 99)
- [X] T013 Implement Timer.isRunning() convenience method
- [X] T014 Add title validation in Timer class (max 50 chars, non-empty)
- [X] T015 Run tests to verify Timer class implementation

**Checkpoint**: Timer class complete and tested - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Track Time Between Two Activities (Priority: P1) 🎯 MVP

**Goal**: Users can switch between two default timers with mutual exclusivity (chess-clock behavior)

**Independent Test**: Start Timer A, verify it counts up, start Timer B, verify Timer A pauses and Timer B runs

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T016 [P] [US1] Write unit tests for TimerManager class in tests/timerManager.test.js (constructor, startTimer, mutual exclusivity)
- [X] T017 [P] [US1] Write integration tests for UI interactions in tests/integration.test.js (start/pause buttons, timer display updates)

### Implementation for User Story 1

- [X] T018 [US1] Implement TimerManager class constructor in js/timerManager.js (creates 2 default timers)
- [X] T019 [US1] Implement TimerManager.getAllTimers() method returning timers array
- [X] T020 [US1] Implement TimerManager.getTimer(id) method for retrieving specific timer
- [X] T021 [US1] Implement TimerManager.getRunningTimer() method returning currently running timer or null
- [X] T022 [US1] Implement TimerManager.startTimer(id) method with mutual exclusivity (pauses other timers)
- [X] T023 [US1] Implement TimerManager.pauseTimer(id) method
- [X] T024 [US1] Run TimerManager unit tests to verify mutual exclusivity behavior
- [X] T025 [US1] Create HTML structure in index.html (timer container, timer cards, buttons)
- [X] T026 [US1] Create CSS styles in css/styles.css (flexbox layout, timer cards, button styling)
- [X] T027 [US1] Implement App module initialization in js/app.js (creates TimerManager, renders initial timers)
- [X] T028 [US1] Implement renderTimer() function in js/app.js (creates timer card DOM elements)
- [X] T029 [US1] Implement updateTimerDisplay() function in js/app.js (updates HH:MM:SS display every second)
- [X] T030 [US1] Bind start/pause button click events to TimerManager.startTimer/pauseTimer in js/app.js
- [X] T031 [US1] Implement setInterval loop for updating timer displays (1000ms interval)
- [X] T032 [US1] Implement timer title editing with contenteditable or input field in js/app.js
- [X] T033 [US1] Add visual styling for active (running) timer in css/styles.css
- [X] T034 [US1] Run integration tests to verify UI interactions work correctly
- [X] T035 [US1] Manual browser test: Start Timer 1, switch to Timer 2, verify Timer 1 pauses

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently - two timers with mutual exclusivity

---

## Phase 4: User Story 2 - Reset Accumulated Time (Priority: P2)

**Goal**: Users can reset all timers to zero to start fresh tracking session

**Independent Test**: Accumulate time on multiple timers, click reset button, verify all show 00:00:00 and are stopped

### Tests for User Story 2

- [X] T036 [P] [US2] Write unit tests for TimerManager.resetAll() in tests/timerManager.test.js
- [X] T037 [P] [US2] Write integration test for reset button in tests/integration.test.js

### Implementation for User Story 2

- [X] T038 [US2] Implement TimerManager.resetAll() method in js/timerManager.js (calls reset() on all timers)
- [X] T039 [US2] Add "Reset All" button to HTML in index.html
- [X] T040 [US2] Style "Reset All" button in css/styles.css
- [X] T041 [US2] Bind "Reset All" button click event to TimerManager.resetAll() in js/app.js
- [X] T042 [US2] Update UI to refresh all timer displays to 00:00:00 after reset in js/app.js
- [X] T043 [US2] Run unit tests to verify resetAll() behavior
- [X] T044 [US2] Manual browser test: Accumulate time on timers, click reset, verify all show 00:00:00

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently - timers work + reset functionality

---

## Phase 5: User Story 3 - Manage Multiple Activities (Priority: P3)

**Goal**: Users can add/remove timers dynamically beyond the default two

**Independent Test**: Add a third timer, verify it works with mutual exclusivity, remove a timer, verify remaining timers continue functioning

### Tests for User Story 3

- [X] T045 [P] [US3] Write unit tests for TimerManager.addTimer() in tests/timerManager.test.js (max 20 timers)
- [X] T046 [P] [US3] Write unit tests for TimerManager.removeTimer() in tests/timerManager.test.js (min 1 timer constraint)
- [X] T047 [P] [US3] Write integration tests for add/remove buttons in tests/integration.test.js

### Implementation for User Story 3

- [X] T048 [US3] Implement TimerManager.addTimer() method in js/timerManager.js (generates default title "Timer N", enforces max 20)
- [X] T049 [US3] Implement TimerManager.removeTimer(id) method in js/timerManager.js (enforces min 1 timer, handles running timer removal)
- [X] T050 [US3] Add "Add Timer" button to HTML in index.html
- [X] T051 [US3] Add "Remove" button to each timer card template in js/app.js renderTimer() function
- [X] T052 [US3] Style "Add Timer" and "Remove" buttons in css/styles.css
- [X] T053 [US3] Bind "Add Timer" button to add new timer and render it in js/app.js
- [X] T054 [US3] Bind "Remove" button click events to TimerManager.removeTimer() in js/app.js
- [X] T055 [US3] Implement disabling "Remove" button when only 1 timer exists in js/app.js
- [X] T056 [US3] Implement disabling "Add Timer" button when 20 timers exist in js/app.js
- [X] T057 [US3] Update UI to remove timer card from DOM when timer is removed in js/app.js
- [X] T058 [US3] Run unit tests to verify add/remove timer constraints
- [X] T059 [US3] Manual browser test: Add third timer, start it, verify mutual exclusivity, remove timer, verify others continue working

**Checkpoint**: All user stories should now be independently functional - full feature set complete

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and deployment readiness

- [X] T060 [P] Add responsive CSS for mobile/tablet layouts in css/styles.css (flexbox wrapping)
- [X] T061 [P] Implement requestAnimationFrame for smooth timer display updates in js/app.js
- [X] T062 [P] Add CSS transitions for active timer highlighting in css/styles.css
- [X] T063 Optimize DOM updates by caching timer element references in js/app.js
- [X] T064 [P] Add edge case handling for rapid timer switching in js/app.js
- [X] T065 [P] Add visual feedback for button clicks (CSS active states) in css/styles.css
- [X] T066 Run all tests (npm test) and verify 100% pass rate
- [X] T067 Manual testing across browsers (Chrome, Firefox, Safari, Edge)
- [X] T068 Performance testing with 10+ timers (verify <100ms UI response per SC-006)
- [X] T069 Timer accuracy validation over 1-hour period (verify <1s drift per SC-002)
- [X] T070 Verify GitHub Pages deployment configuration in .github/workflows/deploy.yml
- [X] T071 Update README.md with quickstart instructions for local development
- [X] T072 Code cleanup and removal of console.log statements
- [X] T073 Final manual test of all acceptance scenarios from spec.md

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-5)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - No dependencies on US1 (independently testable)
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - No dependencies on US1/US2 (independently testable)

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- TimerManager methods before App/UI layer
- HTML structure before CSS styling
- Core functionality before edge case handling
- Unit tests pass before integration tests
- Integration tests pass before manual browser testing

### Parallel Opportunities

- **Phase 1 Setup**: Tasks T003, T004, T005 can run in parallel
- **Phase 2 Foundational**: Timer class methods (T008-T013) can run in parallel after T007 creates class skeleton
- **User Story 1 Tests**: T016 and T017 can run in parallel
- **User Story 2 Tests**: T036 and T037 can run in parallel
- **User Story 3 Tests**: T045, T046, T047 can run in parallel
- **Polish Phase**: Tasks T060, T061, T062, T064, T065 can run in parallel
- **Different user stories can be worked on in parallel** after Foundational phase completes (if team capacity allows)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task T016: "Write unit tests for TimerManager class in tests/timerManager.test.js"
Task T017: "Write integration tests for UI interactions in tests/integration.test.js"

# After TimerManager class skeleton exists, implement methods in parallel:
# (Note: These share same file, so only parallelize if using different branches or pair programming)
Task T019: "Implement TimerManager.getAllTimers() method"
Task T020: "Implement TimerManager.getTimer(id) method"
Task T021: "Implement TimerManager.getRunningTimer() method"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (5 tasks)
2. Complete Phase 2: Foundational - Timer class (10 tasks, CRITICAL)
3. Complete Phase 3: User Story 1 (20 tasks)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy to GitHub Pages for demo

**MVP Deliverable**: Two timers with mutual exclusivity, editable titles, chess-clock behavior

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (15 tasks)
2. Add User Story 1 → Test independently → Deploy/Demo (MVP! 20 tasks)
3. Add User Story 2 → Test independently → Deploy/Demo (9 tasks)
4. Add User Story 3 → Test independently → Deploy/Demo (15 tasks)
5. Polish phase → Final production release (14 tasks)

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (15 tasks)
2. Once Foundational is done:
   - Developer A: User Story 1 (20 tasks)
   - Developer B: User Story 2 (9 tasks)
   - Developer C: User Story 3 (15 tasks)
3. Stories complete and merge independently
4. Team reconvenes for Polish phase (14 tasks)

---

## Notes

- [P] tasks = different files, no dependencies within same phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing (TDD approach)
- Use `performance.now()` for timer accuracy (not `Date.now()`)
- Cache DOM references to optimize render performance
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Total: 73 tasks organized across 6 phases
