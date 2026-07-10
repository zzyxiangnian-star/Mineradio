function cleanKugouTrackText(value) {
  return String(value || '').replace(/\.(mp3|flac|m4a|aac|ogg|wav)$/i, '').replace(/\s+/g, ' ').trim();
}

function normalizeSimpleText(value) {
  return cleanKugouTrackText(value)
    .toLowerCase()
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[\s._\-·'’"“”「」《》:：/\\|]+/g, '');
}

function firstString() {
  for (const value of arguments) {
    const text = cleanKugouTrackText(value);
    if (text) return text;
  }
  return '';
}

function normalizeDurationMs(value) {
  const raw = Number(value) || 0;
  if (!raw) return 0;
  return raw > 1000 ? raw : raw * 1000;
}

function normalizeKugouSong(raw, index) {
  raw = raw || {};
  const trans = raw.trans_param || raw.transParam || {};
  const hash = firstString(
    raw.hash, raw.Hash, raw.file_hash, raw.FileHash, raw.filehash, raw.audio_hash,
    raw['320hash'], raw['128hash'], raw.sqhash, raw.SQFileHash, raw.HQFileHash,
    trans.ogg_320_hash, trans.ogg_128_hash
  );
  const qualityHashes = {
    standard: firstString(raw['128hash'], raw.hash, raw.Hash, raw.file_hash, trans.ogg_128_hash),
    exhigh: firstString(raw['320hash'], raw.HQFileHash, trans.ogg_320_hash, raw.hash, raw.Hash, raw.file_hash),
    lossless: firstString(raw.sqhash, raw.SQFileHash, raw.flac_hash, raw.hash, raw.Hash, raw.file_hash),
    hires: firstString(raw.hrhash, raw.high_hash, raw.sqhash, raw.SQFileHash, raw.hash, raw.Hash, raw.file_hash),
    jymaster: firstString(raw.masterhash, raw.jymaster_hash, raw.hrhash, raw.sqhash, raw.SQFileHash, raw.hash, raw.Hash, raw.file_hash),
  };
  const albumAudioId = firstString(raw.album_audio_id, raw.albumAudioId, raw.audio_id, raw.audioid, raw.Audioid, raw.mixsongid, raw.songid, raw.id);
  const filename = cleanKugouTrackText(raw.filename || raw.FileName || '');
  let name = firstString(raw.songname, raw.song_name, raw.name, raw.title);
  let artist = firstString(raw.singername, raw.singer_name, raw.author_name, raw.singer, raw.artist);
  if (!artist && Array.isArray(raw.singerinfo) && raw.singerinfo[0]) {
    artist = raw.singerinfo.map(item => item && cleanKugouTrackText(item.name)).filter(Boolean).join(' / ');
  }
  if (filename) {
    const parts = String(filename).split(' - ');
    if (parts.length >= 2) {
      const filenameArtist = cleanKugouTrackText(parts.shift());
      const titleFromFilename = cleanKugouTrackText(parts.join(' - '));
      artist = artist || filenameArtist;
      if (!name || normalizeSimpleText(name) === normalizeSimpleText(filename)) name = titleFromFilename;
    } else {
      name = name || filename;
    }
  }
  if (name && artist && String(name).includes(' - ')) {
    const parts = String(name).split(' - ');
    const maybeArtist = cleanKugouTrackText(parts.shift());
    const maybeTitle = cleanKugouTrackText(parts.join(' - '));
    if (maybeTitle && normalizeSimpleText(maybeArtist) === normalizeSimpleText(artist)) name = maybeTitle;
  }
  const albumInfo = raw.albuminfo || raw.albumInfo || {};
  const album = firstString(raw.album_name, raw.albumname, raw.album, albumInfo.name);
  const albumId = firstString(raw.album_id, raw.albumid, raw.AlbumID, raw.albumId);
  const cover = firstString(raw.pic, raw.img, raw.image, raw.cover, raw.sizable_cover, raw.imgurl, trans.union_cover).replace(/\{size\}/g, '300');
  const duration = normalizeDurationMs(raw.timelength || raw.time_length || raw.timelen || raw.duration || raw.interval);
  const id = String(hash || albumAudioId || name || `kugou-${index || 0}`);
  if (!name && !id) return null;
  const playable = !!hash;
  return {
    provider: 'kugou',
    source: 'kugou',
    type: 'kugou',
    id,
    mid: hash,
    hash,
    qualityHashes,
    albumAudioId,
    albumId,
    name: cleanKugouTrackText(name).replace(/\s*-\s*$/, '') || '酷狗歌曲',
    artist,
    artists: artist ? [{ name: artist }] : [],
    album,
    cover,
    duration,
    fee: Number(raw.privilege || raw.media_privilege || raw.media_pay_type || raw.pay_type || 0) || 0,
    position: Number(raw.fsort || raw.sort || raw.position || raw.pos || 0) || 0,
    playable,
    sourceNotice: playable ? '' : '酷狗结果缺少 hash，播放时会提示换源或登录',
  };
}

function scoreKugouSongMatch(query, song) {
  const q = normalizeSimpleText(query);
  const title = normalizeSimpleText(song && song.name);
  const artist = normalizeSimpleText(song && song.artist);
  if (!q || !title) return 0;
  let score = 0;
  if (q.includes(title)) score += 48;
  else if (title.includes(q)) score += 30;
  if (artist && q.includes(artist)) score += 32;
  if (song && song.cover) score += 4;
  if (song && song.album) score += 4;
  if (song && song.hash) score += 12;
  const duration = Number(song && song.duration) || 0;
  if (duration >= 90000 && duration <= 600000) score += 8;
  return Math.min(100, score);
}

module.exports = {
  cleanKugouTrackText,
  normalizeKugouSong,
  normalizeSimpleText,
  scoreKugouSongMatch,
};
