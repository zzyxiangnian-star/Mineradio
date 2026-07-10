const assert = require('node:assert/strict');
const test = require('node:test');

const { createTaskbarThumbnailBridge } = require('../src/desktop/taskbarThumbnailBridge');

test('attaches once and forwards BGRA pixels', () => {
  const calls = [];
  const native = {
    attach: hwnd => { calls.push(['attach', hwnd.length]); return true; },
    updateBitmap: (buffer, width, height) => {
      calls.push(['update', buffer.length, width, height]);
      return true;
    },
    clearBitmap: () => true,
    detach: () => true,
  };
  const bridge = createTaskbarThumbnailBridge({ platform: 'win32', nativeBinding: native });

  assert.equal(bridge.attach(Buffer.alloc(8)), true);
  assert.equal(bridge.attach(Buffer.alloc(8)), true);
  assert.equal(bridge.update({
    getSize: () => ({ width: 2, height: 2 }),
    toBitmap: () => Buffer.alloc(16),
  }), true);
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
    nativeBinding: {
      attach: () => true,
      updateBitmap: () => true,
      clearBitmap: () => true,
      detach: () => true,
    },
  });
  bridge.attach(Buffer.alloc(8));

  assert.equal(bridge.update({
    getSize: () => ({ width: 2, height: 2 }),
    toBitmap: () => Buffer.alloc(3),
  }), false);
});

test('clears and detaches idempotently while logging a native failure once', () => {
  const warnings = [];
  const bridge = createTaskbarThumbnailBridge({
    platform: 'win32',
    logger: { warn: (...args) => warnings.push(args) },
    nativeBinding: {
      attach: () => true,
      updateBitmap: () => { throw new Error('native update failed'); },
      clearBitmap: () => true,
      detach: () => true,
    },
  });
  bridge.attach(Buffer.alloc(8));

  const image = {
    getSize: () => ({ width: 1, height: 1 }),
    toBitmap: () => Buffer.alloc(4),
  };
  assert.equal(bridge.update(image), false);
  assert.equal(bridge.update(image), false);
  assert.equal(bridge.clear(), true);
  assert.equal(bridge.detach(), true);
  assert.equal(bridge.detach(), true);
  assert.equal(warnings.length, 1);
});
