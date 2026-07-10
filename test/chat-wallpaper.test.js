const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');

const {
  CHAT_WALLPAPER_IMAGE_EXTENSIONS,
  chatWallpaperDir,
  chatWallpaperPathForExt,
  isSupportedChatWallpaperImage,
  toChatWallpaperInfo,
} = require('../src/desktop/chatWallpaper');

test('accepts common image extensions for Music Soul chat wallpaper', () => {
  assert.equal(isSupportedChatWallpaperImage('cover.jpg'), true);
  assert.equal(isSupportedChatWallpaperImage('cover.jpeg'), true);
  assert.equal(isSupportedChatWallpaperImage('cover.png'), true);
  assert.equal(isSupportedChatWallpaperImage('cover.webp'), true);
  assert.equal(isSupportedChatWallpaperImage('cover.gif'), true);
  assert.equal(isSupportedChatWallpaperImage('cover.mp4'), false);
});

test('builds stable persisted wallpaper path under user data', () => {
  const userData = path.join('C:', 'Users', 'someone', 'AppData', 'Roaming', 'Mineradio');
  assert.equal(chatWallpaperDir(userData), path.join(userData, 'chat-wallpapers'));
  assert.equal(chatWallpaperPathForExt(userData, '.PNG'), path.join(userData, 'chat-wallpapers', 'music-soul-chat-wallpaper.png'));
});

test('returns renderable chat wallpaper metadata', () => {
  const filePath = path.join('C:', 'Users', 'someone', 'Pictures', 'ms.png');
  const info = toChatWallpaperInfo(filePath, 'ms.png');
  assert.equal(info.name, 'ms.png');
  assert.equal(info.path, filePath);
  assert.equal(info.url.startsWith('file:///'), true);
  assert.equal(CHAT_WALLPAPER_IMAGE_EXTENSIONS.has('.png'), true);
});
