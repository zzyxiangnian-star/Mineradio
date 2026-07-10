const assert = require('node:assert/strict');
const test = require('node:test');

const {
  normalizeKugouSong,
  scoreKugouSongMatch,
} = require('../src/desktop/kugouMatch');

test('normalizes Kugou song fields from mixed raw payloads', () => {
  const song = normalizeKugouSong({
    filename: '孙燕姿 - 遇见.flac',
    hash: 'ABC',
    mixsongid: '991',
    album_id: '88',
    album_name: 'The Moment',
    sizable_cover: 'https://img/{size}.jpg',
    timelength: 241000,
  });

  assert.equal(song.name, '遇见');
  assert.equal(song.artist, '孙燕姿');
  assert.equal(song.hash, 'ABC');
  assert.equal(song.albumAudioId, '991');
  assert.equal(song.albumId, '88');
  assert.equal(song.album, 'The Moment');
  assert.equal(song.cover, 'https://img/300.jpg');
  assert.equal(song.duration, 241000);
  assert.equal(song.playable, true);
});

test('keeps mixed identifiers when hash is missing', () => {
  const song = normalizeKugouSong({
    songname: '雨天',
    singername: '孙燕姿',
    mixsongid: 'mix-1',
    albumid: 'album-1',
    imgurl: 'https://img/cover.jpg',
  });

  assert.equal(song.id, 'mix-1');
  assert.equal(song.hash, '');
  assert.equal(song.albumAudioId, 'mix-1');
  assert.equal(song.playable, false);
  assert.equal(song.sourceNotice, '酷狗结果缺少 hash，播放时会提示换源或登录');
});

test('scores title, artist and duration matches higher than loose matches', () => {
  const exact = normalizeKugouSong({ songname: '遇见', singername: '孙燕姿', duration: 241, hash: 'A' });
  const loose = normalizeKugouSong({ songname: '遇见 Live', singername: '其他歌手', duration: 120, hash: 'B' });

  assert.equal(scoreKugouSongMatch('孙燕姿 遇见', exact), 100);
  assert.ok(scoreKugouSongMatch('孙燕姿 遇见', exact) > scoreKugouSongMatch('孙燕姿 遇见', loose));
});
