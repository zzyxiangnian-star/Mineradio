# Shell, Honeycomb, and DeepSeek Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the tray exit action visible, show the current album in the Windows taskbar preview with real transport icons, stop click-to-play from moving the honeycomb, and make DeepSeek configuration work automatically.

**Architecture:** Extend the existing renderer-to-main-process shell state with a safe thumbnail crop rectangle, and keep all Windows behavior in `src/desktop/main.js`. Decouple honeycomb playback from centering in `public/home-vinyl.js`. Add provider-aware normalization to the existing AI config/client modules without changing stored API keys.

**Tech Stack:** Electron 33, Windows Thumbar/thumbnail APIs, vanilla HTML/CSS/JS, Node.js built-in test assertions.

## Global Constraints

- Do not rewrite playback, queue, drag inertia, or AI recommendation logic.
- Do not introduce native addons or new dependencies.
- Preserve valid user API keys.
- Non-Windows platforms keep existing behavior.
- Use TDD: every production change follows an observed failing test.

---

### Task 1: Tray Exit Visibility

**Files:**
- Modify: `test-ai-modules.js`
- Modify: `public/tray-menu.html`
- Modify: `src/desktop/main.js`

**Interfaces:**
- Consumes: existing `data-command="quit"` IPC action.
- Produces: `.tray-footer` fixed footer and a tray window sized to `TRAY_MENU_HEIGHT` with work-area clamping.

- [ ] **Step 1: Write the failing contract test**

Assert that `tray-menu.html` contains `.tray-footer`, that the quit button is inside it, that `.items` can scroll, and that `main.js` defines `TRAY_MENU_HEIGHT` greater than 420.

- [ ] **Step 2: Run the test and verify RED**

Run: `node test-ai-modules.js`
Expected: failure because `.tray-footer` and `TRAY_MENU_HEIGHT` do not exist.

- [ ] **Step 3: Implement the minimal layout fix**

Make the card a full-height flex column, make `.items` the scrollable region, move the separator and quit action into `.tray-footer`, and use shared width/height constants in the main process when positioning the menu.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node test-ai-modules.js`
Expected: `AI helper module tests passed`.

---

### Task 2: Windows Album Thumbnail and Transport Icons

**Files:**
- Modify: `test-ai-modules.js`
- Modify: `public/index.html`
- Modify: `src/desktop/main.js`

**Interfaces:**
- Produces: `currentDesktopThumbnailClip(): {x,y,width,height}|null` in the renderer.
- Extends: `desktopShellState.thumbnailClip`.
- Produces: `updateWindowsThumbnailPreview()` and `createThumbarIcon(kind, active)` in the main process.

- [ ] **Step 1: Write failing contract tests**

Assert that renderer shell state contains `thumbnailClip: currentDesktopThumbnailClip()`, main state normalizes `thumbnailClip`, Windows code calls `setThumbnailClip`, and Thumbar buttons call distinct `createThumbarIcon('prev')`, `createThumbarIcon(playing ? 'pause' : 'play')`, and `createThumbarIcon('next')` paths rather than reusing `APP_ICON_ICO`.

- [ ] **Step 2: Run the test and verify RED**

Run: `node test-ai-modules.js`
Expected: failure because thumbnail crop and icon helpers are absent.

- [ ] **Step 3: Implement renderer crop reporting**

Find `.home-vinyl-disc.is-playing`, read its viewport-relative rectangle, reject zero-sized/offscreen rectangles, clamp values to the viewport, and include the rounded rectangle in shell state. Add resize-driven shell state refresh so the crop remains valid after window changes.

- [ ] **Step 4: Implement main-process thumbnail and icons**

Normalize positive finite crop rectangles, call `mainWindow.setThumbnailClip(rect)` and `setThumbnailToolTip(currentShellTitle())` on Windows, reset to `{x:0,y:0,width:0,height:0}` when no cover rectangle is available, and create transparent SVG-based NativeImages for previous/play/pause/next.

- [ ] **Step 5: Run the test and verify GREEN**

Run: `node test-ai-modules.js`
Expected: `AI helper module tests passed`.

---

### Task 3: Click-to-Play Without Honeycomb Movement

**Files:**
- Modify: `test-ai-modules.js`
- Modify: `public/home-vinyl.js`

**Interfaces:**
- Consumes: existing `playIndex(index)`.
- Produces: click and pointer-up paths that call `playIndex(index)` directly; `syncTrack()` only updates playback state.

- [ ] **Step 1: Write failing source-contract tests**

Assert that the disc click handler calls `playIndex(index)`, pointer-up calls `playIndex(clickIndex)`, and `syncTrack()` contains no `selectIndex` call.

- [ ] **Step 2: Run the test and verify RED**

Run: `node test-ai-modules.js`
Expected: failure because both click paths and `syncTrack()` currently center the disc.

- [ ] **Step 3: Implement the minimal interaction change**

Replace click/pointer-up centering calls with direct playback, set `selectedIndex` only for internal state, and make `syncTrack()` update `playingIndex` plus `scheduleRender()` without changing offsets. Keep drag settle and inertia unchanged.

- [ ] **Step 4: Run the test and verify GREEN**

Run: `node test-ai-modules.js`
Expected: `AI helper module tests passed`.

---

### Task 4: DeepSeek Provider Compatibility

**Files:**
- Modify: `test-ai-modules.js`
- Modify: `src/lib/ai/configStore.js`
- Modify: `src/lib/ai/mimoClient.js`

**Interfaces:**
- Produces: `detectAiProvider(baseUrl): 'deepseek'|'mimo'|'openai-compatible'`.
- Produces: provider-aware resolved config with DeepSeek Bearer auth and `deepseek-v4-pro` fallback model.
- Produces: `buildChatRequestBody(config, messages, options)` using `max_tokens` for DeepSeek and preserving the MiMo request contract.

- [ ] **Step 1: Write failing behavior tests**

Test `resolveAiConfig()` with `https://api.deepseek.com`, a MiMo model, and `api-key`; expect `deepseek-v4-pro` and `bearer`. Test an explicitly supplied DeepSeek model remains unchanged. Capture fetch calls and verify DeepSeek sends `Authorization: Bearer`, `max_tokens`, and no `max_completion_tokens`, while MiMo still sends `api-key` and `max_completion_tokens`.

- [ ] **Step 2: Run the test and verify RED**

Run: `node test-ai-modules.js`
Expected: DeepSeek assertions fail against the current MiMo-only normalization.

- [ ] **Step 3: Implement provider-aware config normalization**

Detect DeepSeek by hostname, normalize its auth method to Bearer, replace only empty/MiMo default models with `deepseek-v4-pro`, preserve explicit model names, and export the provider detector.

- [ ] **Step 4: Implement provider-aware request bodies**

Use `max_tokens` for DeepSeek and `max_completion_tokens` for MiMo; keep messages, stream, temperature, top-p, and explicit disabled thinking behavior compatible with the selected provider.

- [ ] **Step 5: Run the test and verify GREEN**

Run: `node test-ai-modules.js`
Expected: `AI helper module tests passed` with both provider paths verified.

---

### Task 5: Final Verification and Windows Smoke Test

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run static verification**

Run: `node --check public/home-vinyl.js`, `node --check src/lib/ai/configStore.js`, `node --check src/lib/ai/mimoClient.js`, `node --check src/desktop/main.js`, and `git diff --check`.
Expected: all commands exit 0; repository line-ending warnings are acceptable.

- [ ] **Step 2: Run the complete module suite**

Run: `node test-ai-modules.js`
Expected: `AI helper module tests passed`.

- [ ] **Step 3: Launch the worktree with the root Electron runtime**

Run the root `electron.exe` with the worktree as its project directory and `MINERADIO_ALLOW_MULTI_INSTANCE=1`.
Expected: Mineradio opens without a main-process exception.

- [ ] **Step 4: Perform manual Windows checks**

Verify the tray menu shows Exit, taskbar hover shows the currently playing honeycomb cover and correct transport icons, clicking a honeycomb disc starts playback without changing its screen position, and the saved DeepSeek configuration passes the connection test.
