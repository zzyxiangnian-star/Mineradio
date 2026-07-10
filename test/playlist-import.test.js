const assert = require('node:assert/strict');
const test = require('node:test');

const {
  detectPlaylistImportUrl,
} = require('../src/desktop/playlistImport');

test('detects Qishui share links', () => {
  assert.deepEqual(detectPlaylistImportUrl('https://qishui.douyin.com/s/abc123/'), {
    provider: 'qishui',
    id: '',
    url: 'https://qishui.douyin.com/s/abc123/',
  });
});

test('detects Kugou playlist links', () => {
  assert.deepEqual(detectPlaylistImportUrl('https://www.kugou.com/yy/special/single/123456.html'), {
    provider: 'kugou',
    id: '123456',
    url: 'https://www.kugou.com/yy/special/single/123456.html',
  });
});

test('detects NetEase playlist links', () => {
  assert.deepEqual(detectPlaylistImportUrl('https://music.163.com/#/playlist?id=98765'), {
    provider: 'netease',
    id: '98765',
    url: 'https://music.163.com/#/playlist?id=98765',
  });
});

test('detects QQ playlist links', () => {
  assert.deepEqual(detectPlaylistImportUrl('https://y.qq.com/n/ryqq/playlist/7722'), {
    provider: 'qq',
    id: '7722',
    url: 'https://y.qq.com/n/ryqq/playlist/7722',
  });
});

test('rejects malformed or unsupported links', () => {
  assert.equal(detectPlaylistImportUrl('not a url').provider, 'unsupported');
  assert.equal(detectPlaylistImportUrl('https://example.com/playlist/1').provider, 'unsupported');
});
