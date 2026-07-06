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
    lastTime: 0,
    frame: 0,
    motionFrame: 0,
    nodes: new Map(),
    pool: [],
    reducedMotion: false,
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
    return Math.max(56, Math.min(104, metrics.radius * 0.29));
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
    node.addEventListener('click', function() {
      if (state.moved) return;
      var index = Number(node.getAttribute('data-index'));
      if (Number.isFinite(index)) selectIndex(index, true);
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

  function selectIndex(index, autoplay) {
    if (!state.layout || !state.tracks[index]) return;
    state.selectedIndex = index;
    var metrics = viewportMetrics();
    var target = Layout.snapOffsetForIndex(state.layout.items, index, { x: metrics.width / 2, y: metrics.height / 2 });
    animateToOffset(target, function() {
      if (autoplay && adapter && adapter.playCandidate) adapter.playCandidate(state.tracks, index, state.playlist);
    });
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
    cancelMotion();
    state.dragging = true;
    state.moved = false;
    state.pointerId = event.pointerId;
    state.lastPoint = { x: event.clientX, y: event.clientY };
    state.lastTime = performance.now();
    state.velocity = { x: 0, y: 0 };
    els.viewport.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event) {
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    var now = performance.now();
    var dx = event.clientX - state.lastPoint.x;
    var dy = event.clientY - state.lastPoint.y;
    if (Math.hypot(dx, dy) > 2) state.moved = true;
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
    state.dragging = false;
    try { els.viewport.releasePointerCapture(event.pointerId); } catch (error) {}
    state.pointerId = null;
    startInertia();
    setTimeout(function(){ state.moved = false; }, 0);
  }

  function onPlayClick() { if (adapter && adapter.togglePlay) adapter.togglePlay(); }
  function onPreviousClick() { if (adapter && adapter.previous) adapter.previous(); }
  function onNextClick() { if (adapter && adapter.next) adapter.next(); }
  function onVolumeClick() { els.volume.parentElement.classList.toggle('open'); }
  function onVolumeInput() { if (adapter && adapter.setVolume) adapter.setVolume(Number(this.value)); }
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
    els.title.textContent = song && (song.name || song.title) || '选择一张唱片';
    els.artist.textContent = song && song.artist || 'Music Soul';
    els.cover.style.opacity = '0';
    setTimeout(function() {
      els.cover.style.backgroundImage = coverBackground(song || {});
      els.cover.style.opacity = '1';
    }, state.reducedMotion ? 0 : 120);
    var key = songKey(song);
    state.playingIndex = state.tracks.findIndex(function(track){ return songKey(track) === key; });
    if (state.playingIndex >= 0) selectIndex(state.playingIndex, false);
    else scheduleRender();
  }

  function syncPlayback(isPlaying) {
    state.audible = !!isPlaying;
    els.player.setAttribute('data-playing', String(state.audible));
    els.play.textContent = state.audible ? 'Ⅱ' : '▶';
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
    };
  }

  function mount(nextAdapter) {
    if (state.mounted || !Layout) return api;
    adapter = nextAdapter || {};
    var ids = {
      player:'home-vinyl-player', cover:'home-vinyl-cover', title:'home-vinyl-title', artist:'home-vinyl-artist',
      play:'home-vinyl-play', prev:'home-vinyl-prev', next:'home-vinyl-next', volume:'home-vinyl-volume',
      volumeSlider:'home-vinyl-volume-slider', chat:'home-vinyl-chat', chatInput:'home-vinyl-chat-input',
      viewport:'home-vinyl-viewport', grid:'home-vinyl-grid', empty:'home-vinyl-empty', playlistTitle:'home-vinyl-playlist-title',
    };
    Object.keys(ids).forEach(function(key){ els[key] = document.getElementById(ids[key]); });
    if (!els.viewport || !els.grid || !els.player) return api;
    motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    state.reducedMotion = motionQuery.matches;
    els.viewport.addEventListener('pointerdown', onPointerDown);
    els.viewport.addEventListener('pointermove', onPointerMove);
    els.viewport.addEventListener('pointerup', onPointerUp);
    els.viewport.addEventListener('pointercancel', onPointerUp);
    els.play.addEventListener('click', onPlayClick);
    els.prev.addEventListener('click', onPreviousClick);
    els.next.addEventListener('click', onNextClick);
    els.volume.addEventListener('click', onVolumeClick);
    els.volumeSlider.addEventListener('input', onVolumeInput);
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
    }
    if (els.play) els.play.removeEventListener('click', onPlayClick);
    if (els.prev) els.prev.removeEventListener('click', onPreviousClick);
    if (els.next) els.next.removeEventListener('click', onNextClick);
    if (els.volume) els.volume.removeEventListener('click', onVolumeClick);
    if (els.volumeSlider) els.volumeSlider.removeEventListener('input', onVolumeInput);
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
