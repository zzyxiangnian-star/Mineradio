const path = require('path');
const { pathToFileURL } = require('url');

const CHAT_WALLPAPER_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);

function chatWallpaperDir(userDataPath) {
  return path.join(userDataPath, 'chat-wallpapers');
}

function normalizeChatWallpaperExt(ext) {
  const normalized = String(ext || '').toLowerCase();
  return normalized && normalized.startsWith('.') ? normalized : `.${normalized}`;
}

function chatWallpaperPathForExt(userDataPath, ext) {
  const normalized = normalizeChatWallpaperExt(ext);
  return path.join(chatWallpaperDir(userDataPath), `music-soul-chat-wallpaper${normalized}`);
}

function isSupportedChatWallpaperImage(filePath) {
  return CHAT_WALLPAPER_IMAGE_EXTENSIONS.has(path.extname(String(filePath || '')).toLowerCase());
}

function toChatWallpaperInfo(filePath, name) {
  return {
    name: name || path.basename(filePath),
    path: filePath,
    url: pathToFileURL(filePath).toString(),
  };
}

module.exports = {
  CHAT_WALLPAPER_IMAGE_EXTENSIONS,
  chatWallpaperDir,
  chatWallpaperPathForExt,
  isSupportedChatWallpaperImage,
  toChatWallpaperInfo,
};
