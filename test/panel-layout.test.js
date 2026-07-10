const assert = require('node:assert/strict');
const test = require('node:test');

const {
  isRightEdgeChatTrigger,
  isChatPanelHover,
  shouldKeepChatOpenAtPointer,
} = require('../src/desktop/panelLayout');

test('right edge chat trigger only activates inside the vertical safe band', () => {
  assert.equal(isRightEdgeChatTrigger(1900, 500, 1920, 1080), true);
  assert.equal(isRightEdgeChatTrigger(1860, 500, 1920, 1080), false);
  assert.equal(isRightEdgeChatTrigger(1900, 40, 1920, 1080), false);
  assert.equal(isRightEdgeChatTrigger(1900, 1000, 1920, 1080), false);
});

test('chat panel hover keeps the panel open with a small padding bridge', () => {
  const rect = { left: 1360, right: 1880, top: 140, bottom: 920 };
  assert.equal(isChatPanelHover(1340, 500, rect), true);
  assert.equal(isChatPanelHover(1200, 500, rect), false);
});

test('chat stays open from either edge trigger or panel hover', () => {
  const rect = { left: 1360, right: 1880, top: 140, bottom: 920 };
  assert.equal(shouldKeepChatOpenAtPointer(1900, 500, 1920, 1080, rect), true);
  assert.equal(shouldKeepChatOpenAtPointer(1350, 500, 1920, 1080, rect), true);
  assert.equal(shouldKeepChatOpenAtPointer(900, 500, 1920, 1080, rect), false);
});
