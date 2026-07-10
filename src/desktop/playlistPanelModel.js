const SUPPORTED_PROVIDERS = new Set(['netease', 'qq', 'kugou', 'qishui']);
const DEFAULT_RENDER_LIMIT = 36;

function normalizePlaylistProvider(provider) {
  const key = String(provider || '').trim().toLowerCase();
  return SUPPORTED_PROVIDERS.has(key) ? key : 'netease';
}

function playlistPanelKey(provider, id) {
  return `${normalizePlaylistProvider(provider)}:${String(id || '')}`;
}

function buildInlineDetail(detailState) {
  const state = detailState || {};
  const tracks = Array.isArray(state.tracks) ? state.tracks : [];
  const loading = !!state.loading;
  const renderLimit = loading
    ? 0
    : Math.min(tracks.length, Math.max(DEFAULT_RENDER_LIMIT, Number(state.renderLimit) || DEFAULT_RENDER_LIMIT));

  return {
    headerMode: 'actions-only',
    loading,
    renderLimit,
    totalTracks: tracks.length,
    visibleTracks: loading ? [] : tracks.slice(0, renderLimit),
  };
}

function buildInlinePlaylistPanelModel(playlists, detailState) {
  const state = detailState || {};
  const activeKey = String(state.key || '');
  return {
    items: (Array.isArray(playlists) ? playlists : []).map((playlist) => {
      const provider = normalizePlaylistProvider(playlist && playlist.provider);
      const key = playlistPanelKey(provider, playlist && playlist.id);
      const expanded = !!activeKey && key === activeKey;
      return {
        key,
        provider,
        playlist,
        expanded,
        inlineDetail: expanded ? buildInlineDetail(state) : null,
      };
    }),
  };
}

module.exports = {
  buildInlinePlaylistPanelModel,
  normalizePlaylistProvider,
  playlistPanelKey,
};
