# Album Honeycomb Home Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the landed vinyl home so the left record/tonearm matches the reference, the right honeycomb has clear gaps and soft edge fading, Home stays visible during vinyl interactions, and the left player supports image/video wallpaper.

**Architecture:** Keep the existing `MineradioVinylHome` controller and app adapter. Make the layout math deterministic in `home-vinyl-layout.js`, keep DOM interaction in `home-vinyl.js`, keep styling in `home-vinyl.css`, and bridge wallpaper persistence in `index.html`.

**Tech Stack:** Electron 33, vanilla HTML/CSS/JavaScript, existing Node `assert` tests in `test-ai-modules.js`, existing FileReader and media normalization utilities.

## Global Constraints

- Do not redesign the full home page from scratch.
- Do not replace the existing `MineradioVinylHome` controller, playback queue bridge, playlist picker bridge, Music Soul chat bridge, or provider APIs.
- Do not add React, Vue, Canvas, Three.js, or a new animation library.
- Do not change the full immersive player, bottom bar, search, login, desktop lyrics, or existing global background media system.
- Preserve current unrelated dirty changes in `public/index.html`, `src/desktop/main.js`, and `test-ai-modules.js`.
- Home vinyl left/right UI clicks and drag-release clicks must not dismiss Home or jump to the main player view.
- Clicking a honeycomb disc must play that disc's corresponding song and keep Home visible.

---

### Task 1: Lock Home Vinyl Interaction Contracts

**Files:**
- Modify: `test-ai-modules.js`

**Interfaces:**
- Consumes: existing string-based `testMusicSoulUiContract()`, `testVinylHexLayoutUsesStaggeredRows()`, and `testVinylVisualWeightFallsTowardCircleEdge()`.
- Produces: failing assertions for the revised layout, edge fade, Home hit-test, click isolation, and wallpaper media support.

- [ ] **Step 1: Add failing assertions to `testMusicSoulUiContract()`**

Add these assertions after the existing `home-vinyl-empty` assertion:

```js
  assert.match(html, /class="home-vinyl-wallpaper-video"/);
  assert.match(html, /accept="image\/\*,video\/\*/);
  assert.match(html, /小型播放器壁纸/);
  assert.match(html, /function normalizeHomeVinylWallpaperMedia/);
  assert.match(html, /function syncHomeVinylWallpaperVideo/);
  assert.match(html, /homeVinylWallpaperMedia/);
  assert.match(html, /\.home-vinyl-shell/);
```

Add these assertions after `const vinylController = ...`:

```js
  assert.match(vinylController, /event\.stopPropagation\(\)/);
  assert.match(vinylController, /event\.preventDefault\(\)/);
  assert.match(vinylController, /data-dragging/);
```

Add these assertions after `const vinylCss = ...`:

```js
  assert.match(vinylCss, /home-vinyl-tonearm-elbow/);
  assert.match(vinylCss, /home-vinyl-wallpaper-video/);
  assert.match(vinylCss, /mask-image:radial-gradient/);
```

- [ ] **Step 2: Update layout tests to expect non-overlap spacing and stronger fade**

Change `testVinylHexLayoutUsesStaggeredRows()` expected values to:

```js
  assert.deepStrictEqual(layout.items[3], { index: 3, row: 1, column: 0, x: 59, y: 104 });
  assert.strictEqual(layout.spacingX, 118);
  assert.strictEqual(layout.spacingY, 104);
```

Change `testVinylVisualWeightFallsTowardCircleEdge()` to:

```js
  assert.ok(center.scale >= 1.08 && center.scale <= 1.16);
  assert.ok(edge.scale >= 0.68 && edge.scale <= 0.76);
  assert.ok(edge.opacity <= 0.28);
```

- [ ] **Step 3: Run tests and confirm they fail**

Run: `node test-ai-modules.js`

Expected: FAIL on missing revised wallpaper/tonearm/click-isolation contracts or old spacing values.

### Task 2: Prevent Home Vinyl Interactions From Dismissing Home

**Files:**
- Modify: `public/index.html`
- Modify: `public/home-vinyl.js`

**Interfaces:**
- Consumes: existing `isHomeBlankDismissClick(e)` and `MineradioVinylHome` pointer/click handlers.
- Produces: Home vinyl panel clicks do not call `dismissHomePage()`, disc clicks call `adapter.playCandidate(...)`, drag-release clicks only settle the honeycomb.

- [ ] **Step 1: Add vinyl selectors to the Home blank-click guard**

In `isHomeBlankDismissClick(e)`, add these selectors to `blockedSelector`:

```js
    '.home-vinyl-shell',
    '.home-vinyl-left',
    '.home-vinyl-right',
    '.home-vinyl-viewport',
    '.home-vinyl-player',
```

Also update `isPointNearHomeContent()` selectors to include:

```js
    '.home-vinyl-left',
    '.home-vinyl-right',
    '.home-vinyl-disc'
```

- [ ] **Step 2: Isolate honeycomb pointer and disc click events**

Change `createNode()` click handler to:

```js
    node.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      if (state.moved) return;
      var index = Number(node.getAttribute('data-index'));
      if (Number.isFinite(index)) selectIndex(index, true);
    });
```

At the top of `onPointerDown`, `onPointerMove`, and `onPointerUp`, call `event.stopPropagation()` after confirming the event belongs to the vinyl viewport interaction. In `onPointerDown`, also call `els.viewport.setAttribute('data-dragging', 'true')`; in `onPointerUp`, remove it after pointer release.

- [ ] **Step 3: Keep playback visual switches from stealing vinyl Home sessions**

In `syncPlaybackStateFromAudioEvent(reason)`, change:

```js
  if (reason === 'play' || reason === 'playing') switchPlaybackVisualToEmily();
```

to:

```js
  if ((reason === 'play' || reason === 'playing') && !vinylHomePlaybackSession) switchPlaybackVisualToEmily();
```

In `playQueueAt(idx, opts)`, change:

```js
  safePlaybackStep('visual-switch', switchPlaybackVisualToEmily);
```

to:

```js
  if (!opts.preserveHomeState) safePlaybackStep('visual-switch', switchPlaybackVisualToEmily);
```

In `attemptAudioPlay(opts)`, change:

```js
      switchPlaybackVisualToEmily();
```

to:

```js
      if (!vinylHomePlaybackSession) switchPlaybackVisualToEmily();
```

- [ ] **Step 4: Run tests**

Run: `node test-ai-modules.js`

Expected: tests still fail only for remaining visual/wallpaper/layout tasks, not syntax.

### Task 3: Revise Honeycomb Geometry and Edge Fade

**Files:**
- Modify: `public/home-vinyl-layout.js`
- Modify: `public/home-vinyl.js`
- Modify: `public/home-vinyl.css`

**Interfaces:**
- Consumes: `buildHexLayout(count, iconSize)`, `visualForPoint(dx, dy, radius)`, and controller `iconSizeForViewport(metrics)`.
- Produces: separated discs, capped center scale, stronger edge opacity falloff, and a radial viewport mask.

- [ ] **Step 1: Update hex spacing**

In `buildHexLayout`, set:

```js
    var spacingX = Math.round(iconSize * 1.18 * 1000) / 1000;
    var spacingY = Math.round(iconSize * 1.04 * 1000) / 1000;
```

- [ ] **Step 2: Update visual weighting**

Replace `visualForPoint()` return values with:

```js
    var edgeFade = Math.pow(normalized, 1.85);
    return {
      scale: 1.13 - normalized * 0.42,
      opacity: 1 - edgeFade * 0.78,
      zIndex: Math.round((1 - normalized) * 1000),
      normalized: normalized,
    };
```

- [ ] **Step 3: Reduce base disc size for the wider grid**

In `home-vinyl.js`, change `iconSizeForViewport(metrics)` to:

```js
    return Math.max(52, Math.min(88, metrics.radius * 0.22));
```

- [ ] **Step 4: Add viewport edge fade CSS**

Update `.home-vinyl-viewport` to include:

```css
  -webkit-mask-image:radial-gradient(circle at 50% 50%,#000 0 72%,rgba(0,0,0,.68) 84%,rgba(0,0,0,.18) 94%,transparent 100%);
  mask-image:radial-gradient(circle at 50% 50%,#000 0 72%,rgba(0,0,0,.68) 84%,rgba(0,0,0,.18) 94%,transparent 100%);
```

- [ ] **Step 5: Run tests**

Run: `node test-ai-modules.js`

Expected: layout and fade tests pass.

### Task 4: Rebuild the Record and Reference-Style Tonearm

**Files:**
- Modify: `public/index.html`
- Modify: `public/home-vinyl.css`
- Modify: `public/home-vinyl.js`

**Interfaces:**
- Consumes: existing `#home-vinyl-player[data-playing]`, `#home-vinyl-cover`, and `syncTrack(song)`.
- Produces: white bent tonearm above record, same-path raise/drop animation, stable disc spin, and cover-only crossfade.

- [ ] **Step 1: Add tonearm elbow markup**

Inside `#home-vinyl-tonearm`, between arm and head, add:

```html
            <i class="home-vinyl-tonearm-elbow"></i>
```

- [ ] **Step 2: Replace tonearm CSS with bent-arm reference style**

Use these key declarations:

```css
.home-vinyl-tonearm{position:absolute;z-index:5;right:2%;top:-1%;width:58%;height:38%;transform-origin:82% 17%;transform:rotate(-29deg);transition:transform .72s cubic-bezier(.2,.85,.22,1);pointer-events:none}
.home-vinyl-tonearm-pivot{position:absolute;right:3%;top:0;width:18%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 50% 50%,#fff 0 20%,#eef1f5 21% 46%,#1b2633 48% 100%);box-shadow:0 10px 22px rgba(0,0,0,.38),0 0 0 1px rgba(255,255,255,.14)}
.home-vinyl-tonearm-arm{position:absolute;right:14%;top:19%;width:52%;height:9px;border-radius:999px;background:#f9f9f7;transform:rotate(47deg);transform-origin:right center;box-shadow:0 4px 10px rgba(0,0,0,.28)}
.home-vinyl-tonearm-elbow{position:absolute;left:27%;top:61%;width:34%;height:9px;border-radius:999px;background:#f9f9f7;transform:rotate(9deg);transform-origin:left center;box-shadow:0 4px 10px rgba(0,0,0,.26)}
.home-vinyl-tonearm-head{position:absolute;left:13%;bottom:10%;width:17%;height:16%;border-radius:5px;background:linear-gradient(145deg,#fff,#d8dde4);transform:rotate(8deg);box-shadow:0 5px 12px rgba(0,0,0,.25)}
.home-vinyl-player[data-playing="true"] .home-vinyl-tonearm{transform:rotate(-7deg)}
```

- [ ] **Step 3: Make cover swap tokenized**

Add `coverToken: 0` to state. In `syncTrack(song)`, replace the current `setTimeout` with:

```js
    var token = ++state.coverToken;
    els.cover.style.opacity = '0';
    setTimeout(function() {
      if (token !== state.coverToken) return;
      els.cover.style.backgroundImage = coverBackground(song || {});
      els.cover.style.opacity = '1';
    }, state.reducedMotion ? 0 : 150);
```

- [ ] **Step 4: Run tests**

Run: `node test-ai-modules.js`

Expected: tonearm and controller contracts pass except wallpaper task if not implemented yet.

### Task 5: Add Small-Player Image/Video Wallpaper

**Files:**
- Modify: `public/index.html`
- Modify: `public/home-vinyl.css`
- Modify: `test-ai-modules.js`

**Interfaces:**
- Consumes: existing `fx.homeAiWallpaperImage`, `applyHomeAiWallpaper()`, `readHomeAiWallpaperFile(file)`, `saveLyricLayout()`, and visual-console row.
- Produces: `fx.homeVinylWallpaperMedia`, `normalizeHomeVinylWallpaperMedia(raw)`, `syncHomeVinylWallpaperVideo(media)`, image/video input support, and a left-card video layer.

- [ ] **Step 1: Add video layer markup**

Inside `.home-vinyl-left`, immediately after `.home-ai-wallpaper-layer`, add:

```html
      <video id="home-vinyl-wallpaper-video" class="home-vinyl-wallpaper-video" muted loop playsinline aria-hidden="true"></video>
```

- [ ] **Step 2: Update visual-console row and file input**

Change the label text to:

```html
    <div class="fx-color-row-label">小型播放器壁纸<small id="home-ai-wallpaper-value">跟随默认</small></div>
```

Change the input accept attribute to:

```html
<input type="file" id="home-ai-wallpaper-input" accept="image/*,video/*" style="display:none">
```

- [ ] **Step 3: Add media normalization and video sync helpers**

Add functions near `applyHomeAiWallpaper()`:

```js
function normalizeHomeVinylWallpaperMedia(raw) {
  if (!raw) return null;
  if (typeof raw === 'string') return normalizeCustomBackgroundImage(raw) ? { type: 'image', src: normalizeCustomBackgroundImage(raw) } : null;
  var type = raw.type === 'video' ? 'video' : 'image';
  var src = String(raw.src || '');
  if (!src) return null;
  return { type: type, src: src };
}
function syncHomeVinylWallpaperVideo(media) {
  var video = document.getElementById('home-vinyl-wallpaper-video');
  if (!video) return;
  if (media && media.type === 'video' && media.src) {
    if (video.src !== media.src) video.src = media.src;
    video.hidden = false;
    video.muted = true;
    video.loop = true;
    video.playsInline = true;
    var play = video.play && video.play();
    if (play && play.catch) play.catch(function(){});
  } else {
    video.pause && video.pause();
    video.removeAttribute('src');
    video.hidden = true;
  }
}
```

- [ ] **Step 4: Update apply/set/read wallpaper functions**

Update `applyHomeAiWallpaper()` to read `fx.homeVinylWallpaperMedia || fx.homeAiWallpaperImage`, set image CSS only for image media, and call `syncHomeVinylWallpaperVideo(media)`.

Update `updateHomeAiWallpaperControls()` label to show `自定义视频`, `自定义图片`, or `跟随默认`.

Update `setHomeAiWallpaperImage(src, silent)` to store:

```js
  fx.homeVinylWallpaperMedia = src ? { type: 'image', src: normalizeCustomBackgroundImage(src) } : null;
  fx.homeAiWallpaperImage = fx.homeVinylWallpaperMedia ? fx.homeVinylWallpaperMedia.src : '';
```

Update `clearHomeAiWallpaper()` to clear both fields.

Update `readHomeAiWallpaperFile(file)` so video files are read as data URL and stored as `{ type: 'video', src: dataUrl }`; image files keep the existing compression path.

- [ ] **Step 5: Add CSS for video wallpaper**

Add:

```css
.home-vinyl-wallpaper-video{position:absolute;inset:0;z-index:0;width:100%;height:100%;object-fit:cover;opacity:.58;filter:saturate(1.08) contrast(1.04);pointer-events:none}
.home-vinyl-wallpaper-video[hidden]{display:none}
```

- [ ] **Step 6: Run tests**

Run: `node test-ai-modules.js`

Expected: `AI helper module tests passed`.

### Task 6: Final Verification

**Files:**
- Modify: none unless verification reveals failures.

**Interfaces:**
- Consumes: completed Tasks 1-5.
- Produces: verified revision.

- [ ] **Step 1: Run contract tests**

Run: `node test-ai-modules.js`

Expected: `AI helper module tests passed`.

- [ ] **Step 2: Run diff checks**

Run: `git diff --check`

Expected: no output.

- [ ] **Step 3: Inspect final status**

Run: `git status --short`

Expected: only intended implementation files plus pre-existing unrelated dirty files if still present.

- [ ] **Step 4: Commit implementation**

Stage only files changed for this revision and commit:

```powershell
git add public/index.html public/home-vinyl.css public/home-vinyl.js public/home-vinyl-layout.js test-ai-modules.js docs/superpowers/plans/2026-07-06-album-honeycomb-home-revision.md
git commit -m "feat: refine vinyl home interactions"
```
