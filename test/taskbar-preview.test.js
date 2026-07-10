const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeTaskbarPreviewState,
  taskbarClipForPreview,
  taskbarPreviewStateKey,
  validateTaskbarBitmapPayload,
} = require('../src/desktop/taskbarPreview');

test('normalizes taskbar preview state from the current song payload', () => {
  const state = normalizeTaskbarPreviewState({
    title: 'One Time',
    artist: 'Justin Bieber',
    cover: 'https://example.test/cover.jpg',
    playing: true,
    queueLength: 12,
  });

  assert.deepEqual(state, {
    title: 'One Time',
    artist: 'Justin Bieber',
    cover: 'https://example.test/cover.jpg',
    playing: true,
    hasTrack: true,
    tooltip: 'One Time - Justin Bieber',
    queueLength: 12,
  });
});

test('falls back to Mineradio state when no track is active', () => {
  const state = normalizeTaskbarPreviewState({
    title: '',
    artist: '',
    cover: '',
    playing: false,
    hasTrack: false,
  });

  assert.equal(state.title, 'Mineradio');
  assert.equal(state.artist, '');
  assert.equal(state.cover, '');
  assert.equal(state.playing, false);
  assert.equal(state.hasTrack, false);
  assert.equal(state.tooltip, 'Mineradio');
});

test('calculates a centered preview clip with stable bounds', () => {
  assert.deepEqual(taskbarClipForPreview({ width: 1280, height: 720 }), {
    x: 480,
    y: 168,
    width: 320,
    height: 384,
  });

  assert.deepEqual(taskbarClipForPreview({ width: 240, height: 180 }), {
    x: 0,
    y: 0,
    width: 240,
    height: 180,
  });
});

test('keys every field that changes the taskbar card', () => {
  const base = normalizeTaskbarPreviewState({
    title: 'Song A',
    artist: 'Artist A',
    cover: 'a.jpg',
    playing: false,
    hasTrack: true,
    queueLength: 2,
  });

  assert.notEqual(taskbarPreviewStateKey(base), taskbarPreviewStateKey({ ...base, playing: true }));
  assert.notEqual(taskbarPreviewStateKey(base), taskbarPreviewStateKey({ ...base, cover: 'b.jpg' }));
});

test('accepts a bounded PNG data URL payload', () => {
  const payload = validateTaskbarBitmapPayload({
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    width: 640,
    height: 768,
  });

  assert.deepEqual(payload, {
    dataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    width: 640,
    height: 768,
  });
});

test('rejects malformed or oversized taskbar bitmaps', () => {
  assert.throws(
    () => validateTaskbarBitmapPayload({ dataUrl: 'https://x/a.png', width: 640, height: 768 }),
    /PNG data URL/,
  );
  assert.throws(
    () => validateTaskbarBitmapPayload({ dataUrl: 'data:image/png;base64,AA==', width: 4097, height: 768 }),
    /dimensions/,
  );
});
