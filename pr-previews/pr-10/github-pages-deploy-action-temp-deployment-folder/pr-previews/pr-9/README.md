# Multi-Timer Time Tracker

A browser-based time tracker with multiple timers that function like a chess clock - only one timer runs at a time, and starting another automatically pauses all others.

## Features

- ⏱️ Multiple timers (default 2, expandable to 20)
- ♟️ Chess-clock behavior (mutual exclusivity - only one timer runs at a time)
- ✏️ Editable timer titles (click to edit)
- ↻ Global reset functionality
- ➕/➖ Dynamic add/remove timers
- 🌐 Static deployment to GitHub Pages
- 🎯 No persistence (session-based tracking)

## Quick Start

### Local Development

1. **Clone the repository**

   ```bash
   git clone https://github.com/aQuigs/timers.git
   cd timers
   ```

2. **Install dependencies**

   ```bash
   npm install
   npx playwright install chromium
   ```

3. **Run tests**

   ```bash
   npm test
   ```

4. **Open in browser**
   - Option A: Double-click `index.html`
   - Option B: Use a local server:

     ```bash
     python3 -m http.server 8000
     # Open http://localhost:8000
     ```

### Usage

1. **Start a timer**: Click the "Start" button on any timer
2. **Switch timers**: Click "Start" on a different timer (previous timer auto-pauses)
3. **Pause a timer**: Click "Pause" on the running timer
4. **Edit title**: Click on the timer title and type a new name
5. **Add timer**: Click "Add Timer" button (max 20 timers)
6. **Remove timer**: Click the "×" button on any timer card (min 1 timer required)
7. **Reset all**: Click "Reset All" to stop and reset all timers to 00:00:00

## Technical Stack

- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Testing**: Web Test Runner with Playwright (Chromium)
- **CI/CD**: GitHub Actions
- **Hosting**: GitHub Pages

## Project Structure

```text
/
├── index.html              # Main application entry point
├── css/
│   └── styles.css          # Application styles
├── js/
│   ├── timer.js            # Timer class (model)
│   ├── timerManager.js     # TimerManager class (orchestration)
│   └── app.js              # DOM manipulation and event handling
├── tests/
│   ├── timer.test.js       # Unit tests for Timer class
│   ├── timerManager.test.js # Unit tests for TimerManager class
│   └── integration.test.js # Integration tests
└── specs/
    └── 001-time-tracker/   # Design documentation
```

## Testing

Run the full test suite:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests in debug mode:

```bash
npm run test:debug
```

## Deployment

The app automatically deploys to GitHub Pages when you push to the `main` branch:

1. Push changes to `main`
2. GitHub Actions runs tests
3. If tests pass, deploys to GitHub Pages
4. Site available at `https://aQuigs.github.io/timers`

## Browser Support

Tested on modern browsers released within the last 2 years:

- Chrome/Chromium
- Firefox
- Safari
- Edge

## Design Decisions

- **No framework**: Intentionally avoiding React/Vue/Angular to keep it simple and lightweight
- **No backend**: Fully client-side application
- **No persistence**: Timer data is session-based only (future enhancement)
- **performance.now()**: Uses high-resolution timing for accuracy (not affected by system clock changes)
- **Mutual exclusivity**: Enforced at the TimerManager level

## License

MIT

## Documentation

For detailed design documents, see:

- [Feature Specification](specs/001-time-tracker/spec.md)
- [Implementation Plan](specs/001-time-tracker/plan.md)
- [Data Model](specs/001-time-tracker/data-model.md)
- [API Contract](specs/001-time-tracker/contracts/timer-api.md)
- [Quickstart Guide](specs/001-time-tracker/quickstart.md)
