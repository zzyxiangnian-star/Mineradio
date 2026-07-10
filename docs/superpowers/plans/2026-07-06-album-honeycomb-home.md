# Mineradio Album Honeycomb Home Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current home cards with a 40:60 Music Soul vinyl player and a borderless circular, draggable album-disc honeycomb that loads full user playlists and plays the centered song immediately.

**Architecture:** Keep Mineradio's existing `playQueue`, `audio`, Music Soul, provider APIs, and playback functions as the only application state. Add a UMD layout module for deterministic geometry, a DOM controller for virtualized discs and pointer motion, and a small bridge in `public/index.html` that owns playlist loading and playback synchronization.

**Tech Stack:** Electron 33, vanilla HTML/CSS/JavaScript, existing GSAP 3.15, Node `assert` tests, existing provider API routes.

## Global Constraints

- Preserve the existing search bar, window controls, background system, full Music Soul panel, lyrics stage, login flows, and immersive player.
- Keep the home body at 40% left / 60% right down to the existing 960×540 minimum desktop window.
- Split the left panel vertically into exactly 20% introduction / 70% vinyl player / 10% quick chat.
- The right panel is selection-only: no mini-player, progress bar, favorite, play mode, or detail controls.
- Clip every right-side disc to a borderless circular viewport; outside pixels must not be visible.
- Do not cap playlist length or paginate the logical dataset; virtualize DOM nodes instead.
- Do not add Canvas, Three.js, React, Vue, or a new animation dependency.
- Selecting a playlist must not interrupt current audio; clicking a disc atomically adopts that playlist as `playQueue` and plays the selected index.
- When the home starts playback, keep the home visible through next/previous, ended-track advance, and playback fallback until the user explicitly leaves Home.
- Respect `prefers-reduced-motion: reduce` by disabling inertia, spring bounce, pulse glow, and continuous disc rotation.

---

## File Map

- Create `public/home-vinyl-layout.js`: pure hex-grid geometry, visibility, scale, clamping, and snap helpers; UMD export for browser and Node tests.
- Create `public/home-vinyl.js`: `window.MineradioVinylHome` DOM controller, node pool, pointer handling, inertial motion, snapping, and state rendering.
- Create `public/home-vinyl.css`: two-column home layout, 20/70/10 left panel, vinyl/tonearm, borderless circular mask, controls, tooltips, and reduced-motion rules.
- Modify `public/index.html`: load the new assets, replace old home markup, expose the application bridge, add playlist-selection mode, and notify the controller from existing playback state changes.
- Modify `test-ai-modules.js`: add deterministic layout tests and home integration contract tests.

---

### Task 1: Deterministic Honeycomb Layout Engine

**Files:**
- Create: `public/home-vinyl-layout.js`
- Modify: `test-ai-modules.js`

**Interfaces:**
- Consumes: `count: number`, `iconSize: number`, viewport `{ width, height, radius }`, offset `{ x, y }`.
- Produces: `MineradioVinylLayout.buildHexLayout`, `visualForPoint`, `visibleIndices`, `nearestIndex`, `clampOffset`, and `snapOffsetForIndex`.

- [ ] **Step 1: Add failing layout tests**

Append the import near the other `require` calls and add these tests before the final test invocations:

```js
const VinylLayout = require('./public/home-vinyl-layout');

function testVinylHexLayoutUsesStaggeredRows() {
  const layout = VinylLayout.buildHexLayout(7, 100);
  assert.strictEqual(layout.items.length, 7);
  assert.deepStrictEqual(layout.items[0], { index: 0, row: 0, column: 0, x: 0, y: 0 });
  assert.deepStrictEqual(layout.items[3], { index: 3, row: 1, column: 0, x: 45, y: 78 });
  assert.strictEqual(layout.spacingX, 90);
  assert.strictEqual(layout.spacingY, 78);
}

function testVinylVisualWeightFallsTowardCircleEdge() {
  const center = VinylLayout.visualForPoint(0, 0, 300);
  const edge = VinylLayout.visualForPoint(300, 0, 300);
  assert.ok(center.scale >= 1.2 && center.scale <= 1.35);
  assert.ok(edge.scale >= 0.65 && edge.scale <= 0.8);
  assert.ok(center.opacity > edge.opacity);
  assert.ok(center.zIndex > edge.zIndex);
}

function testVinylNearestAndSnapUseViewportCenter() {
  const layout = VinylLayout.buildHexLayout(8, 100);
  const offset = { x: 12, y: -20 };
  const nearest = VinylLayout.nearestIndex(layout.items, offset, { x: 50, y: 58 });
  const snap = VinylLayout.snapOffsetForIndex(layout.items, nearest, { x: 50, y: 58 });
  assert.strictEqual(layout.items[nearest].x + snap.x, 50);
  assert.strictEqual(layout.items[nearest].y + snap.y, 58);
}

function testVinylVisibilityDoesNotReturnEntireLargePlaylist() {
  const layout = VinylLayout.buildHexLayout(300, 82);
  const visible = VinylLayout.visibleIndices(layout.items, { x: 0, y: 0 }, {
    width: 620,
    height: 620,
    radius: 310,
    overscan: 100,
  });
  assert.ok(visible.length > 0);
  assert.ok(visible.length < 120);
}
```

Add calls alongside the existing synchronous test calls:

```js
testVinylHexLayoutUsesStaggeredRows();
testVinylVisualWeightFallsTowardCircleEdge();
testVinylNearestAndSnapUseViewportCenter();
testVinylVisibilityDoesNotReturnEntireLargePlaylist();
```

- [ ] **Step 2: Run the tests and confirm the missing module failure**

Run: `node test-ai-modules.js`

Expected: FAIL with `Cannot find module './public/home-vinyl-layout'`.

- [ ] **Step 3: Create the complete UMD layout module**

Create `public/home-vinyl-layout.js`:

```js
(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MineradioVinylLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function buildHexLayout(count, iconSize) {
    count = Math.max(0, Math.floor(Number(count) || 0));
    iconSize = Math.max(24, Number(iconSize) || 84);
    var spacingX = Math.round(iconSize * 0.9 * 1000) / 1000;
    var spacingY = Math.round(iconSize * 0.78 * 1000) / 1000;
    var columns = Math.max(3, Math.ceil(Math.sqrt(Math.max(1, count) * 1.18)));
    var items = [];
    for (var index = 0; index < count; index++) {
      var row = Math.floor(index / columns);
      var column = index % columns;
      items.push({
        index: index,
        row: row,
        column: column,
        x: column * spacingX + (row % 2 ? spacingX / 2 : 0),
        y: row * spacingY,
      });
    }
    var maxX = items.reduce(function(max, item){ return Math.max(max, item.x); }, 0);
    var maxY = items.reduce(function(max, item){ return Math.max(max, item.y); }, 0);
    return {
      items: items,
      iconSize: iconSize,
      spacingX: spacingX,
      spacingY: spacingY,
      columns: columns,
      bounds: { minX: 0, minY: 0, maxX: maxX, maxY: maxY },
    };
  }

  function visualForPoint(dx, dy, radius) {
    radius = Math.max(1, Number(radius) || 1);
    var normalized = clamp(Math.sqrt(dx * dx + dy * dy) / radius, 0, 1);
    return {
      scale: 1.3 - normalized * 0.58,
      opacity: 1 - normalized * 0.34,
      zIndex: Math.round((1 - normalized) * 1000),
      normalized: normalized,
    };
  }

  function visibleIndices(items, offset, viewport) {
    offset = offset || { x: 0, y: 0 };
    viewport = viewport || {};
    var width = Math.max(1, Number(viewport.width) || 1);
    var height = Math.max(1, Number(viewport.height) || 1);
    var radius = Math.max(1, Number(viewport.radius) || Math.min(width, height) / 2);
    var overscan = Math.max(0, Number(viewport.overscan) || 0);
    var cx = width / 2;
    var cy = height / 2;
    var limit = radius + overscan;
    var result = [];
    for (var i = 0; i < items.length; i++) {
      var x = items[i].x + offset.x;
      var y = items[i].y + offset.y;
      if (Math.abs(x - cx) > limit || Math.abs(y - cy) > limit) continue;
      if (Math.hypot(x - cx, y - cy) <= limit * 1.12) result.push(items[i].index);
    }
    return result;
  }

  function nearestIndex(items, offset, center) {
    if (!items || !items.length) return -1;
    offset = offset || { x: 0, y: 0 };
    center = center || { x: 0, y: 0 };
    var nearest = 0;
    var distance = Infinity;
    for (var i = 0; i < items.length; i++) {
      var dx = items[i].x + offset.x - center.x;
      var dy = items[i].y + offset.y - center.y;
      var next = dx * dx + dy * dy;
      if (next < distance) { distance = next; nearest = items[i].index; }
    }
    return nearest;
  }

  function snapOffsetForIndex(items, index, center) {
    center = center || { x: 0, y: 0 };
    var item = items && items[index];
    return item ? { x: center.x - item.x, y: center.y - item.y } : { x: 0, y: 0 };
  }

  function clampOffset(offset, layout, viewport) {
    if (!layout || !layout.items.length) return { x: 0, y: 0 };
    var width = Math.max(1, Number(viewport.width) || 1);
    var height = Math.max(1, Number(viewport.height) || 1);
    var pad = Math.max(layout.iconSize, Number(viewport.radius) * 0.32);
    var minX = width - layout.bounds.maxX - pad;
    var maxX = pad;
    var minY = height - layout.bounds.maxY - pad;
    var maxY = pad;
    return { x: clamp(offset.x, minX, maxX), y: clamp(offset.y, minY, maxY) };
  }

  return {
    clamp: clamp,
    buildHexLayout: buildHexLayout,
    visualForPoint: visualForPoint,
    visibleIndices: visibleIndices,
    nearestIndex: nearestIndex,
    snapOffsetForIndex: snapOffsetForIndex,
    clampOffset: clampOffset,
  };
});
```

- [ ] **Step 4: Run tests and confirm layout coverage passes**

Run: `node test-ai-modules.js`

Expected: `AI helper module tests passed`.

- [ ] **Step 5: Commit the layout engine**

```powershell
git add public/home-vinyl-layout.js test-ai-modules.js
git commit -m "feat: add vinyl honeycomb layout engine"
```

---

### Task 2: Replace the Home Markup and Add the Static Vinyl Visual System

**Files:**
- Create: `public/home-vinyl.css`
- Modify: `public/index.html`
- Modify: `test-ai-modules.js`

**Interfaces:**
- Consumes: existing `#empty-home`, `assets/ms-ai-dj-avatar.jpg`, CSS variables such as `--home-accent-rgb`.
- Produces: stable DOM IDs consumed by Task 3: `home-vinyl-player`, `home-vinyl-disc`, `home-vinyl-cover`, `home-vinyl-tonearm`, `home-vinyl-grid`, `home-vinyl-viewport`, and four control groups.

- [ ] **Step 1: Add a failing home markup contract test**

Add to `testMusicSoulUiContract()`:

```js
  assert.match(html, /href="home-vinyl\.css"/);
  assert.match(html, /id="home-vinyl-player"/);
  assert.match(html, /id="home-vinyl-viewport"/);
  assert.match(html, /id="home-vinyl-grid"/);
  assert.match(html, /id="home-vinyl-tonearm"/);
  assert.match(html, /id="home-vinyl-play"/);
  assert.match(html, /id="home-vinyl-prev"/);
  assert.match(html, /id="home-vinyl-next"/);
  assert.match(html, /id="home-vinyl-volume"/);
  assert.match(html, /onclick="openVinylPlaylistPicker\(\)"/);
  assert.doesNotMatch(html, /<div class="home-grid">/);
  assert.doesNotMatch(html, /id="home-continue-title"/);
  assert.doesNotMatch(html, /id="home-music-dna-summary"/);
```

- [ ] **Step 2: Run the contract test and confirm failure**

Run: `node test-ai-modules.js`

Expected: FAIL on the first missing `home-vinyl.css` or `home-vinyl-player` assertion.

- [ ] **Step 3: Load the new stylesheet and layout script**

Add inside `<head>`, after the Google Fonts link:

```html
<link href="home-vinyl.css" rel="stylesheet">
<script src="home-vinyl-layout.js"></script>
```

Add after the existing large inline script and before `</body>`:

```html
<script src="home-vinyl.js"></script>
```

- [ ] **Step 4: Replace the complete `#empty-home` inner markup**

Keep the `<section id="empty-home">` wrapper and replace its current `.empty-home-shell` contents with:

```html
<div class="empty-home-shell home-vinyl-shell">
  <section class="home-vinyl-left" aria-label="Music Soul 唱片播放器">
    <div class="home-ai-wallpaper-layer" aria-hidden="true"></div>
    <header class="home-vinyl-intro">
      <img class="home-vinyl-avatar" src="assets/ms-ai-dj-avatar.jpg" alt="Music Soul">
      <div class="home-vinyl-intro-copy">
        <div class="home-vinyl-kicker"><i aria-hidden="true"></i> AI DJ ONLINE</div>
        <h1>Music Soul <span>MS</span></h1>
        <p>懂你此刻，也替你接住下一首。</p>
      </div>
    </header>

    <div id="home-vinyl-player" class="home-vinyl-player" data-playing="false">
      <div class="home-vinyl-deck">
        <div id="home-vinyl-tonearm" class="home-vinyl-tonearm" aria-hidden="true">
          <i class="home-vinyl-tonearm-pivot"></i>
          <i class="home-vinyl-tonearm-arm"></i>
          <i class="home-vinyl-tonearm-head"></i>
        </div>
        <div id="home-vinyl-disc" class="home-vinyl-main-disc">
          <div id="home-vinyl-cover" class="home-vinyl-main-cover"></div>
          <i class="home-vinyl-hole" aria-hidden="true"></i>
        </div>
      </div>
      <div class="home-vinyl-track-line">
        <strong id="home-vinyl-title">选择一张唱片</strong>
        <span aria-hidden="true">·</span>
        <span id="home-vinyl-artist">Music Soul</span>
      </div>
      <div class="home-vinyl-controls" aria-label="主页播放器控制">
        <button id="home-vinyl-prev" type="button" aria-label="上一首">‹</button>
        <button id="home-vinyl-play" class="primary" type="button" aria-label="播放或暂停">▶</button>
        <button id="home-vinyl-next" type="button" aria-label="下一首">›</button>
        <div class="home-vinyl-volume-wrap">
          <button id="home-vinyl-volume" type="button" aria-label="音量">◖</button>
          <div class="home-vinyl-volume-pop" role="group" aria-label="音量控制">
            <input id="home-vinyl-volume-slider" type="range" min="0" max="1" step="0.01" value="1" aria-label="主页音量">
          </div>
        </div>
      </div>
    </div>

    <form id="home-vinyl-chat" class="home-vinyl-chat">
      <input id="home-vinyl-chat-input" type="text" autocomplete="off" placeholder="告诉 MS 你现在想听什么…" aria-label="向 Music Soul 发送消息">
      <button type="submit" aria-label="发送给 Music Soul">➜</button>
    </form>
  </section>

  <section class="home-vinyl-right" aria-label="动态唱片蜂窝">
    <header class="home-vinyl-library-head">
      <div><small>NOW BROWSING</small><strong id="home-vinyl-playlist-title">选择一个歌单</strong></div>
      <button type="button" onclick="openVinylPlaylistPicker()">切换歌单</button>
    </header>
    <div id="home-vinyl-viewport" class="home-vinyl-viewport">
      <div id="home-vinyl-grid" class="home-vinyl-grid" role="listbox" aria-label="歌单歌曲唱片"></div>
      <div id="home-vinyl-empty" class="home-vinyl-empty">从“我的歌单”选择音乐</div>
    </div>
  </section>
</div>
```

- [ ] **Step 5: Create the complete static stylesheet foundation**

Create `public/home-vinyl.css` with these selectors and values; keep all rules scoped under `.home-vinyl-shell` to avoid changing immersive playback:

```css
.home-vinyl-shell{height:100%;min-height:440px;display:grid!important;grid-template-columns:minmax(330px,2fr) minmax(470px,3fr)!important;grid-template-rows:1fr!important;gap:clamp(14px,1.2vw,18px)!important;align-items:stretch}
.home-vinyl-left,.home-vinyl-right{position:relative;min-width:0;min-height:0;overflow:hidden}
.home-vinyl-left{display:grid;grid-template-rows:20% 70% 10%;padding:clamp(16px,1.7vw,26px);border-radius:28px;border:1px solid rgba(255,255,255,.09);background:linear-gradient(145deg,rgba(24,26,31,.62),rgba(5,8,12,.76));box-shadow:0 28px 90px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.07);backdrop-filter:blur(30px) saturate(1.14)}
.home-vinyl-left>.home-ai-wallpaper-layer{z-index:0}.home-vinyl-left>*:not(.home-ai-wallpaper-layer){position:relative;z-index:1}
.home-vinyl-intro{display:flex;align-items:center;gap:14px;min-height:0}
.home-vinyl-avatar{width:clamp(54px,5vw,76px);height:clamp(54px,5vw,76px);flex:0 0 auto;border-radius:50%;object-fit:cover;box-shadow:0 12px 34px rgba(0,0,0,.38),0 0 0 1px rgba(255,255,255,.14)}
.home-vinyl-intro-copy{min-width:0}.home-vinyl-kicker{font-size:9px;font-weight:800;letter-spacing:.14em;color:rgba(255,255,255,.52)}
.home-vinyl-kicker i{display:inline-block;width:6px;height:6px;margin-right:6px;border-radius:50%;background:rgb(var(--home-accent-rgb));box-shadow:0 0 12px rgba(var(--home-accent-rgb),.65)}
.home-vinyl-intro h1{margin-top:5px;font-size:clamp(20px,2.2vw,31px);line-height:1;color:#fff}.home-vinyl-intro h1 span{font-size:.42em;color:rgba(255,255,255,.42);letter-spacing:.12em}
.home-vinyl-intro p{margin-top:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:11px;color:rgba(255,255,255,.55)}
.home-vinyl-player{display:grid;grid-template-rows:minmax(0,1fr) auto auto;min-height:0;place-items:center}
.home-vinyl-deck{position:relative;width:min(92%,42vh);aspect-ratio:1;align-self:center}
.home-vinyl-main-disc{position:absolute;inset:10% 4% 0 4%;border-radius:50%;background:repeating-radial-gradient(circle,rgba(255,255,255,.035) 0 1px,rgba(0,0,0,.02) 1px 5px),radial-gradient(circle at 38% 32%,#34353a 0,#111216 38%,#050506 72%);box-shadow:0 28px 70px rgba(0,0,0,.52),inset 0 0 0 1px rgba(255,255,255,.11),inset 0 0 40px rgba(255,255,255,.035);will-change:transform}
.home-vinyl-main-cover{position:absolute;inset:24%;border-radius:50%;background:linear-gradient(145deg,#25354b,#d45f91);background-size:cover;background-position:center;box-shadow:0 0 0 3px rgba(3,3,5,.72),0 0 0 5px rgba(255,255,255,.055)}
.home-vinyl-hole{position:absolute;left:50%;top:50%;width:5%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:#050506;box-shadow:0 0 0 2px rgba(255,255,255,.2)}
.home-vinyl-tonearm{position:absolute;z-index:5;right:1%;top:0;width:52%;height:42%;transform-origin:84% 16%;transform:rotate(-13deg);transition:transform .7s cubic-bezier(.2,.85,.22,1);pointer-events:none}
.home-vinyl-tonearm-pivot{position:absolute;right:4%;top:0;width:19%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 42% 35%,#f7f7f7,#92969d 55%,#242831);box-shadow:0 8px 18px rgba(0,0,0,.35)}
.home-vinyl-tonearm-arm{position:absolute;right:13%;top:16%;width:76%;height:8px;border-radius:999px;background:linear-gradient(#fafafa,#8d9298);transform:rotate(25deg);transform-origin:right center;box-shadow:0 4px 10px rgba(0,0,0,.32)}
.home-vinyl-tonearm-head{position:absolute;left:3%;bottom:2%;width:22%;height:17%;border-radius:5px;background:linear-gradient(145deg,#f5f5f5,#80858d);transform:rotate(18deg)}
.home-vinyl-player[data-playing="true"] .home-vinyl-tonearm{transform:rotate(5deg)}
.home-vinyl-player[data-playing="true"] .home-vinyl-main-disc{animation:home-vinyl-spin 14s linear infinite}
.home-vinyl-track-line{display:flex;max-width:92%;gap:6px;align-items:center;white-space:nowrap;overflow:hidden;font-size:12px;color:rgba(255,255,255,.55)}
.home-vinyl-track-line strong{overflow:hidden;text-overflow:ellipsis;color:rgba(255,255,255,.93)}
.home-vinyl-controls{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:9px}
.home-vinyl-controls button,.home-vinyl-library-head button,.home-vinyl-chat button{border:1px solid rgba(255,255,255,.11);background:rgba(255,255,255,.055);color:#fff;cursor:pointer;transition:transform .18s,background .18s,border-color .18s}
.home-vinyl-controls>button,.home-vinyl-volume-wrap>button{width:35px;height:35px;border-radius:50%;font:700 20px/1 var(--font-sans)}
.home-vinyl-controls button.primary{width:44px;height:44px;background:rgba(var(--home-accent-rgb),.14);border-color:rgba(var(--home-accent-rgb),.34);font-size:15px}
.home-vinyl-controls button:hover,.home-vinyl-library-head button:hover,.home-vinyl-chat button:hover{transform:translateY(-1px);background:rgba(255,255,255,.11)}
.home-vinyl-volume-wrap{position:relative}.home-vinyl-volume-pop{position:absolute;left:50%;bottom:43px;width:132px;padding:9px 12px;border-radius:12px;transform:translate(-50%,8px);opacity:0;pointer-events:none;background:rgba(7,9,13,.88);border:1px solid rgba(255,255,255,.1);transition:.18s}
.home-vinyl-volume-wrap.open .home-vinyl-volume-pop{opacity:1;pointer-events:auto;transform:translate(-50%,0)}.home-vinyl-volume-pop input{width:100%;accent-color:var(--home-accent)}
.home-vinyl-chat{display:grid;grid-template-columns:1fr 34px;align-items:center;gap:7px;min-height:0;padding:5px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.09);background:rgba(3,7,10,.38)}
.home-vinyl-chat input{min-width:0;height:30px;padding:0 8px;border:0;outline:0;background:transparent;color:#fff;font:600 11px/1 var(--font-sans)}.home-vinyl-chat input::placeholder{color:rgba(255,255,255,.38)}.home-vinyl-chat button{width:30px;height:30px;border-radius:50%}
.home-vinyl-right{display:grid;grid-template-rows:auto minmax(0,1fr);padding:4px 0 0}
.home-vinyl-library-head{position:relative;z-index:4;display:flex;align-items:center;justify-content:space-between;gap:14px;padding:0 12px 8px}.home-vinyl-library-head div{min-width:0}.home-vinyl-library-head small{display:block;font:800 9px/1 var(--font-sans);letter-spacing:.14em;color:rgba(255,255,255,.38)}.home-vinyl-library-head strong{display:block;margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:14px;color:rgba(255,255,255,.86)}.home-vinyl-library-head button{height:30px;padding:0 12px;border-radius:999px;font:750 11px/1 var(--font-sans)}
.home-vinyl-viewport{position:relative;justify-self:center;align-self:center;width:min(100%,calc(100vh - 230px));aspect-ratio:1;border-radius:50%;clip-path:circle(50% at 50% 50%);overflow:hidden;isolation:isolate;touch-action:none;cursor:grab;background:radial-gradient(circle,rgba(6,10,14,.28),rgba(2,4,8,.14) 62%,rgba(0,0,0,0) 78%)}
.home-vinyl-viewport:active{cursor:grabbing}.home-vinyl-grid{position:absolute;inset:0;will-change:transform}.home-vinyl-empty{position:absolute;inset:0;display:grid;place-items:center;color:rgba(255,255,255,.38);font-size:12px;pointer-events:none}
.home-vinyl-disc{position:absolute;left:0;top:0;border:0;border-radius:50%;padding:0;background:#090a0c;background-size:cover;background-position:center;box-shadow:0 16px 34px rgba(0,0,0,.42),inset 0 0 0 1px rgba(255,255,255,.14),inset 0 0 0 10px rgba(0,0,0,.18);will-change:transform,opacity;cursor:pointer}
.home-vinyl-disc::before{content:'';position:absolute;inset:0;border-radius:50%;background:repeating-radial-gradient(circle,rgba(255,255,255,.055) 0 1px,transparent 1px 6px),linear-gradient(115deg,rgba(255,255,255,.18),transparent 27%,transparent 70%,rgba(255,255,255,.08));mix-blend-mode:screen}.home-vinyl-disc::after{content:'';position:absolute;left:50%;top:50%;width:7%;aspect-ratio:1;transform:translate(-50%,-50%);border-radius:50%;background:#060608;box-shadow:0 0 0 2px rgba(255,255,255,.28)}
.home-vinyl-disc.is-playing{box-shadow:0 0 0 2px rgba(var(--home-accent-rgb),.45),0 0 30px rgba(var(--home-accent-rgb),.26),0 18px 38px rgba(0,0,0,.5)}.home-vinyl-disc.is-playing.is-audible{animation:home-vinyl-spin 14s linear infinite,home-vinyl-glow 2.8s ease-in-out infinite}
.home-vinyl-disc-tooltip{position:absolute;z-index:8;max-width:180px;padding:7px 9px;border-radius:9px;background:rgba(5,7,10,.86);border:1px solid rgba(255,255,255,.1);color:#fff;font-size:10px;pointer-events:none;opacity:0;transition:opacity .15s}
@keyframes home-vinyl-spin{to{rotate:360deg}}@keyframes home-vinyl-glow{50%{box-shadow:0 0 0 3px rgba(var(--home-accent-rgb),.5),0 0 42px rgba(var(--home-accent-rgb),.34),0 18px 38px rgba(0,0,0,.5)}}
@media(max-width:1100px){.home-vinyl-shell{grid-template-columns:minmax(300px,2fr) minmax(420px,3fr)!important}.home-vinyl-left{padding:14px}.home-vinyl-deck{width:min(88%,39vh)}}
@media(max-height:700px){.home-vinyl-left{padding:12px 14px}.home-vinyl-avatar{width:50px;height:50px}.home-vinyl-deck{width:min(78%,36vh)}.home-vinyl-controls{margin-top:5px}.home-vinyl-viewport{width:min(100%,calc(100vh - 185px))}}
@media(prefers-reduced-motion:reduce){.home-vinyl-shell *{scroll-behavior:auto!important}.home-vinyl-main-disc,.home-vinyl-disc{animation:none!important}.home-vinyl-tonearm{transition-duration:.16s}.home-vinyl-disc{transition:none}}
```

- [ ] **Step 6: Run the contract tests**

Run: `node test-ai-modules.js`

Expected: `AI helper module tests passed`.

- [ ] **Step 7: Commit the static home shell**

```powershell
git add public/home-vinyl.css public/index.html test-ai-modules.js
git commit -m "feat: add vinyl home visual shell"
```

---

### Task 3: Virtualized Disc Controller, Dragging, Inertia, and Snap

**Files:**
- Create: `public/home-vinyl.js`
- Modify: `test-ai-modules.js`

**Interfaces:**
- Consumes: `window.MineradioVinylLayout`, Task 2 DOM IDs, and an adapter supplied by Task 4.
- Produces: `window.MineradioVinylHome.mount(adapter)`, `setPlaylist(meta, tracks)`, `syncTrack(song, index)`, `syncPlayback(isPlaying)`, `resize()`, `openPicker()`, `submitChat(text)`, `getDebugState()`, and `destroy()`.

- [ ] **Step 1: Add a failing controller contract test**

Add inside `testMusicSoulUiContract()`:

```js
  const vinylController = fs.readFileSync('public/home-vinyl.js', 'utf8');
  assert.match(vinylController, /window\.MineradioVinylHome/);
  assert.match(vinylController, /function setPlaylist/);
  assert.match(vinylController, /function syncTrack/);
  assert.match(vinylController, /function syncPlayback/);
  assert.match(vinylController, /requestAnimationFrame/);
  assert.match(vinylController, /visibleIndices/);
  assert.match(vinylController, /setPointerCapture/);
```

- [ ] **Step 2: Run tests and confirm the missing controller failure**

Run: `node test-ai-modules.js`

Expected: FAIL with `ENOENT` for `public/home-vinyl.js`.

- [ ] **Step 3: Implement the controller state and public API**

Create `public/home-vinyl.js` as an IIFE. Use this exact state shape and exported API; helper bodies must remain private:

```js
(function() {
  'use strict';
  var Layout = window.MineradioVinylLayout;
  var adapter = null;
  var els = {};
  var state = {
    mounted: false, tracks: [], playlist: null, layout: null,
    offset: { x: 0, y: 0 }, velocity: { x: 0, y: 0 },
    selectedIndex: -1, playingIndex: -1, audible: false,
    dragging: false, moved: false, pointerId: null,
    lastPoint: null, lastTime: 0, frame: 0, snapFrame: 0,
    nodes: new Map(), pool: [], reducedMotion: false,
  };

  function songKey(song) {
    if (adapter && adapter.songKey) return adapter.songKey(song);
    return [song && song.source, song && song.id, song && song.mid, song && song.name, song && song.artist].filter(Boolean).join(':');
  }

  function stableGradient(song) {
    var text = songKey(song) || 'mineradio';
    var hash = 0;
    for (var i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    var a = Math.abs(hash) % 360;
    var b = (a + 76 + Math.abs(hash >> 8) % 80) % 360;
    return 'linear-gradient(145deg,hsl(' + a + ' 56% 38%),hsl(' + b + ' 62% 56%))';
  }

  function coverFor(song) {
    return adapter && adapter.coverFor ? adapter.coverFor(song) : (song && song.cover || '');
  }

  function viewportMetrics() {
    var rect = els.viewport.getBoundingClientRect();
    return { width: rect.width, height: rect.height, radius: Math.min(rect.width, rect.height) / 2, overscan: Math.max(90, state.layout ? state.layout.iconSize : 90) };
  }

  function iconSizeForViewport(metrics) {
    return Math.max(58, Math.min(104, metrics.radius * 0.29));
  }

  function releaseNode(index) {
    var node = state.nodes.get(index);
    if (!node) return;
    state.nodes.delete(index); node.hidden = true; node.removeAttribute('data-index'); state.pool.push(node);
  }

  function createNode() {
    var node = document.createElement('button');
    node.type = 'button'; node.className = 'home-vinyl-disc'; node.setAttribute('role', 'option');
    node.addEventListener('click', function() {
      if (state.moved) return;
      var index = Number(node.getAttribute('data-index'));
      if (Number.isFinite(index)) selectIndex(index, true);
    });
    return node;
  }

  function bindNode(node, index) {
    var song = state.tracks[index] || {};
    node.hidden = false; node.setAttribute('data-index', String(index));
    node.setAttribute('aria-label', (song.name || song.title || '未知歌曲') + ' · ' + (song.artist || '未知歌手'));
    var cover = coverFor(song);
    node.style.backgroundImage = cover ? 'url("' + String(cover).replace(/"/g, '%22') + '")' : stableGradient(song);
    node.title = (song.name || song.title || '未知歌曲') + ' · ' + (song.artist || '未知歌手');
  }

  function acquireNode(index) {
    var node = state.nodes.get(index);
    if (node) return node;
    node = state.pool.pop() || createNode(); bindNode(node, index); els.grid.appendChild(node); state.nodes.set(index, node); return node;
  }

  function renderFrame() {
    state.frame = 0;
    if (!state.layout || !state.tracks.length) return;
    var metrics = viewportMetrics();
    var visible = new Set(Layout.visibleIndices(state.layout.items, state.offset, metrics));
    Array.from(state.nodes.keys()).forEach(function(index){ if (!visible.has(index)) releaseNode(index); });
    visible.forEach(function(index) {
      var item = state.layout.items[index];
      var node = acquireNode(index);
      var x = item.x + state.offset.x;
      var y = item.y + state.offset.y;
      var visual = Layout.visualForPoint(x - metrics.width / 2, y - metrics.height / 2, metrics.radius);
      var size = state.layout.iconSize;
      node.style.width = size + 'px'; node.style.height = size + 'px';
      node.style.transform = 'translate3d(' + (x - size / 2) + 'px,' + (y - size / 2) + 'px,0) scale(' + visual.scale + ')';
      node.style.opacity = visual.opacity; node.style.zIndex = visual.zIndex;
      node.classList.toggle('is-playing', index === state.playingIndex);
      node.classList.toggle('is-audible', index === state.playingIndex && state.audible);
      node.setAttribute('aria-selected', index === state.selectedIndex ? 'true' : 'false');
    });
  }

  function scheduleRender() { if (!state.frame) state.frame = requestAnimationFrame(renderFrame); }

  function rebuildLayout(focusIndex) {
    var metrics = viewportMetrics();
    state.layout = Layout.buildHexLayout(state.tracks.length, iconSizeForViewport(metrics));
    var index = Math.max(0, Math.min(state.tracks.length - 1, Number(focusIndex) || 0));
    state.offset = Layout.snapOffsetForIndex(state.layout.items, index, { x: metrics.width / 2, y: metrics.height / 2 });
    state.selectedIndex = state.tracks.length ? index : -1;
    scheduleRender();
  }

  function animateToOffset(target, onDone) {
    cancelAnimationFrame(state.snapFrame);
    if (state.reducedMotion) { state.offset = target; scheduleRender(); if (onDone) onDone(); return; }
    var start = { x: state.offset.x, y: state.offset.y }; var started = performance.now();
    function step(now) {
      var t = Math.min(1, (now - started) / 420); var eased = 1 - Math.pow(1 - t, 4);
      state.offset.x = start.x + (target.x - start.x) * eased;
      state.offset.y = start.y + (target.y - start.y) * eased;
      scheduleRender();
      if (t < 1) state.snapFrame = requestAnimationFrame(step); else { state.snapFrame = 0; if (onDone) onDone(); }
    }
    state.snapFrame = requestAnimationFrame(step);
  }

  function selectIndex(index, autoplay) {
    if (!state.layout || !state.tracks[index]) return;
    state.selectedIndex = index;
    var metrics = viewportMetrics();
    var target = Layout.snapOffsetForIndex(state.layout.items, index, { x: metrics.width / 2, y: metrics.height / 2 });
    animateToOffset(target, function(){ if (autoplay && adapter && adapter.playCandidate) adapter.playCandidate(state.tracks, index, state.playlist); });
  }

  function settleToNearest() {
    if (!state.layout) return;
    var metrics = viewportMetrics();
    var nearest = Layout.nearestIndex(state.layout.items, state.offset, { x: metrics.width / 2, y: metrics.height / 2 });
    selectIndex(nearest, false);
  }

  function startInertia() {
    if (state.reducedMotion) { settleToNearest(); return; }
    function step() {
      state.velocity.x *= .92; state.velocity.y *= .92;
      state.offset.x += state.velocity.x; state.offset.y += state.velocity.y;
      state.offset = Layout.clampOffset(state.offset, state.layout, viewportMetrics()); scheduleRender();
      if (Math.hypot(state.velocity.x, state.velocity.y) > .55) requestAnimationFrame(step); else settleToNearest();
    }
    requestAnimationFrame(step);
  }

  function onPointerDown(event) {
    if (!state.tracks.length || event.button > 0) return;
    state.dragging = true; state.moved = false; state.pointerId = event.pointerId;
    state.lastPoint = { x: event.clientX, y: event.clientY }; state.lastTime = performance.now();
    state.velocity = { x: 0, y: 0 }; els.viewport.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    var now = performance.now(); var dx = event.clientX - state.lastPoint.x; var dy = event.clientY - state.lastPoint.y;
    if (Math.hypot(dx, dy) > 2) state.moved = true;
    state.offset.x += dx; state.offset.y += dy;
    var dt = Math.max(8, now - state.lastTime); state.velocity = { x: dx * 16 / dt, y: dy * 16 / dt };
    state.lastPoint = { x: event.clientX, y: event.clientY }; state.lastTime = now; scheduleRender();
  }

  function onPointerUp(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    state.dragging = false; try { els.viewport.releasePointerCapture(event.pointerId); } catch (e) {}
    state.pointerId = null; startInertia(); setTimeout(function(){ state.moved = false; }, 0);
  }

  function onPlayClick() { if (adapter && adapter.togglePlay) adapter.togglePlay(); }
  function onPreviousClick() { if (adapter && adapter.previous) adapter.previous(); }
  function onNextClick() { if (adapter && adapter.next) adapter.next(); }
  function onVolumeClick() { els.volume.parentElement.classList.toggle('open'); }
  function onVolumeInput() { if (adapter && adapter.setVolume) adapter.setVolume(Number(this.value)); }
  function onChatSubmit(event) { event.preventDefault(); var text = els.chatInput.value.trim(); submitChat(text); if (text) els.chatInput.value = ''; }

  function setPlaylist(meta, tracks) {
    state.playlist = meta || null; state.tracks = Array.isArray(tracks) ? tracks.slice() : [];
    els.playlistTitle.textContent = meta && meta.title || '选择一个歌单'; els.empty.hidden = state.tracks.length > 0;
    state.playingIndex = -1; state.nodes.forEach(function(_, index){ releaseNode(index); }); rebuildLayout(0);
  }

  function syncTrack(song, index) {
    els.title.textContent = song && (song.name || song.title) || '选择一张唱片';
    els.artist.textContent = song && song.artist || 'Music Soul';
    var cover = coverFor(song); els.cover.style.backgroundImage = cover ? 'url("' + String(cover).replace(/"/g, '%22') + '")' : stableGradient(song || {});
    var key = songKey(song); state.playingIndex = state.tracks.findIndex(function(track){ return songKey(track) === key; });
    if (state.playingIndex >= 0) selectIndex(state.playingIndex, false); scheduleRender();
  }

  function syncPlayback(isPlaying) {
    state.audible = !!isPlaying; els.player.setAttribute('data-playing', String(state.audible));
    els.play.textContent = state.audible ? 'Ⅱ' : '▶'; scheduleRender();
  }

  function resize() { if (state.mounted) rebuildLayout(state.selectedIndex >= 0 ? state.selectedIndex : 0); }
  function openPicker() { if (adapter && adapter.openPicker) adapter.openPicker(); }
  function submitChat(text) { if (adapter && adapter.submitChat) adapter.submitChat(String(text || '').trim()); }
  function getDebugState() { return { trackCount: state.tracks.length, activeNodes: state.nodes.size, poolSize: state.pool.length, selectedIndex: state.selectedIndex, playingIndex: state.playingIndex }; }

  function mount(nextAdapter) {
    if (state.mounted) return api;
    adapter = nextAdapter; state.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    ['player','disc','cover','tonearm','title','artist','play','prev','next','volume','volumeSlider','chat','chatInput','viewport','grid','empty','playlistTitle'].forEach(function(key){
      var ids = { player:'home-vinyl-player',disc:'home-vinyl-disc',cover:'home-vinyl-cover',tonearm:'home-vinyl-tonearm',title:'home-vinyl-title',artist:'home-vinyl-artist',play:'home-vinyl-play',prev:'home-vinyl-prev',next:'home-vinyl-next',volume:'home-vinyl-volume',volumeSlider:'home-vinyl-volume-slider',chat:'home-vinyl-chat',chatInput:'home-vinyl-chat-input',viewport:'home-vinyl-viewport',grid:'home-vinyl-grid',empty:'home-vinyl-empty',playlistTitle:'home-vinyl-playlist-title' };
      els[key] = document.getElementById(ids[key]);
    });
    if (!els.viewport || !els.grid) return api;
    els.viewport.addEventListener('pointerdown', onPointerDown); els.viewport.addEventListener('pointermove', onPointerMove); els.viewport.addEventListener('pointerup', onPointerUp); els.viewport.addEventListener('pointercancel', onPointerUp);
    els.play.addEventListener('click', onPlayClick); els.prev.addEventListener('click', onPreviousClick); els.next.addEventListener('click', onNextClick);
    els.volume.addEventListener('click', onVolumeClick); els.volumeSlider.addEventListener('input', onVolumeInput); els.chat.addEventListener('submit', onChatSubmit);
    window.addEventListener('resize', resize); state.mounted = true; return api;
  }

  function destroy() {
    cancelAnimationFrame(state.frame); cancelAnimationFrame(state.snapFrame); window.removeEventListener('resize', resize);
    if (els.viewport) { els.viewport.removeEventListener('pointerdown', onPointerDown); els.viewport.removeEventListener('pointermove', onPointerMove); els.viewport.removeEventListener('pointerup', onPointerUp); els.viewport.removeEventListener('pointercancel', onPointerUp); }
    if (els.play) els.play.removeEventListener('click', onPlayClick); if (els.prev) els.prev.removeEventListener('click', onPreviousClick); if (els.next) els.next.removeEventListener('click', onNextClick);
    if (els.volume) els.volume.removeEventListener('click', onVolumeClick); if (els.volumeSlider) els.volumeSlider.removeEventListener('input', onVolumeInput); if (els.chat) els.chat.removeEventListener('submit', onChatSubmit);
    state.nodes.forEach(function(node){ node.remove(); }); state.nodes.clear(); state.pool.length = 0; state.mounted = false;
  }
  var api = { mount:mount, setPlaylist:setPlaylist, syncTrack:syncTrack, syncPlayback:syncPlayback, resize:resize, openPicker:openPicker, submitChat:submitChat, getDebugState:getDebugState, destroy:destroy };
  window.MineradioVinylHome = api;
})();
```

- [ ] **Step 4: Run the tests**

Run: `node test-ai-modules.js`

Expected: `AI helper module tests passed`.

- [ ] **Step 5: Commit the controller**

```powershell
git add public/home-vinyl.js test-ai-modules.js
git commit -m "feat: add virtualized vinyl grid controller"
```

---

### Task 4: Connect Multi-Provider Playlist Selection Without Interrupting Playback

**Files:**
- Modify: `public/index.html`
- Modify: `test-ai-modules.js`

**Interfaces:**
- Consumes: existing `apiJson`, `cloneSong`, `normalizePlaylistProvider`, `playlistPanelProviderId`, `togglePlaylistPanel`, `openPlaylistPanelTab`, and rendered `.pl-card` dataset attributes.
- Produces: `openVinylPlaylistPicker()`, `selectPlaylistForVinylHome(provider, id, title)`, and `fetchVinylPlaylistTracks(provider, id)`.

- [ ] **Step 1: Add failing playlist bridge assertions**

Add inside `testMusicSoulUiContract()`:

```js
  assert.match(html, /var vinylPlaylistPickerActive = false/);
  assert.match(html, /function openVinylPlaylistPicker/);
  assert.match(html, /function fetchVinylPlaylistTracks/);
  assert.match(html, /function selectPlaylistForVinylHome/);
  assert.match(html, /vinylPlaylistPickerActive\) \{/);
  assert.match(html, /MineradioVinylHome\.setPlaylist/);
```

- [ ] **Step 2: Run tests and confirm the bridge is missing**

Run: `node test-ai-modules.js`

Expected: FAIL on `vinylPlaylistPickerActive`.

- [ ] **Step 3: Add playlist-picker state and fetch helpers near the existing playlist panel functions**

Add before `openPlaylistPanelDetail()`:

```js
var vinylPlaylistPickerActive = false;
var vinylPlaylistSelectionToken = 0;
var vinylPlaylistCandidates = [];
var vinylPlaylistMeta = null;

function openVinylPlaylistPicker() {
  vinylPlaylistPickerActive = true;
  openPlaylistPanelTab('playlists', true);
  refreshUserPlaylists();
  showToast('选择一个歌单放入唱片蜂窝');
}

async function fetchVinylPlaylistTracks(provider, pid) {
  provider = normalizePlaylistProvider(provider);
  if (provider === 'qishui') {
    var cached = findQishuiPlaylist(pid);
    return cached && cached.tracks ? cached.tracks.map(cloneSong) : [];
  }
  var endpoint = provider === 'qq'
    ? '/api/qq/playlist/tracks?id='
    : provider === 'kugou'
      ? '/api/kugou/playlist/tracks?id='
      : '/api/playlist/tracks?id=';
  var result = await apiJson(endpoint + encodeURIComponent(pid));
  if (result && result.error) throw new Error(result.error);
  return (result && result.tracks || []).map(cloneSong);
}

async function selectPlaylistForVinylHome(provider, pid, title) {
  var token = ++vinylPlaylistSelectionToken;
  showLoading();
  try {
    var tracks = await fetchVinylPlaylistTracks(provider, pid);
    if (token !== vinylPlaylistSelectionToken) return;
    if (!tracks.length) { showToast('这个歌单暂时没有歌曲'); return; }
    vinylPlaylistCandidates = tracks;
    vinylPlaylistMeta = { provider: normalizePlaylistProvider(provider), id: String(pid), title: title || '我的歌单' };
    vinylPlaylistPickerActive = false;
    togglePlaylistPanel(false);
    setPeek(document.getElementById('playlist-panel'), false, 'pl');
    if (window.MineradioVinylHome) window.MineradioVinylHome.setPlaylist(vinylPlaylistMeta, vinylPlaylistCandidates);
    showToast('唱片蜂窝已载入 ' + tracks.length + ' 首');
  } catch (error) {
    console.warn('[VinylPlaylistSelect]', error);
    showToast('歌单加载失败');
  } finally {
    hideLoading();
  }
}
```

- [ ] **Step 4: Route playlist-card clicks into selection mode**

In the existing `pl-list` delegated click handler, after reading `provider` and `pid` and before `openPlaylistPanelDetail(...)`, insert:

```js
  var playlistTitle = card.getAttribute('data-playlist-title') || '';
  if (vinylPlaylistPickerActive) {
    e.preventDefault();
    e.stopPropagation();
    selectPlaylistForVinylHome(provider, pid, playlistTitle);
    return;
  }
```

Keep the existing normal click behavior unchanged:

```js
  openPlaylistPanelDetail(provider, pid, playlistTitle);
```

- [ ] **Step 5: Run the integration contract tests**

Run: `node test-ai-modules.js`

Expected: `AI helper module tests passed`.

- [ ] **Step 6: Commit playlist selection**

```powershell
git add public/index.html test-ai-modules.js
git commit -m "feat: load playlists into vinyl home"
```

---

### Task 5: Bridge Playback, Tonearm, Volume, and Music Soul Chat

**Files:**
- Modify: `public/index.html`
- Modify: `test-ai-modules.js`

**Interfaces:**
- Consumes: Task 3 controller; existing `playQueueAt`, `togglePlay`, `prevTrack`, `nextTrack`, `setVolume`, `targetVolume`, `queueItemKey`, `coverUrlWithSize`, `openMissPanel`, `sendMissChat`, and `syncPlaybackStateFromAudioEvent`.
- Produces: one mounted adapter, a persistent `vinylHomePlaybackSession` flag, and notifications that always reflect the real audio state.

- [ ] **Step 1: Add failing bridge contract assertions**

Add inside `testMusicSoulUiContract()`:

```js
  assert.match(html, /var vinylHomePlaybackSession = false/);
  assert.match(html, /function createVinylHomeAdapter/);
  assert.match(html, /function syncVinylHomeTrack/);
  assert.match(html, /function initVinylHome/);
  assert.match(html, /preserveHomeState: true/);
  assert.match(html, /MineradioVinylHome\.syncPlayback/);
  assert.match(html, /homeForcedOpen = true/);
```

- [ ] **Step 2: Run tests and confirm the playback bridge is missing**

Run: `node test-ai-modules.js`

Expected: FAIL on `vinylHomePlaybackSession`.

- [ ] **Step 3: Add the application adapter near the home functions**

Add after `sendHomeAiCommand()`:

```js
var vinylHomePlaybackSession = false;

function syncVinylHomeTrack() {
  if (!window.MineradioVinylHome) return;
  var song = currentIdx >= 0 ? playQueue[currentIdx] : null;
  window.MineradioVinylHome.syncTrack(song, currentIdx);
  window.MineradioVinylHome.syncPlayback(!!(audio && audio.src && !audio.paused && !audio.ended));
}

function createVinylHomeAdapter() {
  return {
    songKey: function(song){ return queueItemKey(song || {}); },
    coverFor: function(song){
      if (!song) return '';
      var custom = getCustomCoverForSong(song);
      return custom || (song.cover ? coverUrlWithSize(song.cover, 480) : '');
    },
    openPicker: openVinylPlaylistPicker,
    playCandidate: function(tracks, index, meta) {
      if (!tracks[index]) return Promise.resolve(false);
      vinylHomePlaybackSession = true;
      homeSuppressed = false;
      homeForcedOpen = true;
      playQueue = tracks.map(cloneSong);
      currentIdx = index;
      safeRenderQueuePanel('vinyl-home-select');
      safeSwitchPlaylistTab('queue', 'vinyl-home-select');
      safeShelfRebuild('vinyl-home-select', true);
      return Promise.resolve(playQueueAt(index, { preserveHomeState: true, vinylPlaylist: meta })).then(function(){ syncVinylHomeTrack(); return true; });
    },
    togglePlay: function(){ return togglePlay(); },
    previous: function(){ if (!playQueue.length) return; currentIdx = (currentIdx - 1 + playQueue.length) % playQueue.length; return playQueueAt(currentIdx, { preserveHomeState: true }); },
    next: function(){ if (!playQueue.length) return; currentIdx = (currentIdx + 1) % playQueue.length; return playQueueAt(currentIdx, { preserveHomeState: true }); },
    setVolume: function(value){ setVolume(value, true); },
    submitChat: function(text) {
      if (!text) { openHomeAiDjPanel(); return; }
      if (!openMissPanel()) return;
      var missInput = document.getElementById('miss-input');
      if (missInput) missInput.value = text;
      sendMissChat();
    },
  };
}

function initVinylHome() {
  if (!window.MineradioVinylHome) return;
  window.MineradioVinylHome.mount(createVinylHomeAdapter());
  var slider = document.getElementById('home-vinyl-volume-slider');
  if (slider) slider.value = targetVolume;
  if (vinylPlaylistCandidates.length) window.MineradioVinylHome.setPlaylist(vinylPlaylistMeta, vinylPlaylistCandidates);
  syncVinylHomeTrack();
}
```

After defining `syncVinylHomeTrack()`, extend the successful branch of `selectPlaylistForVinylHome()` so a newly selected candidate list immediately checks whether the real current song exists inside it:

```js
    if (window.MineradioVinylHome) {
      window.MineradioVinylHome.setPlaylist(vinylPlaylistMeta, vinylPlaylistCandidates);
      syncVinylHomeTrack();
    }
```

- [ ] **Step 4: Initialize after both the inline application and external controller exist**

Immediately after loading `home-vinyl.js` at the end of `<body>`, add:

```html
<script>initVinylHome();</script>
```

- [ ] **Step 5: Keep Home visible for the vinyl playback session**

At the beginning of `playQueueAt(idx, opts)`, after `opts = opts || {};`, add:

```js
  if (vinylHomePlaybackSession) opts.preserveHomeState = true;
```

Replace the unconditional home reset inside `playQueueAt`:

```js
  homeForcedOpen = false;
  if (!opts.preserveHomeState) homeSuppressed = false;
```

with:

```js
  if (opts.preserveHomeState) {
    homeSuppressed = false;
    homeForcedOpen = true;
  } else {
    homeForcedOpen = false;
    homeSuppressed = false;
  }
```

In `dismissHomePage(opts)`, clear the session before changing the existing flags:

```js
  vinylHomePlaybackSession = false;
```

Also clear it when entering immersive mode at the existing immersive-mode entry function:

```js
  vinylHomePlaybackSession = false;
```

- [ ] **Step 6: Notify the controller from real playback and track state**

At the end of `syncPlaybackStateFromAudioEvent(reason)`, add:

```js
  if (window.MineradioVinylHome) window.MineradioVinylHome.syncPlayback(isPlaying);
```

At the end of the `safePlaybackStep('track-ui', function(){ ... })` block in `playQueueAt`, add:

```js
    syncVinylHomeTrack();
```

After automatic fallback replaces or advances the queue, call the same sync function immediately after the relevant `currentIdx` assignment:

```js
  syncVinylHomeTrack();
```

This ensures the tonearm only drops after `play`/`playing`, rises for `pause`/`error`/`ended`, and the honeycomb follows the actual fallback track.

- [ ] **Step 7: Mirror external volume changes into the home slider**

At the end of `updateVolumeUi()`, add:

```js
  var homeSlider = document.getElementById('home-vinyl-volume-slider');
  if (homeSlider && Math.abs(parseFloat(homeSlider.value) - targetVolume) > 0.001) homeSlider.value = targetVolume;
```

- [ ] **Step 8: Run the complete Node contract suite**

Run: `node test-ai-modules.js`

Expected: `AI helper module tests passed`.

- [ ] **Step 9: Commit playback and Music Soul integration**

```powershell
git add public/index.html test-ai-modules.js
git commit -m "feat: connect vinyl home playback and ai dj"
```

---

### Task 6: Performance Guardrails, Accessibility, and End-to-End Verification

**Files:**
- Modify: `public/home-vinyl.js`
- Modify: `public/home-vinyl.css`
- Modify: `test-ai-modules.js`

**Interfaces:**
- Consumes: `MineradioVinylHome.getDebugState()`, Electron app startup, existing test suite.
- Produces: verified 0/1/30/300-track behavior, bounded active nodes, keyboard-readable controls, and a clean build.

- [ ] **Step 1: Add regression assertions for accessibility and motion**

Add to `testMusicSoulUiContract()`:

```js
  const vinylCss = fs.readFileSync('public/home-vinyl.css', 'utf8');
  assert.match(html, /role="listbox"/);
  assert.match(html, /aria-label="主页播放器控制"/);
  assert.match(vinylCss, /clip-path:circle\(50% at 50% 50%\)/);
  assert.match(vinylCss, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(vinylCss, /\.home-vinyl-viewport\{[^}]*border:/);
```

- [ ] **Step 2: Run automated tests**

Run: `node test-ai-modules.js`

Expected: `AI helper module tests passed`.

- [ ] **Step 3: Start the Electron app for manual verification**

Run: `npm start`

Expected: Electron opens without a console syntax error; Home shows the new 40:60 layout.

- [ ] **Step 4: Verify the approved visual layout at normal and minimum size**

Check at the normal window size and at 960×540:

1. Left/right remain 40:60 with no horizontal scrollbar.
2. Left sections visually occupy 20/70/10.
3. Avatar is circular; weather, time, Music DNA, “我的音乐”, and “接着听” cards are absent.
4. Right discs are visible only inside the borderless circle and naturally clip/fade at the circumference.
5. Only previous, play/pause, next, and volume appear under the main disc.

Expected: all five checks pass without overlap or clipped controls.

- [ ] **Step 5: Verify playlist and playback state flow**

Use one playlist from each logged-in provider that is available:

1. Click “切换歌单”; select a playlist; confirm existing audio continues.
2. Click a visible disc; confirm it snaps to center, adopts the playlist as queue, and starts playback.
3. Confirm the left cover/title/artist update and the tonearm drops only after audio starts.
4. Pause; confirm both disc rotation and tonearm update.
5. Use previous/next and let one track end; confirm Home remains visible and the correct disc centers.
6. Trigger an unavailable track if present; confirm automatic source fallback/skip centers the final real song.

Expected: no stale title, false playing glow, or unexpected Home dismissal.

- [ ] **Step 6: Verify virtualization and pointer behavior**

Load playlists containing 1, about 30, and more than 200 songs. In DevTools run:

```js
const vinylDebug = window.MineradioVinylHome.getDebugState();
console.table(vinylDebug);
console.assert(vinylDebug.trackCount > 200, 'the complete large playlist must stay in logical state');
console.assert(vinylDebug.activeNodes > 0 && vinylDebug.activeNodes < 120, 'active DOM discs must remain virtualized');
```

Expected for the large playlist: both assertions pass, `trackCount` equals the real playlist length, and `activeNodes` remains below 120 in a normal-size viewport.

Drag horizontally and vertically, release for inertia/snap, then click a disc without dragging. Expected: drag never accidentally starts playback; click always centers and plays exactly one song.

- [ ] **Step 7: Verify reduced motion and fallback visuals**

Enable Windows “Animation effects” off or emulate `prefers-reduced-motion: reduce`, reload, and repeat one drag/click.

Expected: no inertial coast, spring bounce, pulsing glow, or continuous spin; snap remains a short controlled transition. For a track without a cover, a stable gradient disc appears instead of a broken image.

- [ ] **Step 8: Build the Windows package**

Run: `npm run build`

Expected: exit code 0 and a refreshed `dist/Mineradio-Setup-1.3.5.exe` without missing `home-vinyl.css`, `home-vinyl-layout.js`, or `home-vinyl.js` warnings.

- [ ] **Step 9: Inspect final repository state and commit verification refinements**

Run:

```powershell
git status --short
git diff --check
```

Expected: only the intended Task 6 files are modified and `git diff --check` prints nothing.

Commit:

```powershell
git add public/home-vinyl.js public/home-vinyl.css test-ai-modules.js
git commit -m "test: verify vinyl honeycomb home"
```

---

## Final Acceptance Checklist

- [ ] All 15 acceptance criteria in `docs/superpowers/specs/2026-07-06-album-honeycomb-home-design.md` are demonstrated.
- [ ] `node test-ai-modules.js` passes.
- [ ] `npm start` opens the redesigned Home without runtime errors.
- [ ] `npm run build` produces the Windows installer successfully.
- [ ] `git status --short` is clean after the final commit.
