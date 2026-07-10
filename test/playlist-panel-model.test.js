const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildInlinePlaylistPanelModel,
  playlistPanelKey,
} = require('../src/desktop/playlistPanelModel');

test('builds one playlist node with inline detail for the expanded playlist', () => {
  const playlists = [
    { id: '100', provider: 'netease', name: 'to-live-mi喜欢的音乐', trackCount: 232, creator: 'to-live-mi' },
    { id: '200', provider: 'kugou', name: '酷狗收藏', trackCount: 12, creator: 'me' },
  ];
  const model = buildInlinePlaylistPanelModel(playlists, {
    key: 'netease:100',
    loading: false,
    tracks: [
      { name: '半句再见', artist: '孙燕姿' },
      { name: '雨天', artist: '孙燕姿' },
    ],
    renderLimit: 36,
  });

  assert.equal(model.items.length, 2);
  assert.equal(model.items.filter((item) => item.key === 'netease:100').length, 1);
  assert.equal(model.items[0].expanded, true);
  assert.equal(model.items[0].inlineDetail.headerMode, 'actions-only');
  assert.equal(model.items[0].inlineDetail.visibleTracks.length, 2);
  assert.equal(model.items[1].expanded, false);
  assert.equal(model.items[1].inlineDetail, null);
});

test('uses provider prefixes consistently for playlist keys', () => {
  assert.equal(playlistPanelKey('netease', '42'), 'netease:42');
  assert.equal(playlistPanelKey('qq', '42'), 'qq:42');
  assert.equal(playlistPanelKey('kugou', '42'), 'kugou:42');
  assert.equal(playlistPanelKey('qishui', '42'), 'qishui:42');
});
