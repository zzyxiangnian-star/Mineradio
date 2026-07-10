const DEFAULT_LIMIT = 40;

function firstString() {
  for (const value of arguments) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return '';
}

function artistName(song) {
  if (!song) return '';
  if (Array.isArray(song.artists)) return song.artists.map((a) => a && a.name).filter(Boolean).join(' / ');
  if (Array.isArray(song.ar)) return song.ar.map((a) => a && a.name).filter(Boolean).join(' / ');
  if (Array.isArray(song.singer)) return song.singer.map((a) => a && a.name).filter(Boolean).join(' / ');
  return firstString(song.artist, song.artistName, song.singerName);
}

function normalizeSource(song, fallback) {
  const raw = firstString(song && song.provider, song && song.source, fallback, 'netease').toLowerCase();
  if (/qq/.test(raw)) return 'qq';
  if (/local/.test(raw)) return 'local';
  if (/podcast/.test(raw)) return 'podcast';
  return 'netease';
}

function normalizeDuration(song) {
  const raw = Number(song && (song.duration || song.dt || song.interval));
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return raw > 1000 ? Math.round(raw / 1000) : Math.round(raw);
}

function normalizeCandidateTrack(song, extras = {}) {
  song = song || {};
  const source = normalizeSource(song, extras.source);
  const album = song.album || song.al || {};
  const originalId = firstString(song.originalId, song.id, song.trackId, song.qqId, song.mid, song.songmid, song.localKey, song.radioId);
  if (!originalId) return null;
  return {
    trackKey: `${source}:${originalId}`,
    source,
    originalId,
    title: firstString(song.title, song.name, song.songname),
    artist: artistName(song),
    album: firstString(album.name, song.albumName, song.album),
    cover: firstString(song.cover, song.picUrl, song.coverUrl, album.picUrl, song.image),
    duration: normalizeDuration(song),
    liked: !!extras.liked,
  };
}

function addCandidates(out, seen, items, options) {
  if (!Array.isArray(items)) return;
  for (const item of items) {
    if (out.length >= options.limit) return;
    const normalized = normalizeCandidateTrack(item, options);
    if (!normalized || seen.has(normalized.trackKey)) continue;
    seen.add(normalized.trackKey);
    out.push(normalized);
  }
}

function buildCandidateList(context, options = {}) {
  const limit = Math.max(1, Math.min(60, Number(options.limit || DEFAULT_LIMIT)));
  const out = [];
  const seen = new Set();
  const normalizedOptions = { ...options, limit };
  addCandidates(out, seen, context && context.currentTrack ? [context.currentTrack] : [], normalizedOptions);
  addCandidates(out, seen, context && context.queue, normalizedOptions);
  addCandidates(out, seen, context && context.currentPlaylist, normalizedOptions);
  addCandidates(out, seen, context && context.likedRecent, normalizedOptions);
  addCandidates(out, seen, context && context.searchResults, normalizedOptions);
  addCandidates(out, seen, context && context.candidateTracks, normalizedOptions);
  return out;
}

function validateRecommendations(recommendations, candidateTracks) {
  const map = new Map();
  (candidateTracks || []).forEach((track) => {
    const key = track && track.trackKey ? String(track.trackKey) : '';
    if (key && !map.has(key)) map.set(key, track);
  });
  const seen = new Set();
  const valid = [];
  const dropped = [];
  (recommendations || []).forEach((item) => {
    const trackKey = item && (item.trackKey || item.trackId) != null ? String(item.trackKey || item.trackId) : '';
    if (!trackKey || seen.has(trackKey) || !map.has(trackKey)) {
      if (trackKey) dropped.push(trackKey);
      return;
    }
    seen.add(trackKey);
    valid.push({
      trackKey,
      reason: String(item.reason || '').trim() || 'Miss picked this from your available songs.',
      track: map.get(trackKey),
    });
  });
  return { recommendations: valid.slice(0, 6), dropped };
}

module.exports = {
  normalizeCandidateTrack,
  buildCandidateList,
  validateRecommendations,
};
