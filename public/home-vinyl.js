(function() {
  'use strict';

  var Layout = window.MineradioVinylLayout;
  var adapter = null;
  var els = {};
  var resizeObserver = null;
  var motionQuery = null;
  var state = {
    mounted: false,
    tracks: [],
    playlist: null,
    layout: null,
    offset: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    selectedIndex: -1,
    playingIndex: -1,
    audible: false,
    dragging: false,
    moved: false,
    pointerId: null,
    lastPoint: null,
    downPoint: null,
    downIndex: -1,
    suppressNextClick: false,
    lastTime: 0,
    frame: 0,
    motionFrame: 0,
    nodes: new Map(),
    pool: [],
    reducedMotion: false,
    zoom: 1,
    minZoom: .72,
    maxZoom: 2.35,
  };

  function songKey(song) {
    if (adapter && adapter.songKey) return adapter.songKey(song);
    return [song && song.source, song && song.id, song && song.mid, song && song.name, song && song.artist].filter(Boolean).join(':');
  }

  function stableGradient(song) {
    var text = songKey(song) || 'mineradio';
    var hash = 0;
    for (var i = 0; i < text.length; i++) hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    var first = Math.abs(hash) % 360;
    var second = (first + 76 + Math.abs(hash >> 8) % 80) % 360;
    return 'linear-gradient(145deg,hsl(' + first + ' 56% 38%),hsl(' + second + ' 62% 56%))';
  }

  function coverFor(song) {
    return adapter && adapter.coverFor ? adapter.coverFor(song) : (song && song.cover || '');
  }

  function coverBackground(song) {
    var cover = coverFor(song);
    return cover ? 'url("' + String(cover).replace(/"/g, '%22') + '")' : stableGradient(song || {});
  }

  function viewportMetrics() {
    var rect = els.viewport ? els.viewport.getBoundingClientRect() : { width: 0, height: 0 };
    var width = Math.max(1, rect.width || 1);
    var height = Math.max(1, rect.height || 1);
    return {
      width: width,
      height: height,
      radius: Math.min(width, height) / 2,
      overscan: Math.max(84, state.layout ? state.layout.iconSize : 84),
    };
  }

  function iconSizeForViewport(metrics) {
    var base = Math.max(52, Math.min(88, metrics.radius * 0.22));
    return Math.round(base * state.zoom);
  }

  function releaseNode(index) {
    var node = state.nodes.get(index);
    if (!node) return;
    state.nodes.delete(index);
    node.hidden = true;
    node.removeAttribute('data-index');
    state.pool.push(node);
  }

  function createNode() {
    var node = document.createElement('button');
    node.type = 'button';
    node.className = 'home-vinyl-disc';
    node.setAttribute('role', 'option');
    node.addEventListener('click', function(event) {
      event.preventDefault();
      event.stopPropagation();
      if (state.suppressNextClick) {
        state.suppressNextClick = false;
        return;
      }
      if (state.moved) return;
      var index = Number(node.getAttribute('data-index'));
      if (Number.isFinite(index)) {
        state.selectedIndex = index;
        playIndex(index);
        scheduleRender();
      }
    });
    return node;
  }

  function bindNode(node, index) {
    var song = state.tracks[index] || {};
    var label = (song.name || song.title || '未知歌曲') + ' · ' + (song.artist || '未知歌手');
    node.hidden = false;
    node.setAttribute('data-index', String(index));
    node.setAttribute('aria-label', label);
    node.style.backgroundImage = coverBackground(song);
    node.title = label;
  }

  function acquireNode(index) {
    var node = state.nodes.get(index);
    if (node) return node;
    node = state.pool.pop() || createNode();
    bindNode(node, index);
    els.grid.appendChild(node);
    state.nodes.set(index, node);
    return node;
  }

  function renderFrame() {
    state.frame = 0;
    if (!state.layout || !state.tracks.length || !els.viewport) return;
    var metrics = viewportMetrics();
    var visible = new Set(Layout.visibleIndices(state.layout.items, state.offset, metrics));
    Array.from(state.nodes.keys()).forEach(function(index) {
      if (!visible.has(index)) releaseNode(index);
    });
    visible.forEach(function(index) {
      var item = state.layout.items[index];
      var node = acquireNode(index);
      var x = item.x + state.offset.x;
      var y = item.y + state.offset.y;
      var visual = Layout.visualForPoint(x - metrics.width / 2, y - metrics.height / 2, metrics.radius);
      var size = state.layout.iconSize;
      node.style.width = size + 'px';
      node.style.height = size + 'px';
      node.style.transform = 'translate3d(' + (x - size / 2) + 'px,' + (y - size / 2) + 'px,0) scale(' + visual.scale + ')';
      node.style.opacity = visual.opacity;
      node.style.zIndex = visual.zIndex;
      node.classList.toggle('is-playing', index === state.playingIndex);
      node.classList.toggle('is-audible', index === state.playingIndex && state.audible);
      node.setAttribute('aria-selected', index === state.selectedIndex ? 'true' : 'false');
    });
  }

  function scheduleRender() {
    if (!state.frame) state.frame = requestAnimationFrame(renderFrame);
  }

  function rebuildLayout(focusIndex) {
    if (!state.mounted || !els.viewport) return;
    var metrics = viewportMetrics();
    state.layout = Layout.buildHexLayout(state.tracks.length, iconSizeForViewport(metrics));
    if (!state.tracks.length) {
      state.offset = { x: metrics.width / 2, y: metrics.height / 2 };
      state.selectedIndex = -1;
      scheduleRender();
      return;
    }
    var index = Math.max(0, Math.min(state.tracks.length - 1, Number(focusIndex) || 0));
    state.offset = Layout.snapOffsetForIndex(state.layout.items, index, { x: metrics.width / 2, y: metrics.height / 2 });
    state.selectedIndex = index;
    scheduleRender();
  }

  function cancelMotion() {
    if (state.motionFrame) cancelAnimationFrame(state.motionFrame);
    state.motionFrame = 0;
  }

  function animateToOffset(target, onDone) {
    cancelMotion();
    if (state.reducedMotion) {
      state.offset = target;
      scheduleRender();
      if (onDone) onDone();
      return;
    }
    var start = { x: state.offset.x, y: state.offset.y };
    var started = performance.now();
    function step(now) {
      var progress = Math.min(1, (now - started) / 420);
      var eased = 1 - Math.pow(1 - progress, 4);
      state.offset.x = start.x + (target.x - start.x) * eased;
      state.offset.y = start.y + (target.y - start.y) * eased;
      scheduleRender();
      if (progress < 1) state.motionFrame = requestAnimationFrame(step);
      else {
        state.motionFrame = 0;
        if (onDone) onDone();
      }
    }
    state.motionFrame = requestAnimationFrame(step);
  }

  function playIndex(index) {
    if (!adapter || !adapter.playCandidate || !state.tracks[index]) return;
    adapter.playCandidate(state.tracks, index, state.playlist);
  }

  function selectIndex(index, autoplay) {
    if (!state.layout || !state.tracks[index]) return;
    state.selectedIndex = index;
    var metrics = viewportMetrics();
    var target = Layout.snapOffsetForIndex(state.layout.items, index, { x: metrics.width / 2, y: metrics.height / 2 });
    animateToOffset(target);
    if (autoplay) playIndex(index);
  }

  function settleToNearest() {
    if (!state.layout) return;
    var metrics = viewportMetrics();
    var nearest = Layout.nearestIndex(state.layout.items, state.offset, { x: metrics.width / 2, y: metrics.height / 2 });
    selectIndex(nearest, false);
  }

  function startInertia() {
    cancelMotion();
    if (state.reducedMotion) {
      settleToNearest();
      return;
    }
    function step() {
      state.velocity.x *= .92;
      state.velocity.y *= .92;
      var proposed = { x: state.offset.x + state.velocity.x, y: state.offset.y + state.velocity.y };
      var clamped = Layout.clampOffset(proposed, state.layout, viewportMetrics());
      if (Math.abs(clamped.x - proposed.x) > .1) state.velocity.x *= -.32;
      if (Math.abs(clamped.y - proposed.y) > .1) state.velocity.y *= -.32;
      state.offset = clamped;
      scheduleRender();
      if (Math.hypot(state.velocity.x, state.velocity.y) > .55) state.motionFrame = requestAnimationFrame(step);
      else {
        state.motionFrame = 0;
        settleToNearest();
      }
    }
    state.motionFrame = requestAnimationFrame(step);
  }

  function onPointerDown(event) {
    if (!state.tracks.length || event.button > 0) return;
    event.preventDefault();
    event.stopPropagation();
    cancelMotion();
    var disc = event.target && event.target.closest ? event.target.closest('.home-vinyl-disc') : null;
    state.dragging = true;
    state.moved = false;
    state.pointerId = event.pointerId;
    state.lastPoint = { x: event.clientX, y: event.clientY };
    state.downPoint = { x: event.clientX, y: event.clientY };
    state.downIndex = disc ? Number(disc.getAttribute('data-index')) : -1;
    state.lastTime = performance.now();
    state.velocity = { x: 0, y: 0 };
    els.viewport.setAttribute('data-dragging', 'true');
    els.viewport.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    event.stopPropagation();
    var now = performance.now();
    var dx = event.clientX - state.lastPoint.x;
    var dy = event.clientY - state.lastPoint.y;
    var movedX = state.downPoint ? event.clientX - state.downPoint.x : dx;
    var movedY = state.downPoint ? event.clientY - state.downPoint.y : dy;
    if (Math.hypot(movedX, movedY) > 6) state.moved = true;
    var proposed = { x: state.offset.x + dx, y: state.offset.y + dy };
    var clamped = Layout.clampOffset(proposed, state.layout, viewportMetrics());
    state.offset.x = proposed.x === clamped.x ? proposed.x : state.offset.x + dx * .34;
    state.offset.y = proposed.y === clamped.y ? proposed.y : state.offset.y + dy * .34;
    var dt = Math.max(8, now - state.lastTime);
    state.velocity = { x: dx * 16 / dt, y: dy * 16 / dt };
    state.lastPoint = { x: event.clientX, y: event.clientY };
    state.lastTime = now;
    scheduleRender();
  }

  function onPointerUp(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    var clickIndex = !state.moved && Number.isFinite(state.downIndex) ? state.downIndex : -1;
    state.dragging = false;
    try { els.viewport.releasePointerCapture(event.pointerId); } catch (error) {}
    state.pointerId = null;
    state.downPoint = null;
    state.downIndex = -1;
    els.viewport.removeAttribute('data-dragging');
    if (clickIndex >= 0) {
      state.velocity = { x: 0, y: 0 };
      state.suppressNextClick = true;
      state.selectedIndex = clickIndex;
      playIndex(clickIndex);
      scheduleRender();
    } else {
      startInertia();
    }
    setTimeout(function(){ state.moved = false; }, 0);
  }

  function onWheel(event) {
    if (!state.tracks.length) return;
    event.preventDefault();
    event.stopPropagation();
    var nextZoom = state.zoom * (event.deltaY > 0 ? .92 : 1.08);
    nextZoom = Math.max(state.minZoom, Math.min(state.maxZoom, nextZoom));
    if (Math.abs(nextZoom - state.zoom) < .005) return;
    var focus = state.selectedIndex >= 0 ? state.selectedIndex : 0;
    if (state.layout) {
      var metrics = viewportMetrics();
      focus = Layout.nearestIndex(state.layout.items, state.offset, { x: metrics.width / 2, y: metrics.height / 2 });
    }
    state.zoom = nextZoom;
    Array.from(state.nodes.keys()).forEach(releaseNode);
    rebuildLayout(focus);
  }

  function onChatSubmit(event) {
    event.preventDefault();
    var text = els.chatInput.value.trim();
    submitChat(text);
    if (text) els.chatInput.value = '';
  }
  function onMotionPreference(event) { state.reducedMotion = !!event.matches; if (state.reducedMotion) cancelMotion(); }

  function setPlaylist(meta, tracks) {
    state.playlist = meta || null;
    state.tracks = Array.isArray(tracks) ? tracks.slice() : [];
    state.playingIndex = -1;
    els.playlistTitle.textContent = meta && meta.title || '选择一个歌单';
    els.empty.hidden = state.tracks.length > 0;
    Array.from(state.nodes.keys()).forEach(releaseNode);
    rebuildLayout(0);
  }

  function syncTrack(song) {
    var key = songKey(song);
    state.playingIndex = state.tracks.findIndex(function(track){ return songKey(track) === key; });
    if (state.playingIndex >= 0) state.selectedIndex = state.playingIndex;
    scheduleRender();
  }

  function syncPlayback(isPlaying) {
    state.audible = !!isPlaying;
    scheduleRender();
  }

  function resize() {
    if (state.mounted) rebuildLayout(state.selectedIndex >= 0 ? state.selectedIndex : 0);
  }

  function openPicker() {
    if (adapter && adapter.openPicker) adapter.openPicker();
  }

  function submitChat(text) {
    if (adapter && adapter.submitChat) adapter.submitChat(String(text || '').trim());
  }

  function getDebugState() {
    return {
      trackCount: state.tracks.length,
      activeNodes: state.nodes.size,
      poolSize: state.pool.length,
      selectedIndex: state.selectedIndex,
      playingIndex: state.playingIndex,
      zoom: state.zoom,
      iconSize: state.layout ? state.layout.iconSize : 0,
    };
  }

  function mount(nextAdapter) {
    if (state.mounted || !Layout) return api;
    adapter = nextAdapter || {};
    var ids = {
      chat:'home-vinyl-chat', chatInput:'home-vinyl-chat-input',
      viewport:'home-vinyl-viewport', grid:'home-vinyl-grid', empty:'home-vinyl-empty', playlistTitle:'home-vinyl-playlist-title',
    };
    Object.keys(ids).forEach(function(key){ els[key] = document.getElementById(ids[key]); });
    if (!els.viewport || !els.grid || !els.chat || !els.chatInput) return api;
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    state.reducedMotion = motionQuery.matches;
    els.viewport.addEventListener('pointerdown', onPointerDown);
    els.viewport.addEventListener('pointermove', onPointerMove);
    els.viewport.addEventListener('pointerup', onPointerUp);
    els.viewport.addEventListener('pointercancel', onPointerUp);
    els.viewport.addEventListener('wheel', onWheel, { passive: false });
    els.chat.addEventListener('submit', onChatSubmit);
    window.addEventListener('resize', resize);
    if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionPreference);
    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(function(){ resize(); });
      resizeObserver.observe(els.viewport);
    }
    state.mounted = true;
    rebuildLayout(0);
    return api;
  }

  function destroy() {
    cancelMotion();
    if (state.frame) cancelAnimationFrame(state.frame);
    window.removeEventListener('resize', resize);
    if (resizeObserver) resizeObserver.disconnect();
    if (motionQuery && motionQuery.removeEventListener) motionQuery.removeEventListener('change', onMotionPreference);
    if (els.viewport) {
      els.viewport.removeEventListener('pointerdown', onPointerDown);
      els.viewport.removeEventListener('pointermove', onPointerMove);
      els.viewport.removeEventListener('pointerup', onPointerUp);
      els.viewport.removeEventListener('pointercancel', onPointerUp);
      els.viewport.removeEventListener('wheel', onWheel);
    }
    if (els.chat) els.chat.removeEventListener('submit', onChatSubmit);
    state.nodes.forEach(function(node){ node.remove(); });
    state.nodes.clear();
    state.pool.length = 0;
    state.mounted = false;
  }

  var api = {
    mount: mount,
    setPlaylist: setPlaylist,
    syncTrack: syncTrack,
    syncPlayback: syncPlayback,
    resize: resize,
    openPicker: openPicker,
    submitChat: submitChat,
    getDebugState: getDebugState,
    destroy: destroy,
  };
  window.MineradioVinylHome = api;
})();
