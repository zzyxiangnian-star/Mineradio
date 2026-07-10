const DEFAULT_TITLE = 'Mineradio';

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeTaskbarPreviewState(payload) {
  const raw = payload || {};
  const title = cleanText(raw.title) || DEFAULT_TITLE;
  const artist = cleanText(raw.artist);
  const cover = cleanText(raw.cover);
  const queueLength = Math.max(0, Number(raw.queueLength) || 0);
  const hasTrack = raw.hasTrack == null
    ? title !== DEFAULT_TITLE || !!artist || !!cover || queueLength > 0
    : !!raw.hasTrack;

  return {
    title,
    artist,
    cover,
    playing: !!raw.playing,
    hasTrack,
    tooltip: artist ? `${title} - ${artist}` : title,
    queueLength,
  };
}

function taskbarClipForPreview(bounds) {
  const width = Math.max(0, Math.floor(Number(bounds && bounds.width) || 0));
  const height = Math.max(0, Math.floor(Number(bounds && bounds.height) || 0));
  if (width < 320 || height < 240) return { x: 0, y: 0, width, height };

  const clipWidth = Math.min(320, width);
  const clipHeight = Math.min(384, height);
  return {
    x: Math.max(0, Math.round((width - clipWidth) / 2)),
    y: Math.max(0, Math.round((height - clipHeight) / 2)),
    width: clipWidth,
    height: clipHeight,
  };
}

function taskbarPreviewStateKey(state) {
  const value = normalizeTaskbarPreviewState(state);
  return [
    value.title,
    value.artist,
    value.cover,
    value.playing ? 1 : 0,
    value.hasTrack ? 1 : 0,
    value.queueLength,
  ].join('|');
}

function validateTaskbarBitmapPayload(payload, limits = {}) {
  const value = payload || {};
  const width = Math.floor(Number(value.width) || 0);
  const height = Math.floor(Number(value.height) || 0);
  const maxDimension = Math.floor(Number(limits.maxDimension) || 4096);
  const maxDataUrlLength = Math.floor(Number(limits.maxDataUrlLength) || 6 * 1024 * 1024);
  const dataUrl = String(value.dataUrl || '');

  if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
    throw new TypeError('Taskbar bitmap must be a PNG data URL');
  }
  if (width < 1 || height < 1 || width > maxDimension || height > maxDimension) {
    throw new RangeError('Taskbar bitmap dimensions are invalid');
  }
  if (dataUrl.length > maxDataUrlLength) {
    throw new RangeError('Taskbar bitmap payload is too large');
  }

  return { dataUrl, width, height };
}

module.exports = {
  DEFAULT_TITLE,
  normalizeTaskbarPreviewState,
  taskbarClipForPreview,
  taskbarPreviewStateKey,
  validateTaskbarBitmapPayload,
};
