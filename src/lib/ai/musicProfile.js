function stringList(value, max) {
  return Array.isArray(value)
    ? value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, max)
    : [];
}

function normalizeMusicProfile(raw) {
  raw = raw || {};
  return {
    summary: String(raw.summary || '').trim().slice(0, 360),
    moodTags: stringList(raw.moodTags, 8),
    genreTags: stringList(raw.genreTags, 8),
    tempoPreference: String(raw.tempoPreference || '').trim().slice(0, 80),
    languagePreference: stringList(raw.languagePreference, 6),
    artistStyle: stringList(raw.artistStyle, 8),
    recommendationStrategy: String(raw.recommendationStrategy || '').trim().slice(0, 360),
  };
}

module.exports = { normalizeMusicProfile };
