function parseImportUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch (_) {
    try {
      return new URL('https://' + raw);
    } catch (_err) {
      return null;
    }
  }
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match && match[1]) return String(match[1]);
  }
  return '';
}

function detectPlaylistImportUrl(value) {
  const raw = String(value || '').trim();
  const parsed = parseImportUrl(raw);
  if (!parsed) return { provider: 'unsupported', id: '', url: raw };

  const host = parsed.hostname.toLowerCase();
  const full = raw;
  const path = parsed.pathname || '';
  const search = parsed.search || '';
  const hash = parsed.hash || '';
  const combined = path + search + hash;

  if (host === 'qishui.douyin.com' || host.endsWith('.qishui.douyin.com')) {
    return { provider: 'qishui', id: '', url: raw };
  }

  if (host === 'music.163.com' || host.endsWith('.music.163.com')) {
    const id = parsed.searchParams.get('id') || firstMatch(hash, [/id=(\d+)/i]) || firstMatch(combined, [/playlist[^\d]+(\d+)/i]);
    if (id) return { provider: 'netease', id, url: full };
  }

  if (host === 'y.qq.com' || host.endsWith('.y.qq.com') || host === 'i.y.qq.com') {
    const id = parsed.searchParams.get('id') || parsed.searchParams.get('disstid') || firstMatch(combined, [/playlist\/(\d+)/i, /disstid=(\d+)/i]);
    if (id) return { provider: 'qq', id, url: full };
  }

  if (host === 'kugou.com' || host.endsWith('.kugou.com') || host === 'kugou.cn' || host.endsWith('.kugou.cn')) {
    const id = parsed.searchParams.get('id') || parsed.searchParams.get('specialid') || firstMatch(combined, [/single\/(\d+)/i, /special\/(\d+)/i, /specialid=(\d+)/i]);
    if (id) return { provider: 'kugou', id, url: full };
  }

  return { provider: 'unsupported', id: '', url: raw };
}

module.exports = {
  detectPlaylistImportUrl,
};
