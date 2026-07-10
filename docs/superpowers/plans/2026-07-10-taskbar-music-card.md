# Windows Taskbar Music Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Mineradio's Windows taskbar window screenshot with a DWM-provided music card that shows the real app logo, song title, artist and album artwork while retaining native previous, play/pause and next controls.

**Architecture:** A browser-safe renderer module draws a 640×768 card from the existing player state and sends PNG frames through a narrow IPC bridge. The Electron main process converts each frame to BGRA and passes it to a Windows-only N-API module that subclasses the main HWND and responds to DWM iconic-thumbnail messages. Existing Thumbar buttons remain the only interactive taskbar controls, and every native failure falls back to the normal system thumbnail without affecting playback.

**Tech Stack:** Electron 33.2, vanilla browser JavaScript and Canvas 2D, Node test runner, N-API via `node-addon-api`, Win32 DWM/GDI/Common Controls, electron-builder 25.

## Global Constraints

- Do not modify the audio playback core, decoder, playlist core, queue algorithms or audio management logic.
- Do not use a video frame, WebGL canvas, player-window screenshot or `webContents.capturePage()` as card artwork.
- Album artwork must come from the active song metadata or its existing custom-cover override.
- Windows-only native failures must never block application startup or playback.
- Chrome validates Renderer behavior; an actual Electron Windows session validates DWM and Thumbar behavior.
- Do not commit implementation changes until Chrome Renderer tests, Electron Windows tests and package verification all pass.
- Preserve all unrelated dirty-worktree changes already present in `D:\Mineradio`.

## File Map

- Create `public/taskbar-card-renderer.js`: browser-safe state-to-canvas renderer, image loading, stale-cover protection and transition frames.
- Create `src/desktop/taskbarThumbnailBridge.js`: Windows-only native-loader facade, bitmap validation, attach/update/detach lifecycle and one-time fallback logging.
- Create `native/taskbar-thumbnail/package.json`: local native package metadata.
- Create `native/taskbar-thumbnail/binding.gyp`: N-API build and Win32 library configuration.
- Create `native/taskbar-thumbnail/index.js`: load the compiled `.node` binary.
- Create `native/taskbar-thumbnail/src/addon.cc`: HWND subclass and DWM bitmap implementation.
- Modify `public/index.html`: load the renderer, remove the invisible fake card, publish real state and bitmap frames, and add an opt-in Chrome debug preview.
- Modify `src/desktop/preload.js`: expose one bounded bitmap-update method.
- Modify `src/desktop/main.js`: connect IPC, native lifecycle, DWM refresh and pure-Electron fallback.
- Modify `src/desktop/taskbarPreview.js`: add pure validation/key helpers without duplicating player state.
- Modify `package.json` and `package-lock.json`: add native build dependencies/scripts and packaging rules.
- Create/modify `test/taskbar-card-renderer.test.js`, `test/taskbar-thumbnail-bridge.test.js`, and `test/taskbar-preview.test.js`.

---

### Task 1: Lock the shell-state and bitmap contracts

**Files:**
- Modify: `src/desktop/taskbarPreview.js`
- Modify: `test/taskbar-preview.test.js`

**Interfaces:**
- Consumes: current `normalizeTaskbarPreviewState(payload)`.
- Produces: `taskbarPreviewStateKey(state)` and `validateTaskbarBitmapPayload(payload, limits)`.

- [ ] **Step 1: Write failing contract tests**

Append these tests:

```js
const {
  taskbarPreviewStateKey,
  validateTaskbarBitmapPayload,
} = require('../src/desktop/taskbarPreview');

test('keys every field that changes the taskbar card', () => {
  const base = normalizeTaskbarPreviewState({
    title: 'Song A', artist: 'Artist A', cover: 'a.jpg', playing: false,
    hasTrack: true, queueLength: 2,
  });
  assert.notEqual(taskbarPreviewStateKey(base), taskbarPreviewStateKey({ ...base, playing: true }));
  assert.notEqual(taskbarPreviewStateKey(base), taskbarPreviewStateKey({ ...base, cover: 'b.jpg' }));
});

test('accepts a bounded PNG data URL payload', () => {
  const payload = validateTaskbarBitmapPayload({
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 640, height: 768,
  });
  assert.deepEqual(payload, {
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=', width: 640, height: 768,
  });
});

test('rejects malformed or oversized taskbar bitmaps', () => {
  assert.throws(() => validateTaskbarBitmapPayload({ dataUrl: 'https://x/a.png', width: 640, height: 768 }), /PNG data URL/);
  assert.throws(() => validateTaskbarBitmapPayload({ dataUrl: 'data:image/png;base64,AA==', width: 4097, height: 768 }), /dimensions/);
});
```

- [ ] **Step 2: Run the tests and confirm the new contract is absent**

Run:

```powershell
node --test test/taskbar-preview.test.js
```

Expected: FAIL because `taskbarPreviewStateKey` and `validateTaskbarBitmapPayload` are not exported.

- [ ] **Step 3: Implement the pure helpers**

Add before `module.exports`:

```js
function taskbarPreviewStateKey(state) {
  const value = normalizeTaskbarPreviewState(state);
  return [value.title, value.artist, value.cover, value.playing ? 1 : 0,
    value.hasTrack ? 1 : 0, value.queueLength].join('|');
}

function validateTaskbarBitmapPayload(payload, limits = {}) {
  const value = payload || {};
  const width = Math.floor(Number(value.width) || 0);
  const height = Math.floor(Number(value.height) || 0);
  const maxDimension = Math.floor(Number(limits.maxDimension) || 4096);
  const maxDataUrlLength = Math.floor(Number(limits.maxDataUrlLength) || 6 * 1024 * 1024);
  const dataUrl = String(value.dataUrl || '');
  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
    throw new TypeError('Taskbar bitmap must be a PNG data URL');
  }
  if (width < 1 || height < 1 || width > maxDimension || height > maxDimension) {
    throw new RangeError('Taskbar bitmap dimensions are invalid');
  }
  if (dataUrl.length > maxDataUrlLength) {
    throw new RangeError('Taskbar bitmap payload is too large');
  }
  return { dataUrl, width, height };
}
```

Export both functions.

- [ ] **Step 4: Run the contract tests**

Run:

```powershell
node --test test/taskbar-preview.test.js
```

Expected: all tests PASS.

- [ ] **Step 5: Record a no-commit checkpoint**

Run `git diff --check -- src/desktop/taskbarPreview.js test/taskbar-preview.test.js`. Do not commit; the global test gate is not yet satisfied.

---

### Task 2: Build the browser-safe card renderer

**Files:**
- Create: `public/taskbar-card-renderer.js`
- Create: `test/taskbar-card-renderer.test.js`

**Interfaces:**
- Consumes: `{ title, artist, cover, playing, hasTrack }`, a same-origin cover URL mapper and `emitFrame(frame)`.
- Produces: `createTaskbarCardRenderer(options)` with `render(state)` and `destroy()`; exports pure `fitText`, `taskbarCoverRequestSrc`, and `cardVisualKey` for tests.

- [ ] **Step 1: Write failing renderer-helper tests**

Create `test/taskbar-card-renderer.test.js`:

```js
const assert = require('node:assert/strict');
const test = require('node:test');
const {
  fitText,
  taskbarCoverRequestSrc,
  cardVisualKey,
} = require('../public/taskbar-card-renderer');

test('fits long labels with one ellipsis', () => {
  const ctx = { measureText: text => ({ width: String(text).length * 10 }) };
  assert.equal(fitText(ctx, 'ABCDEFGHIJ', 58), 'ABCD…');
  assert.equal(fitText(ctx, 'ABC', 58), 'ABC');
});

test('maps remote covers through the same-origin cover proxy', () => {
  assert.equal(
    taskbarCoverRequestSrc('https://img.test/cover.jpg?param=640y640'),
    '/api/cover?url=' + encodeURIComponent('https://img.test/cover.jpg?param=640y640'),
  );
  assert.equal(taskbarCoverRequestSrc('data:image/png;base64,AA=='), 'data:image/png;base64,AA==');
  assert.equal(taskbarCoverRequestSrc('blob:https://app.test/id'), 'blob:https://app.test/id');
});

test('changes the visual key for track and playback changes', () => {
  const base = { title: 'A', artist: 'B', cover: 'a.jpg', playing: false, hasTrack: true };
  assert.notEqual(cardVisualKey(base), cardVisualKey({ ...base, playing: true }));
  assert.notEqual(cardVisualKey(base), cardVisualKey({ ...base, title: 'C' }));
});
```

- [ ] **Step 2: Run the helper tests and confirm the module is absent**

Run `node --test test/taskbar-card-renderer.test.js`.

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the UMD module and pure helpers**

Create the module with this public wrapper and exact constants:

```js
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MineradioTaskbarCard = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const CARD_WIDTH = 640;
  const CARD_HEIGHT = 768;
  const TRANSITION_STEPS = 6;
  const TRANSITION_MS = 180;

  function clean(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function cardVisualKey(state) {
    const s = state || {};
    return [clean(s.title), clean(s.artist), clean(s.cover), s.playing ? 1 : 0, s.hasTrack ? 1 : 0].join('|');
  }
  function fitText(ctx, text, maxWidth) {
    const value = clean(text);
    if (ctx.measureText(value).width <= maxWidth) return value;
    let low = 0, high = value.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (ctx.measureText(value.slice(0, mid) + '…').width <= maxWidth) low = mid;
      else high = mid - 1;
    }
    return value.slice(0, low) + '…';
  }
  function taskbarCoverRequestSrc(src) {
    const value = clean(src);
    if (/^(data:|blob:)/i.test(value)) return value;
    return /^https?:\/\//i.test(value) ? '/api/cover?url=' + encodeURIComponent(value) : value;
  }
```

In the same factory add these internal functions:

```js
const palette = { background: '#f5f6f7', text: '#181b20', muted: '#747b86', control: '#e7e9ec' };

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadImage(src) {
  return new Promise(function(resolve, reject) {
    if (!src) { reject(new Error('image source is empty')); return; }
    const image = new Image();
    image.decoding = 'async';
    image.onload = function() { resolve(image); };
    image.onerror = function() { reject(new Error('image load failed')); };
    image.src = src;
  });
}

function drawCroppedImage(ctx, image, x, y, size, radius, alpha) {
  if (!image) return;
  const width = image.naturalWidth || image.width || 1;
  const height = image.naturalHeight || image.height || 1;
  const crop = Math.min(width, height);
  ctx.save();
  roundedRect(ctx, x, y, size, size, radius);
  ctx.clip();
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(image, (width - crop) / 2, (height - crop) / 2, crop, crop, x, y, size, size);
  ctx.restore();
}

function drawPlaceholder(ctx, x, y, size) {
  ctx.save();
  roundedRect(ctx, x, y, size, size, 24);
  ctx.fillStyle = '#e3e6ea';
  ctx.fill();
  ctx.fillStyle = '#9aa1ab';
  ctx.font = '600 112px "Segoe UI Symbol"';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('♪', x + size / 2, y + size / 2 - 4);
  ctx.restore();
}

function drawCard(ctx, state, images, coverMix) {
  ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
  ctx.save();
  roundedRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 28);
  ctx.fillStyle = palette.background;
  ctx.fill();
  ctx.restore();
  if (images.logo) drawCroppedImage(ctx, images.logo, 42, 34, 56, 12, 1);
  ctx.fillStyle = palette.text;
  ctx.font = '600 28px "Segoe UI"';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(fitText(ctx, state.title || 'Mineradio', 458), 122, 64);
  ctx.fillStyle = palette.muted;
  ctx.font = '400 20px "Segoe UI"';
  ctx.fillText(fitText(ctx, state.artist || (state.hasTrack ? '未知歌手' : '音乐播放器'), 458), 122, 94);
  ctx.save();
  ctx.shadowColor = 'rgba(20,24,32,.22)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 14;
  roundedRect(ctx, 96, 138, 448, 448, 24);
  ctx.fillStyle = '#e3e6ea';
  ctx.fill();
  ctx.restore();
  if (!images.previousCover && !images.nextCover) drawPlaceholder(ctx, 96, 138, 448);
  if (images.previousCover) drawCroppedImage(ctx, images.previousCover, 96, 138, 448, 24, 1 - coverMix);
  if (images.nextCover) drawCroppedImage(ctx, images.nextCover, 96, 138, 448, 24, coverMix);
  ctx.fillStyle = palette.control;
  roundedRect(ctx, 214, 654, 212, 4, 2);
  ctx.fill();
}
```

The remaining lower area stays visually quiet because native Thumbar buttons are rendered by Windows directly below the bitmap.

Implement `createTaskbarCardRenderer` so it:

```js
function createTaskbarCardRenderer(options) {
  const opts = options || {};
  const canvas = opts.canvas || document.createElement('canvas');
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext('2d', { alpha: true });
  const emitFrame = typeof opts.emitFrame === 'function' ? opts.emitFrame : function() {};
  let serial = 0;
  let destroyed = false;
  let currentCover = null;
  let logoPromise = loadImage(opts.logoUrl || '/assets/taskbar-logo.png').catch(() => null);

  async function render(rawState) {
    const state = {
      title: clean(rawState && rawState.title) || 'Mineradio',
      artist: clean(rawState && rawState.artist),
      cover: clean(rawState && rawState.cover),
      playing: !!(rawState && rawState.playing),
      hasTrack: !!(rawState && rawState.hasTrack),
    };
    const token = ++serial;
    const logo = await logoPromise;
    if (destroyed || token !== serial) return;
    drawCard(ctx, state, { logo, previousCover: currentCover, nextCover: null }, 0);
    emitFrame({ dataUrl: canvas.toDataURL('image/png'), width: CARD_WIDTH, height: CARD_HEIGHT, final: !state.cover });
    if (!state.cover) return;
    const nextCover = await loadImage(taskbarCoverRequestSrc(state.cover)).catch(() => null);
    if (destroyed || token !== serial) return;
    if (!nextCover) {
      currentCover = null;
      drawCard(ctx, state, { logo, previousCover: null, nextCover: null }, 1);
      emitFrame({ dataUrl: canvas.toDataURL('image/png'), width: CARD_WIDTH, height: CARD_HEIGHT, final: true });
      return;
    }
    for (let step = 1; step <= TRANSITION_STEPS; step++) {
      if (destroyed || token !== serial) return;
      drawCard(ctx, state, { logo, previousCover: currentCover, nextCover }, step / TRANSITION_STEPS);
      emitFrame({ dataUrl: canvas.toDataURL('image/png'), width: CARD_WIDTH, height: CARD_HEIGHT, final: step === TRANSITION_STEPS });
      if (step < TRANSITION_STEPS) await new Promise(resolve => setTimeout(resolve, TRANSITION_MS / TRANSITION_STEPS));
    }
    currentCover = nextCover;
  }

  return { canvas, render, destroy() { destroyed = true; serial++; } };
}
```

Return and export `CARD_WIDTH`, `CARD_HEIGHT`, `fitText`, `taskbarCoverRequestSrc`, `cardVisualKey`, and `createTaskbarCardRenderer`; close the UMD wrapper.

- [ ] **Step 4: Add the real PNG logo asset**

Copy the existing tracked `build/icon.png` to `public/assets/taskbar-logo.png` using PowerShell `Copy-Item -LiteralPath build\icon.png -Destination public\assets\taskbar-logo.png`. This is a direct asset copy, not image generation or editing.

- [ ] **Step 5: Run renderer tests**

Run `node --test test/taskbar-card-renderer.test.js`.

Expected: 3 tests PASS.

- [ ] **Step 6: Record a no-commit checkpoint**

Run `git diff --check -- public/taskbar-card-renderer.js test/taskbar-card-renderer.test.js`. Do not commit.

---

### Task 3: Add the Windows bridge facade and fallback tests

**Files:**
- Create: `src/desktop/taskbarThumbnailBridge.js`
- Create: `test/taskbar-thumbnail-bridge.test.js`

**Interfaces:**
- Consumes: an injected native binding with `attach`, `updateBitmap`, `clearBitmap`, and `detach`.
- Produces: `createTaskbarThumbnailBridge(options)` with `available`, `attached`, `attach(hwnd)`, `update(nativeImage)`, `clear()`, and `detach()`.

- [ ] **Step 1: Write failing facade tests**

Create tests using a fake native binding:

```js
const assert = require('node:assert/strict');
const test = require('node:test');
const { createTaskbarThumbnailBridge } = require('../src/desktop/taskbarThumbnailBridge');

test('attaches once and forwards BGRA pixels', () => {
  const calls = [];
  const native = {
    attach: hwnd => { calls.push(['attach', hwnd.length]); return true; },
    updateBitmap: (buffer, width, height) => { calls.push(['update', buffer.length, width, height]); return true; },
    clearBitmap: () => true,
    detach: () => true,
  };
  const bridge = createTaskbarThumbnailBridge({ platform: 'win32', nativeBinding: native });
  assert.equal(bridge.attach(Buffer.alloc(8)), true);
  assert.equal(bridge.attach(Buffer.alloc(8)), true);
  assert.equal(bridge.update({ getSize: () => ({ width: 2, height: 2 }), toBitmap: () => Buffer.alloc(16) }), true);
  assert.deepEqual(calls, [['attach', 8], ['update', 16, 2, 2]]);
});

test('degrades without loading a native module off Windows', () => {
  const bridge = createTaskbarThumbnailBridge({ platform: 'linux' });
  assert.equal(bridge.available, false);
  assert.equal(bridge.attach(Buffer.alloc(8)), false);
});

test('rejects malformed native-image buffers without throwing into playback', () => {
  const bridge = createTaskbarThumbnailBridge({
    platform: 'win32',
    nativeBinding: { attach: () => true, updateBitmap: () => true, clearBitmap: () => true, detach: () => true },
  });
  bridge.attach(Buffer.alloc(8));
  assert.equal(bridge.update({ getSize: () => ({ width: 2, height: 2 }), toBitmap: () => Buffer.alloc(3) }), false);
});
```

- [ ] **Step 2: Run tests and confirm the facade is absent**

Run `node --test test/taskbar-thumbnail-bridge.test.js`.

Expected: FAIL with `MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the facade**

Use this facade implementation:

```js
'use strict';

function createTaskbarThumbnailBridge(options = {}) {
  const platform = options.platform || process.platform;
  const logger = options.logger || console;
  let binding = options.nativeBinding || null;
  let attached = false;
  let warned = false;
  function warnOnce(error) {
    if (warned) return;
    warned = true;
    if (logger && typeof logger.warn === 'function') {
      logger.warn('[TaskbarThumbnail] native bridge unavailable:', error && error.message || error);
    }
  }
  if (platform === 'win32' && !binding) {
    try { binding = require('mineradio-taskbar-thumbnail'); }
    catch (error) { warnOnce(error); }
  }
  function safeCall(name, args) {
    if (!binding || typeof binding[name] !== 'function') return false;
    try { return binding[name](...(args || [])) !== false; }
    catch (error) { warnOnce(error); return false; }
  }
  return {
    get available() { return platform === 'win32' && !!binding; },
    get attached() { return attached; },
    attach(hwnd) {
      if (attached) return true;
      if (platform !== 'win32' || !Buffer.isBuffer(hwnd)) return false;
      attached = safeCall('attach', [hwnd]);
      return attached;
    },
    update(image) {
      if (!attached || !image || typeof image.getSize !== 'function' || typeof image.toBitmap !== 'function') return false;
      try {
        const size = image.getSize();
        const width = Math.floor(Number(size.width) || 0);
        const height = Math.floor(Number(size.height) || 0);
        const bitmap = image.toBitmap();
        if (width < 1 || height < 1 || width > 4096 || height > 4096) return false;
        if (!Buffer.isBuffer(bitmap) || bitmap.length !== width * height * 4) return false;
        return safeCall('updateBitmap', [bitmap, width, height]);
      } catch (error) { warnOnce(error); return false; }
    },
    clear() { return attached ? safeCall('clearBitmap') : true; },
    detach() {
      if (!attached) return true;
      const ok = safeCall('detach');
      attached = false;
      return ok;
    },
  };
}

module.exports = { createTaskbarThumbnailBridge };
```

The exported shape must be:

```js
module.exports = { createTaskbarThumbnailBridge };
```

- [ ] **Step 4: Run facade tests**

Run `node --test test/taskbar-thumbnail-bridge.test.js`.

Expected: 3 tests PASS.

- [ ] **Step 5: Record a no-commit checkpoint**

Run `git diff --check -- src/desktop/taskbarThumbnailBridge.js test/taskbar-thumbnail-bridge.test.js`. Do not commit.

---

### Task 4: Implement the N-API DWM thumbnail module

**Files:**
- Create: `native/taskbar-thumbnail/package.json`
- Create: `native/taskbar-thumbnail/binding.gyp`
- Create: `native/taskbar-thumbnail/index.js`
- Create: `native/taskbar-thumbnail/src/addon.cc`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: HWND bytes from `BrowserWindow.getNativeWindowHandle()` and top-down BGRA pixels from `nativeImage.toBitmap()`.
- Produces: synchronous boolean methods `attach(Buffer)`, `updateBitmap(Buffer, width, height)`, `clearBitmap()`, and `detach()`.

- [ ] **Step 1: Add local native package metadata**

Use this package file:

```json
{
  "name": "mineradio-taskbar-thumbnail",
  "version": "1.0.0",
  "private": true,
  "main": "index.js",
  "gypfile": true,
  "dependencies": { "node-addon-api": "^8.3.1" }
}
```

Use this loader:

```js
'use strict';
module.exports = require('./build/Release/taskbar_thumbnail.node');
```

- [ ] **Step 2: Add the Windows build definition**

Create `binding.gyp`:

```json
{
  "targets": [{
    "target_name": "taskbar_thumbnail",
    "sources": ["src/addon.cc"],
    "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
    "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
    "defines": ["NAPI_DISABLE_CPP_EXCEPTIONS", "UNICODE", "_UNICODE", "_WIN32_WINNT=0x0601"],
    "libraries": ["dwmapi.lib", "comctl32.lib", "gdi32.lib"]
  }]
}
```

- [ ] **Step 3: Implement the complete native lifecycle**

In `addon.cc`, include `napi.h`, `windows.h`, `dwmapi.h`, `commctrl.h`, `vector`, `mutex`, and `algorithm`. Define one process-local state containing HWND, raw BGRA bytes, width, height, attached flag, and a mutex. Use a fixed subclass id such as `0x4D525442`.

Implement:

```cpp
static HBITMAP CreateScaledBitmap(const std::vector<unsigned char>& pixels,
                                  int sourceWidth, int sourceHeight,
                                  int targetWidth, int targetHeight);
static LRESULT CALLBACK ThumbnailSubclassProc(HWND hwnd, UINT message,
                                              WPARAM wParam, LPARAM lParam,
                                              UINT_PTR id, DWORD_PTR data);
static Napi::Value Attach(const Napi::CallbackInfo& info);
static Napi::Value UpdateBitmap(const Napi::CallbackInfo& info);
static Napi::Value ClearBitmap(const Napi::CallbackInfo& info);
static Napi::Value Detach(const Napi::CallbackInfo& info);
```

Use this complete implementation body:

```cpp
#include <napi.h>
#include <windows.h>
#include <dwmapi.h>
#include <commctrl.h>
#include <algorithm>
#include <cstring>
#include <mutex>
#include <vector>

namespace {
constexpr UINT_PTR kSubclassId = 0x4D525442;
struct ThumbnailState {
  HWND hwnd = nullptr;
  std::vector<unsigned char> pixels;
  int width = 0;
  int height = 0;
  bool attached = false;
  std::mutex mutex;
} g_state;

HBITMAP CreateScaledBitmap(const std::vector<unsigned char>& pixels,
                           int sourceWidth, int sourceHeight,
                           int targetWidth, int targetHeight) {
  if (pixels.empty() || sourceWidth < 1 || sourceHeight < 1 ||
      targetWidth < 1 || targetHeight < 1) return nullptr;
  BITMAPINFO destinationInfo{};
  destinationInfo.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  destinationInfo.bmiHeader.biWidth = targetWidth;
  destinationInfo.bmiHeader.biHeight = -targetHeight;
  destinationInfo.bmiHeader.biPlanes = 1;
  destinationInfo.bmiHeader.biBitCount = 32;
  destinationInfo.bmiHeader.biCompression = BI_RGB;
  void* destinationBits = nullptr;
  HDC screen = GetDC(nullptr);
  if (!screen) return nullptr;
  HBITMAP bitmap = CreateDIBSection(screen, &destinationInfo, DIB_RGB_COLORS,
                                    &destinationBits, nullptr, 0);
  HDC memory = CreateCompatibleDC(screen);
  if (!bitmap || !memory || !destinationBits) {
    if (memory) DeleteDC(memory);
    if (bitmap) DeleteObject(bitmap);
    ReleaseDC(nullptr, screen);
    return nullptr;
  }
  HGDIOBJ old = SelectObject(memory, bitmap);
  SetStretchBltMode(memory, HALFTONE);
  SetBrushOrgEx(memory, 0, 0, nullptr);
  BITMAPINFO sourceInfo{};
  sourceInfo.bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  sourceInfo.bmiHeader.biWidth = sourceWidth;
  sourceInfo.bmiHeader.biHeight = -sourceHeight;
  sourceInfo.bmiHeader.biPlanes = 1;
  sourceInfo.bmiHeader.biBitCount = 32;
  sourceInfo.bmiHeader.biCompression = BI_RGB;
  int copied = StretchDIBits(memory, 0, 0, targetWidth, targetHeight,
                             0, 0, sourceWidth, sourceHeight,
                             pixels.data(), &sourceInfo, DIB_RGB_COLORS, SRCCOPY);
  SelectObject(memory, old);
  DeleteDC(memory);
  ReleaseDC(nullptr, screen);
  if (copied == GDI_ERROR) {
    DeleteObject(bitmap);
    return nullptr;
  }
  return bitmap;
}

LRESULT CALLBACK ThumbnailSubclassProc(HWND hwnd, UINT message,
                                       WPARAM wParam, LPARAM lParam,
                                       UINT_PTR id, DWORD_PTR data) {
  if (message == WM_DWMSENDICONICTHUMBNAIL) {
    const int targetWidth = std::max(1, static_cast<int>(HIWORD(lParam)));
    const int targetHeight = std::max(1, static_cast<int>(LOWORD(lParam)));
    std::vector<unsigned char> pixels;
    int width = 0;
    int height = 0;
    {
      std::lock_guard<std::mutex> lock(g_state.mutex);
      pixels = g_state.pixels;
      width = g_state.width;
      height = g_state.height;
    }
    HBITMAP bitmap = CreateScaledBitmap(pixels, width, height, targetWidth, targetHeight);
    if (bitmap) {
      HRESULT result = DwmSetIconicThumbnail(hwnd, bitmap, DWM_SIT_DISPLAYFRAME);
      DeleteObject(bitmap);
      if (SUCCEEDED(result)) return 0;
    }
  } else if (message == WM_NCDESTROY) {
    RemoveWindowSubclass(hwnd, ThumbnailSubclassProc, kSubclassId);
    std::lock_guard<std::mutex> lock(g_state.mutex);
    g_state.hwnd = nullptr;
    g_state.pixels.clear();
    g_state.width = 0;
    g_state.height = 0;
    g_state.attached = false;
  }
  return DefSubclassProc(hwnd, message, wParam, lParam);
}

Napi::Boolean Bool(Napi::Env env, bool value) { return Napi::Boolean::New(env, value); }

Napi::Value Attach(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsBuffer()) return Bool(env, false);
  auto buffer = info[0].As<Napi::Buffer<unsigned char>>();
  if (buffer.Length() < sizeof(HWND)) return Bool(env, false);
  HWND hwnd = nullptr;
  std::memcpy(&hwnd, buffer.Data(), sizeof(HWND));
  if (!IsWindow(hwnd)) return Bool(env, false);
  {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    if (g_state.attached && g_state.hwnd == hwnd) return Bool(env, true);
    if (g_state.attached) return Bool(env, false);
  }
  if (!SetWindowSubclass(hwnd, ThumbnailSubclassProc, kSubclassId, 0)) return Bool(env, false);
  BOOL enabled = TRUE;
  HRESULT force = DwmSetWindowAttribute(hwnd, DWMWA_FORCE_ICONIC_REPRESENTATION,
                                        &enabled, sizeof(enabled));
  HRESULT bitmap = DwmSetWindowAttribute(hwnd, DWMWA_HAS_ICONIC_BITMAP,
                                         &enabled, sizeof(enabled));
  if (FAILED(force) || FAILED(bitmap)) {
    RemoveWindowSubclass(hwnd, ThumbnailSubclassProc, kSubclassId);
    enabled = FALSE;
    DwmSetWindowAttribute(hwnd, DWMWA_FORCE_ICONIC_REPRESENTATION, &enabled, sizeof(enabled));
    DwmSetWindowAttribute(hwnd, DWMWA_HAS_ICONIC_BITMAP, &enabled, sizeof(enabled));
    return Bool(env, false);
  }
  {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    g_state.hwnd = hwnd;
    g_state.attached = true;
  }
  DwmInvalidateIconicBitmaps(hwnd);
  return Bool(env, true);
}

Napi::Value UpdateBitmap(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 3 || !info[0].IsBuffer() ||
      !info[1].IsNumber() || !info[2].IsNumber()) return Bool(env, false);
  auto buffer = info[0].As<Napi::Buffer<unsigned char>>();
  int width = info[1].As<Napi::Number>().Int32Value();
  int height = info[2].As<Napi::Number>().Int32Value();
  if (width < 1 || height < 1 || width > 4096 || height > 4096) return Bool(env, false);
  size_t expected = static_cast<size_t>(width) * static_cast<size_t>(height) * 4u;
  if (buffer.Length() != expected) return Bool(env, false);
  HWND hwnd = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    if (!g_state.attached || !IsWindow(g_state.hwnd)) return Bool(env, false);
    g_state.pixels.assign(buffer.Data(), buffer.Data() + buffer.Length());
    g_state.width = width;
    g_state.height = height;
    hwnd = g_state.hwnd;
  }
  return Bool(env, SUCCEEDED(DwmInvalidateIconicBitmaps(hwnd)));
}

Napi::Value ClearBitmap(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  HWND hwnd = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    g_state.pixels.clear();
    g_state.width = 0;
    g_state.height = 0;
    hwnd = g_state.hwnd;
  }
  if (hwnd && IsWindow(hwnd)) DwmInvalidateIconicBitmaps(hwnd);
  return Bool(env, true);
}

Napi::Value Detach(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  HWND hwnd = nullptr;
  {
    std::lock_guard<std::mutex> lock(g_state.mutex);
    if (!g_state.attached) return Bool(env, true);
    hwnd = g_state.hwnd;
    g_state.hwnd = nullptr;
    g_state.pixels.clear();
    g_state.width = 0;
    g_state.height = 0;
    g_state.attached = false;
  }
  if (hwnd && IsWindow(hwnd)) {
    RemoveWindowSubclass(hwnd, ThumbnailSubclassProc, kSubclassId);
    BOOL disabled = FALSE;
    DwmSetWindowAttribute(hwnd, DWMWA_FORCE_ICONIC_REPRESENTATION, &disabled, sizeof(disabled));
    DwmSetWindowAttribute(hwnd, DWMWA_HAS_ICONIC_BITMAP, &disabled, sizeof(disabled));
    DwmInvalidateIconicBitmaps(hwnd);
  }
  return Bool(env, true);
}
}  // namespace

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("attach", Napi::Function::New(env, Attach));
  exports.Set("updateBitmap", Napi::Function::New(env, UpdateBitmap));
  exports.Set("clearBitmap", Napi::Function::New(env, ClearBitmap));
  exports.Set("detach", Napi::Function::New(env, Detach));
  return exports;
}
NODE_API_MODULE(taskbar_thumbnail, Init)
```

- [ ] **Step 4: Add root dependency and build scripts**

Add root dependencies:

```json
"dependencies": {
  "mineradio-taskbar-thumbnail": "file:native/taskbar-thumbnail"
}
```

Keep existing dependencies and add dev dependency `"@electron/rebuild": "^3.7.2"`. Add scripts:

```json
"test": "node --test test/*.test.js",
"rebuild:native": "electron-rebuild -f -w mineradio-taskbar-thumbnail"
```

Add `"native/taskbar-thumbnail/**/*"` to `build.files` and:

```json
"asarUnpack": ["node_modules/mineradio-taskbar-thumbnail/build/Release/*.node"]
```

Run `npm install` to update the lockfile, then run `npm run rebuild:native`.

Expected: `native/taskbar-thumbnail/build/Release/taskbar_thumbnail.node` or the linked package equivalent exists and loads under Electron 33.

- [ ] **Step 5: Smoke-test the compiled exports without attaching a window**

Run through Electron, not system Node:

```powershell
npx electron -e "const n=require('mineradio-taskbar-thumbnail'); console.log(Object.keys(n).sort().join(',')); process.exit(0)"
```

Expected output: `attach,clearBitmap,detach,updateBitmap`.

- [ ] **Step 6: Re-run all pure tests**

Run `npm test`.

Expected: all existing and new tests PASS.

- [ ] **Step 7: Record a no-commit checkpoint**

Run `git diff --check -- package.json package-lock.json native/taskbar-thumbnail`. Do not commit.

---

### Task 5: Connect Renderer state, card frames and Chrome preview

**Files:**
- Modify: `public/index.html`
- Modify: `src/desktop/preload.js`

**Interfaces:**
- Consumes: `MineradioTaskbarCard.createTaskbarCardRenderer`, existing `currentTaskbarPreviewPayload()` and `window.desktopWindow`.
- Produces: `desktopWindow.updateTaskbarBitmap(payload)` and query-only `?taskbarPreviewDebug=1` visual preview.

- [ ] **Step 1: Expose the narrow preload method**

Add next to `updateShellState`:

```js
updateTaskbarBitmap: payload => ipcRenderer.invoke('mineradio-taskbar-bitmap-update', payload || {}),
```

Do not expose file access, HWND access or the native module to Renderer.

- [ ] **Step 2: Load the renderer before the application script**

Add:

```html
<script src="taskbar-card-renderer.js"></script>
```

Remove the existing `#taskbar-preview-card` CSS and markup because it is invisible, noninteractive and causes false confidence about DWM output.

- [ ] **Step 3: Instantiate the renderer and publish frames**

Replace `renderTaskbarPreviewCard(payload)` with:

```js
var taskbarCardRenderer = null;
var taskbarCardLastKey = '';

function ensureTaskbarCardRenderer() {
  if (taskbarCardRenderer || !window.MineradioTaskbarCard) return taskbarCardRenderer;
  var api = getDesktopWindowApi();
  taskbarCardRenderer = window.MineradioTaskbarCard.createTaskbarCardRenderer({
    logoUrl: '/assets/taskbar-logo.png',
    emitFrame: function(frame) {
      if (api && typeof api.updateTaskbarBitmap === 'function') {
        api.updateTaskbarBitmap(frame).catch(function(error) {
          console.warn('[TaskbarCard] bitmap update failed:', error && error.message || error);
        });
      }
    }
  });
  if (new URLSearchParams(location.search).get('taskbarPreviewDebug') === '1') {
    var canvas = taskbarCardRenderer.canvas;
    canvas.id = 'taskbar-card-debug-preview';
    canvas.setAttribute('aria-label', '任务栏音乐卡片调试预览');
    document.body.appendChild(canvas);
  }
  return taskbarCardRenderer;
}

function renderTaskbarPreviewCard(payload) {
  var renderer = ensureTaskbarCardRenderer();
  if (!renderer) return;
  var key = window.MineradioTaskbarCard.cardVisualKey(payload);
  if (key === taskbarCardLastKey) return;
  taskbarCardLastKey = key;
  renderer.render(payload).catch(function(error) {
    console.warn('[TaskbarCard] render failed:', error && error.message || error);
  });
}
```

Add debug-only CSS for `#taskbar-card-debug-preview`: fixed right 24px/top 72px, width 320px, height 384px, z-index above the application, 18px radius, box shadow, and `pointer-events:none`. It must not appear without the query parameter.

- [ ] **Step 4: Close state-sync gaps**

Use `songCoverSrc(song, 640)` instead of 360. Call `syncTaskbarPreviewState('queue-clear')` at the end of `clearQueue()`. Call it after a custom cover is saved, removed or changed. Keep the current track-switch token rules and audio event listeners. Replace the local hand-built state key with `taskbarPreviewStateKey` only in the desktop helper module if it is imported; otherwise keep the renderer key and shell key separate to avoid introducing Node access in Renderer.

- [ ] **Step 5: Add an immediate command acknowledgment**

After invoking `prevTrack`, `togglePlay`, or `nextTrack`, schedule `syncTaskbarPreviewState('shell-command')` with `queueMicrotask`; audio events remain the final source of truth.

- [ ] **Step 6: Run pure tests and syntax checks**

Run:

```powershell
npm test
node --check public\taskbar-card-renderer.js
node --check src\desktop\preload.js
```

Expected: tests PASS and both syntax checks exit 0.

- [ ] **Step 7: Record a no-commit checkpoint**

Run `git diff --check -- public/index.html public/taskbar-card-renderer.js src/desktop/preload.js`. Do not commit.

---

### Task 6: Connect the Electron main process and native lifecycle

**Files:**
- Modify: `src/desktop/main.js`
- Modify: `src/desktop/taskbarPreview.js`
- Modify: `test/taskbar-thumbnail-bridge.test.js`

**Interfaces:**
- Consumes: `validateTaskbarBitmapPayload`, Electron `nativeImage`, and `createTaskbarThumbnailBridge`.
- Produces: IPC channel `mineradio-taskbar-bitmap-update`, native attach/update/detach, and system-thumbnail fallback.

- [ ] **Step 1: Add a failing fallback-state test**

Extend bridge tests to assert `clear()` and `detach()` are idempotent and native failures return false while logging only once. Run the test and confirm failure before changing the facade if any behavior is missing.

- [ ] **Step 2: Initialize the facade in `main.js`**

Import:

```js
const { createTaskbarThumbnailBridge } = require('./taskbarThumbnailBridge');
const { validateTaskbarBitmapPayload } = require('./taskbarPreview');
```

Create one module-level bridge:

```js
const taskbarThumbnailBridge = createTaskbarThumbnailBridge({ platform: process.platform, logger: console });
```

- [ ] **Step 3: Add bounded bitmap IPC**

Add:

```js
ipcMain.handle('mineradio-taskbar-bitmap-update', (event, rawPayload = {}) => {
  if (process.platform !== 'win32') return { ok: false, reason: 'unsupported-platform' };
  const senderWindow = getSenderWindow(event);
  if (!senderWindow || senderWindow !== mainWindow) return { ok: false, reason: 'invalid-sender' };
  try {
    const payload = validateTaskbarBitmapPayload(rawPayload);
    const image = nativeImage.createFromDataURL(payload.dataUrl);
    if (image.isEmpty()) return { ok: false, reason: 'empty-image' };
    return { ok: taskbarThumbnailBridge.update(image) };
  } catch (error) {
    console.warn('[TaskbarThumbnail] rejected bitmap:', error.message);
    return { ok: false, reason: 'invalid-bitmap' };
  }
});
```

- [ ] **Step 4: Attach and detach with the main window lifecycle**

After `mainWindow` construction and before it is shown, call:

```js
if (process.platform === 'win32') {
  taskbarThumbnailBridge.attach(mainWindow.getNativeWindowHandle());
}
```

In the window `closed` handler and application `before-quit`, call the idempotent `taskbarThumbnailBridge.detach()`.

- [ ] **Step 5: Stop cropping the main player when native mode is active**

In `updateTaskbarPreview(win)`, remove the centered `taskbarClipForPreview` call. When the native bridge is unavailable, reset the clip to the full system window with `{ x: 0, y: 0, width: 0, height: 0 }`. Remove the now-unused `taskbarClipForPreview` export and its centered-crop unit test. Keep `setThumbnailToolTip()` and `setThumbarButtons()`.

Use transparent SVG Thumbar icons without the current dark rounded rectangle so Windows supplies hover and pressed backgrounds. Keep the existing command mapping and disabled flags.

- [ ] **Step 6: Run tests and main-process syntax check**

Run:

```powershell
npm test
node --check src\desktop\main.js
```

Expected: all tests PASS and syntax check exits 0.

- [ ] **Step 7: Record a no-commit checkpoint**

Run `git diff --check -- src/desktop/main.js src/desktop/taskbarPreview.js src/desktop/taskbarThumbnailBridge.js`. Do not commit.

---

### Task 7: Perform Chrome Renderer verification

**Files:**
- No implementation files unless a test exposes a defect.
- Update tests only when a reproduced defect needs a regression test.

**Interfaces:**
- Consumes: local Mineradio server and `?taskbarPreviewDebug=1` preview.
- Produces: visual and console evidence for renderer requirements.

- [ ] **Step 1: Start the real application server without bypassing project startup**

Run `npm start` and keep the Electron process running. Read the terminal output to identify the local URL used by `mainWindow.loadURL`.

Expected: Electron window opens and local server reports no startup error.

- [ ] **Step 2: Connect through the requested Chrome extension**

Use the Chrome control skill and its extension browser binding. Open the local URL with `?taskbarPreviewDebug=1`. Do not substitute Playwright or the in-app browser.

Expected: the normal player loads and the 320×384 debug card appears only because the query flag is present.

- [ ] **Step 3: Play a real song and inspect the card**

Use the existing UI to select and play a real track. Verify in Chrome-visible state:

- real Mineradio logo;
- separate title and artist;
- square rounded album artwork from metadata;
- no video/player screenshot;
- no large empty black region.

Capture a Chrome screenshot as test evidence.

- [ ] **Step 4: Exercise controls and automatic refresh**

Trigger previous, play/pause and next through the existing Renderer command path. Verify title, artist, artwork and play state refresh. Switch rapidly across two songs and wait for cover decoding; confirm the old cover does not overwrite the new one.

- [ ] **Step 5: Inspect network and console state**

Verify there are no new console errors, failed `/api/cover` requests, CORS errors or image decode failures. A provider returning an unavailable song URL is not a taskbar-card defect unless it breaks state recovery.

- [ ] **Step 6: Add regression tests for every defect found**

For each observed renderer defect, first add a failing Node test to the closest test file, reproduce the failure, apply the smallest fix, rerun `npm test`, then repeat the affected Chrome check.

- [ ] **Step 7: Save the Renderer result in the final handoff notes**

Record tested song transitions, control outcomes, console result, resource result and screenshot path. Do not claim the native taskbar passed yet.

---

### Task 8: Perform Electron Windows and packaging verification

**Files:**
- Modify only if a reproduced native or packaging defect requires a fix.

**Interfaces:**
- Consumes: compiled addon, actual Electron HWND, Windows taskbar and build outputs.
- Produces: native taskbar and packaged-app evidence.

- [ ] **Step 1: Verify the development Electron taskbar**

With a real song playing, hover the Windows taskbar icon and verify the thumbnail is the music card rather than the main player. Verify the title, artist, logo and artwork are sharp and correctly proportioned.

- [ ] **Step 2: Verify native controls**

Click previous, play/pause and next in the Windows Thumbar. Verify immediate player response and that the middle icon tracks the real audio state after success or failure.

- [ ] **Step 3: Verify lifecycle and DPI**

Repeat after minimize, restore, hide-to-tray and show. Check at 100%, 125% and 150% display scaling when available. Confirm no duplicate taskbar icon or second preview window appears.

- [ ] **Step 4: Inspect native resource behavior**

Switch songs at least 20 times and open/close the taskbar preview repeatedly. Confirm memory and GDI object counts do not grow continuously and logs contain no repeated native warning.

- [ ] **Step 5: Build both Windows targets**

Run:

```powershell
npm run build
npm run build:portable
```

Expected: both commands exit 0 and produce the NSIS installer and portable executable in `dist`.

- [ ] **Step 6: Inspect packaged native files**

Verify `taskbar_thumbnail.node` is present outside `app.asar` in the packaged resources and that the packaged main process resolves it. Start the packaged app and repeat one real-song taskbar test.

- [ ] **Step 7: Run the complete verification suite once more**

Run:

```powershell
npm test
node --check public\taskbar-card-renderer.js
node --check src\desktop\main.js
node --check src\desktop\preload.js
git diff --check
```

Expected: all tests PASS, syntax checks exit 0 and `git diff --check` prints nothing.

---

### Task 9: Final scope audit and handoff

**Files:**
- No new implementation files.

**Interfaces:**
- Consumes: all test evidence and current Git diff.
- Produces: requested delivery report; commit only if the user separately authorizes it.

- [ ] **Step 1: Audit the diff against forbidden modules**

Run `git diff --name-only` and confirm no decoder, playback-source, playlist-core or audio-management file was changed outside the approved shell-state call sites in `public/index.html`.

- [ ] **Step 2: Confirm all three gates**

The completion gate is:

```text
Chrome Renderer verification: PASS
Electron Windows taskbar verification: PASS
NSIS and portable packaging verification: PASS
```

If any gate fails, report the concrete blocker and do not describe the task as complete.

- [ ] **Step 3: Prepare the final report**

Report:

1. Modified and newly created files.
2. Architecture and UI changes.
3. Implemented data binding and controls.
4. Chrome extension test results.
5. Electron Windows and packaging results.
6. Remaining issues, including any environmental limitation.

- [ ] **Step 4: Leave changes uncommitted unless explicitly requested**

Do not stage, commit, push or open a pull request without a separate user instruction after the test report.
