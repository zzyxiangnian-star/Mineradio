# Windows Shell Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Windows tray and taskbar shell integration that mirrors Mineradio playback state and dispatches shell commands back to the existing player.

**Architecture:** Keep player logic in `public/index.html`; add a narrow shell bridge through `src/desktop/preload.js`, `src/desktop/main.js`, and a new `public/tray-menu.html`. The main process owns shell state, tray-menu positioning, thumbar buttons, and command dispatch.

**Tech Stack:** Electron `BrowserWindow`, `Tray`, `ipcMain`, `ipcRenderer`, Windows `setThumbarButtons`, existing vanilla HTML/CSS/JS.

## Global Constraints

- Do not rewrite playback, queue, like, lyrics, or wallpaper core logic.
- Non-Windows platforms must keep natural fallback behavior.
- Do not add native addons or C++ extensions.
- `public/tray-menu.html` must be included by the existing `public/**/*` packaging rule.

---

### Task 1: Shell IPC Bridge Contract

**Files:**
- Modify: `test-ai-modules.js`
- Modify: `src/desktop/preload.js`

**Interfaces:**
- Produces: `window.desktopWindow.updateShellState(payload)`, `window.desktopWindow.onShellCommand(callback)`, `window.desktopWindow.notifyShellCommandResult(payload)`.
- Consumes: main-process IPC channels `mineradio-shell-state-update`, `mineradio-shell-command`, `mineradio-shell-command-result`.

- [ ] **Step 1: Write the failing test**

Add assertions in `testMissAiDjEnhancementContract()`:

```js
assert.match(preload, /updateShellState:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('mineradio-shell-state-update'/);
assert.match(preload, /onShellCommand:\s*\(callback\)\s*=>/);
assert.match(preload, /mineradio-shell-command/);
assert.match(preload, /notifyShellCommandResult:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('mineradio-shell-command-result'/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test-ai-modules.js`

Expected: FAIL because `updateShellState` is not present.

- [ ] **Step 3: Write minimal implementation**

Expose the three functions from `src/desktop/preload.js` under `desktopWindow`, validating callback type and returning an unsubscribe function for command events.

- [ ] **Step 4: Run test to verify it passes**

Run: `node test-ai-modules.js`

Expected: PASS for the new preload contract.

---

### Task 2: Main Process Shell State, Commands, Tray Menu Window, and Thumbar

**Files:**
- Modify: `test-ai-modules.js`
- Modify: `src/desktop/main.js`

**Interfaces:**
- Consumes: `mineradio-shell-state-update`, `mineradio-shell-command-result`, and commands from `public/tray-menu.html`.
- Produces: `desktopShellState`, `dispatchShellCommand(command, payload)`, `createTrayMenuWindow()`, `showTrayMenuWindow()`, `updateWindowsThumbarButtons()`.

- [ ] **Step 1: Write the failing test**

Add assertions in `testMissAiDjEnhancementContract()`:

```js
assert.match(main, /let desktopShellState =/);
assert.match(main, /let trayMenuWindow = null/);
assert.match(main, /function normalizeDesktopShellState/);
assert.match(main, /function updateDesktopShellState/);
assert.match(main, /function dispatchShellCommand/);
assert.match(main, /function createTrayMenuWindow/);
assert.match(main, /function showTrayMenuWindow/);
assert.match(main, /function positionTrayMenuWindow/);
assert.match(main, /function updateWindowsThumbarButtons/);
assert.match(main, /setThumbarButtons/);
assert.match(main, /mineradio-shell-state-update/);
assert.match(main, /mineradio-tray-menu-command/);
assert.match(main, /tray-menu\.html/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test-ai-modules.js`

Expected: FAIL because `desktopShellState` is not present.

- [ ] **Step 3: Write minimal implementation**

In `src/desktop/main.js`, add:

- shell state normalization with `title`, `artist`, `cover`, `playing`, `liked`, `playMode`, `desktopLyrics`, `wallpaperMode`, `hasTrack`, `updatedAt`;
- command dispatch for `prev`, `togglePlay`, `next`, `toggleLike`, `setPlayMode`, `showMain`, `toggleWallpaper`, `toggleDesktopLyrics`, `settings`, `quit`;
- IPC handlers for state update and tray-menu commands;
- tray-menu `BrowserWindow` creation, loading `public/tray-menu.html`, positioning against `tray.getBounds()` and the display work area;
- native thumbar buttons on Windows with previous/play-next.

- [ ] **Step 4: Run test to verify it passes**

Run: `node test-ai-modules.js`

Expected: PASS for main-process shell contracts.

---

### Task 3: Custom Tray Menu UI

**Files:**
- Modify: `test-ai-modules.js`
- Create: `public/tray-menu.html`

**Interfaces:**
- Consumes: `window.trayMenu.onState(callback)` and `window.trayMenu.command(command, payload)` exposed from the main-process preload-less menu page.
- Produces: a white rounded tray menu with current track, controls, play-mode submenu, wallpaper/lyrics/settings/quit actions.

- [ ] **Step 1: Write the failing test**

Add assertions:

```js
const trayMenu = fs.readFileSync('public/tray-menu.html', 'utf8');
assert.match(trayMenu, /tray-menu-card/);
assert.match(trayMenu, /window\.trayMenu/);
assert.match(trayMenu, /data-command="togglePlay"/);
assert.match(trayMenu, /data-command="setPlayMode"/);
assert.match(trayMenu, /data-mode="shuffle"/);
assert.match(trayMenu, /data-command="toggleWallpaper"/);
assert.match(trayMenu, /data-command="toggleDesktopLyrics"/);
assert.match(trayMenu, /data-command="quit"/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test-ai-modules.js`

Expected: FAIL because `public/tray-menu.html` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `public/tray-menu.html` with inline CSS and JS. Use `contextIsolation: false` for this internal menu window so the page can receive `window.trayMenu` injected by main process.

- [ ] **Step 4: Run test to verify it passes**

Run: `node test-ai-modules.js`

Expected: PASS for tray-menu UI contract.

---

### Task 4: Renderer Shell State and Command Mapping

**Files:**
- Modify: `test-ai-modules.js`
- Modify: `public/index.html`

**Interfaces:**
- Consumes: `window.desktopWindow.updateShellState`, `window.desktopWindow.onShellCommand`, existing `prevTrack()`, `togglePlay()`, `nextTrack()`, `toggleLikeCurrent()`, `updatePlayModeButton(true)`, `toggleFx()`.
- Produces: `buildDesktopShellState()`, `scheduleDesktopShellStatePush(force)`, `handleDesktopShellCommand(payload)`.

- [ ] **Step 1: Write the failing test**

Add assertions in `testMissAiDjEnhancementContract()`:

```js
assert.match(html, /function buildDesktopShellState/);
assert.match(html, /function scheduleDesktopShellStatePush/);
assert.match(html, /function pushDesktopShellState/);
assert.match(html, /function handleDesktopShellCommand/);
assert.match(html, /updateShellState/);
assert.match(html, /onShellCommand/);
assert.match(html, /case 'setPlayMode'/);
assert.match(html, /toggleFx\('wallpaperMode'\)/);
assert.match(html, /toggleFx\('desktopLyrics'\)/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test-ai-modules.js`

Expected: FAIL because `buildDesktopShellState` is not present.

- [ ] **Step 3: Write minimal implementation**

Add shell state helpers near the existing desktop overlay helpers. Push state on load, play/pause/song changes, like changes, play-mode changes, wallpaper changes, and desktop-lyrics changes. Register command listener once during desktop runtime initialization.

- [ ] **Step 4: Run test to verify it passes**

Run: `node test-ai-modules.js`

Expected: PASS.

---

### Task 5: Final Verification

**Files:**
- Verify: all files above

- [ ] **Step 1: Run contract tests**

Run: `node test-ai-modules.js`

Expected: `AI helper module tests passed`

- [ ] **Step 2: Run whitespace check**

Run: `git diff --check`

Expected: exit code 0; CRLF warnings are acceptable in this repository.

- [ ] **Step 3: Launch app for manual smoke**

Run:

```powershell
$env:MINERADIO_ALLOW_MULTI_INSTANCE='1'
Start-Process -FilePath 'D:\Mineradio\node_modules\electron\dist\electron.exe' -ArgumentList '.' -WorkingDirectory 'D:\Mineradio\.worktrees\album-honeycomb-home'
```

Expected: Mineradio opens without main-process crash.
