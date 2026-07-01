const crypto = require('crypto');

const QISHUI_ALLOWED_HOST_RE = /(^|\.)qishui\.douyin\.com$/i;

function normalizeQishuiShareUrl(value) {
  let raw = String(value || '').trim();
  if (!raw) {
    const err = new Error('QISHUI_URL_MISSING');
    err.code = 'QISHUI_URL_MISSING';
    throw err;
  }
  const embedded = raw.match(/https?:\/\/[^\s"'<>]*qishui\.douyin\.com\/[^\s"'<>]*/i);
  if (embedded) raw = embedded[0];
  let url;
  try {
    url = new URL(raw);
  } catch (e) {
    const err = new Error('QISHUI_URL_INVALID');
    err.code = 'QISHUI_URL_INVALID';
    throw err;
  }
  if (!/^https?:$/i.test(url.protocol) || !QISHUI_ALLOWED_HOST_RE.test(url.hostname)) {
    const err = new Error('QISHUI_URL_UNSUPPORTED');
    err.code = 'QISHUI_URL_UNSUPPORTED';
    throw err;
  }
  url.hash = '';
  return url.toString();
}

function buildQishuiPlaylistId(url) {
  return 'qishui-' + crypto.createHash('sha1').update(String(url || '')).digest('hex').slice(0, 12);
}

function htmlDecode(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function cleanText(value) {
  return htmlDecode(value)
    .replace(/\\u002F/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstString(obj, keys) {
  for (const key of keys) {
    const value = obj && obj[key];
    if (typeof value === 'string' && cleanText(value)) return cleanText(value);
    if (typeof value === 'number' && isFinite(value)) return String(value);
  }
  return '';
}

function artistFromValue(value) {
  if (!value) return '';
  if (typeof value === 'string') return cleanText(value);
  if (Array.isArray(value)) {
    return value.map(item => {
      if (typeof item === 'string') return cleanText(item);
      return firstString(item, ['name', 'artistName', 'nickname', 'title']);
    }).filter(Boolean).join(' / ');
  }
  if (typeof value === 'object') return firstString(value, ['name', 'artistName', 'nickname', 'title']);
  return '';
}

function normalizeQishuiTrack(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const title = firstString(raw, ['songName', 'name', 'title', 'trackName', 'musicName']);
  const artist = firstString(raw, ['artistName', 'singerName', 'authorName']) ||
    artistFromValue(raw.artists || raw.singers || raw.author || raw.artist || raw.singer);
  if (!title || !artist) return null;
  return {
    title,
    artist,
    cover: firstString(raw, ['cover', 'coverUrl', 'picUrl', 'imageUrl', 'thumbUrl']),
    raw,
  };
}

function walkJson(value, visitor, seen) {
  if (!value || typeof value !== 'object') return;
  seen = seen || new Set();
  if (seen.has(value)) return;
  seen.add(value);
  visitor(value);
  if (Array.isArray(value)) {
    value.forEach(item => walkJson(item, visitor, seen));
    return;
  }
  Object.keys(value).forEach(key => walkJson(value[key], visitor, seen));
}

function uniqueTracks(tracks) {
  const seen = new Set();
  return (tracks || []).filter(track => {
    const key = (track.title + '|' + track.artist).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseJsonScriptBlocks(html) {
  const blocks = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(String(html || '')))) {
    const text = htmlDecode(match[1] || '').trim();
    if (!text || (text[0] !== '{' && text[0] !== '[')) continue;
    try {
      blocks.push(JSON.parse(text));
    } catch (e) {}
  }
  return blocks;
}

function titleFromHtml(html) {
  const match = String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = cleanText(match && match[1] || '').replace(/\s*[-_｜|]\s*汽水音乐.*$/i, '');
  return title || '汽水音乐歌单';
}

function extractQishuiPlaylistFromHtml(html, url) {
  const playlist = {
    provider: 'qishui',
    source: 'qishui',
    id: buildQishuiPlaylistId(url),
    url: normalizeQishuiShareUrl(url),
    name: titleFromHtml(html),
    cover: '',
    trackCount: 0,
    creator: '汽水音乐',
  };
  const tracks = [];
  parseJsonScriptBlocks(html).forEach(root => {
    walkJson(root, node => {
      const track = normalizeQishuiTrack(node);
      if (track) tracks.push(track);
      if (!playlist.cover) playlist.cover = firstString(node, ['cover', 'coverUrl', 'picUrl', 'imageUrl']);
      if (playlist.name === '汽水音乐歌单') {
        const name = firstString(node, ['playlistName', 'playlistTitle', 'listName', 'title', 'name']);
        if (name && !/汽水音乐|qishui/i.test(name)) playlist.name = name;
      }
    });
  });
  const unique = uniqueTracks(tracks);
  playlist.trackCount = unique.length;
  return { playlist, tracks: unique };
}

function scoreMatchedSong(song, sourceTrack, index) {
  const title = cleanText(sourceTrack && sourceTrack.title).toLowerCase();
  const artist = cleanText(sourceTrack && sourceTrack.artist).toLowerCase();
  const name = cleanText(song && song.name).toLowerCase();
  const songArtist = cleanText(song && song.artist).toLowerCase();
  let score = 0;
  if (name === title) score += 100;
  else if (name && title && (name.includes(title) || title.includes(name))) score += 50;
  if (artist && songArtist && (songArtist.includes(artist) || artist.includes(songArtist))) score += 70;
  score -= (index || 0) * 2;
  return score;
}

function pickBestMatchedSong(songs, sourceTrack) {
  return (songs || [])
    .map((song, index) => ({ song, score: scoreMatchedSong(song, sourceTrack, index) }))
    .sort((a, b) => b.score - a.score)[0];
}

module.exports = {
  normalizeQishuiShareUrl,
  buildQishuiPlaylistId,
  extractQishuiPlaylistFromHtml,
  pickBestMatchedSong,
};
