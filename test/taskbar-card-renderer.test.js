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
