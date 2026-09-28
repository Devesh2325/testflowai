# QA Recorder — Autonomous Desktop Regression Platform

A desktop application built with **Electron + TypeScript + Vite + React + Tailwind** that records manual end-to-end test scenarios inside an embedded browser (`WebContentsView`), converts them into robust Playwright tests, and re-runs them automatically on a 6-hour cron schedule to catch regressions.

---

## Architecture & Core Features

### 1. Embedded Browser & Split Shell UI
- **Left Panel:** URL navigation bar (with Back, Forward, Reload, and URL input) + embedded browser view (`WebContentsView`).
- **Right Panel:** Scenario name input, "Start Recording" / "Stop & Save Scenario" buttons, and live stream of captured user interactions.

### 2. Event Capture & Content Script Injection
- **Events Recorded:** Clicks, double-clicks, input/change (with 400ms typing debounce, automatic password field masking), selects, checkboxes/radios (`check`/`uncheck`), key presses (`Enter`, `Tab`, `Escape`), file uploads, and navigation.
- **Selector Strategy (Strict Priority Order):**
  1. `data-testid` (`page.getByTestId(...)`)
  2. `getByRole(role, { name })`
  3. `getByLabel(...)`
  4. `getByPlaceholder(...)`
  5. `getByText(...)`
  6. Stable CSS (`#id`, unique classes, unique attributes)
- **Multi-Locator Fallback Resilience:** Every step computes a primary selector plus 2–3 fallback selectors to guard against future UI selector drift.

### 3. In-Page Assertion Context Menu
- Right-click any element inside the embedded browser during recording to display the floating assertion menu:
  - 👁️ **Assert visible**
  - 📝 **Assert text equals**
  - 🔗 **Assert URL contains**
  - 🔢 **Assert element count**
- Automatically records a URL assertion step following every page navigation.

### 4. Known Baseline Noise Tracking
- Intercepts pre-existing runtime console errors (`level >= error`), failed network requests (`HTTP 4xx/5xx`), and unhandled page load errors.
- Stored as known baseline noise with the recorded scenario so subsequent automated replays can distinguish new regressions from pre-existing site noise.

### 5. Step Editing
- Rename step descriptions.
- Reorder steps with Up/Down buttons.
- Delete redundant steps.
- Edit action types, selectors, and arguments in a dedicated modal.

---

## Project Structure

```text
qa-recorder/
├── db/                       # SQLite database storage (qa_recorder.sqlite)
├── runs/                     # Test execution artifacts (screenshots, traces, videos)
├── scenarios/                # Generated Playwright spec files (.spec.ts and .json)
├── scripts/                  # Development and launch scripts (dev.mjs)
├── src/
│   ├── main/                 # Electron Main Process
│   │   ├── index.ts          # Shell window, WebContentsView layout, IPC handlers
│   │   ├── recorder.ts       # Recording session state machine & noise interceptor
│   │   ├── db.ts             # SQLite schema & database manager (better-sqlite3)
│   │   ├── scheduler.ts      # node-cron scheduler (Milestone 4)
│   │   └── types.ts          # Core TypeScript data contracts
│   ├── preload/              # Preload Scripts
│   │   ├── index.ts          # ContextBridge API for React UI
│   │   └── recorder-injected.ts # Injected in-page event & assertion listener
│   ├── renderer/             # React Shell UI (Vite + Tailwind)
│   │   ├── index.html        # HTML entry point
│   │   └── src/
│   │       ├── App.tsx       # Main UI layout & IPC subscriptions
│   │       ├── components/   # UrlBar, RecordingPanel, StepItem, StepEditModal, etc.
│   │       └── index.css     # Dark-mode styling and Tailwind directives
│   └── runner/               # Playwright child process runner (Milestone 2)
├── package.json              # Project dependencies & build scripts
├── tailwind.config.js        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration for renderer
├── tsconfig.main.json        # TypeScript configuration for main process
├── tsconfig.preload.json     # TypeScript configuration for preload scripts
└── vite.config.ts            # Vite bundler configuration
```

---

## Setup & Running

### Prerequisites
- Node.js 18+ (tested on Node.js v20.19.0)
- npm 9+

### 1. Install Dependencies
```bash
cd qa-recorder
npm install
```

### 2. Run in Development Mode
```bash
npm run dev
```
This builds the Electron main & preload TypeScript scripts, launches the Vite dev server on `http://localhost:5173`, and opens the Electron desktop application.

### 3. Production Build & Packaging (electron-builder)
To compile all assets and package a standalone Windows installer/executable:
```bash
# Compile TypeScript main/preload and bundle Vite React renderer
npm run build

# Package unpacked directory
npm run pack

# Build production NSIS installer (in /release directory)
npm run dist
```

---

## Milestone 1 Status & Test Verification

### What Works
- ✅ **Embedded Browser Integration (`WebContentsView`):** Loads target websites in a sandboxed, responsive left-hand pane that auto-resizes with window dimensions.
- ✅ **URL Navigation Bar:** Back, Forward, Reload, and URL input dispatching real navigations to the embedded browser.
- ✅ **Real-Time Step Recording:** Captures clicks, double-clicks, input typing (debounced & password-masked), select dropdowns, checkbox toggling, and keypresses (`Enter`, `Tab`, `Escape`).
- ✅ **Prioritized Selector Strategy:** Evaluates `data-testid` ➔ `getByRole` ➔ `getByLabel` ➔ `getByPlaceholder` ➔ `getByText` ➔ stable CSS, saving 2–3 fallback selectors per step.
- ✅ **Right-Click Assertion Menu:** Injected context menu enabling instant assertions (`toBeVisible`, `toHaveText`, `toHaveURL`, `toHaveCount`).
- ✅ **Automatic URL Assertions:** Auto-adds URL validation after every page navigation.
- ✅ **Known Baseline Noise Tracker:** Records pre-existing console errors and HTTP 4xx/5xx requests with interactive modal review.
- ✅ **Interactive Step Editor:** Delete, reorder (Move Up/Down), and inline edit step descriptions, action types, selectors, and values.
- ✅ **SQLite Persistence:** Automatically saves recorded scenarios to `db/qa_recorder.sqlite` upon clicking "Stop & Save Scenario".

### What's Broken / Not Yet Built (Planned for Milestones 2–4)
- Replay runner (`@playwright/test` child process runner) ➔ *Milestone 2*
- Playwright `.spec.ts` code generation to disk ➔ *Milestone 2*
- Run artifacts (video, trace.zip, DOM diffs) & Dashboard ➔ *Milestone 3*
- node-cron 6-hour scheduler, tray icon, and GitHub Actions CI export ➔ *Milestone 4*

### Known Limits
- Very complex cross-origin iframes on certain banking or recaptcha domains may restrict content script event injection unless iframe sandboxing is explicitly relaxed.
