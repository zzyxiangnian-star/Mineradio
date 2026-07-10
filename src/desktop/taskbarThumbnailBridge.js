'use strict';

function createTaskbarThumbnailBridge(options = {}) {
  const platform = options.platform || process.platform;
  const logger = options.logger || console;
  let binding = options.nativeBinding || null;
  let attached = false;
  let warned = false;

  function warnOnce(error) {
    if (warned) return;
    warned = true;
    if (logger && typeof logger.warn === 'function') {
      logger.warn(
        '[TaskbarThumbnail] native bridge unavailable:',
        error && error.message || error,
      );
    }
  }

  if (platform === 'win32' && !binding) {
    try {
      binding = require('mineradio-taskbar-thumbnail');
    } catch (error) {
      warnOnce(error);
    }
  }

  function safeCall(name, args) {
    if (!binding || typeof binding[name] !== 'function') return false;
    try {
      return binding[name](...(args || [])) !== false;
    } catch (error) {
      warnOnce(error);
      return false;
    }
  }

  return {
    get available() {
      return platform === 'win32' && !!binding;
    },
    get attached() {
      return attached;
    },
    attach(hwnd) {
      if (attached) return true;
      if (platform !== 'win32' || !Buffer.isBuffer(hwnd)) return false;
      attached = safeCall('attach', [hwnd]);
      return attached;
    },
    update(image) {
      if (
        !attached ||
        !image ||
        typeof image.getSize !== 'function' ||
        typeof image.toBitmap !== 'function'
      ) {
        return false;
      }
      try {
        const size = image.getSize();
        const width = Math.floor(Number(size.width) || 0);
        const height = Math.floor(Number(size.height) || 0);
        const bitmap = image.toBitmap();
        if (width < 1 || height < 1 || width > 4096 || height > 4096) return false;
        if (!Buffer.isBuffer(bitmap) || bitmap.length !== width * height * 4) return false;
        return safeCall('updateBitmap', [bitmap, width, height]);
      } catch (error) {
        warnOnce(error);
        return false;
      }
    },
    clear() {
      return attached ? safeCall('clearBitmap') : true;
    },
    detach() {
      if (!attached) return true;
      const ok = safeCall('detach');
      attached = false;
      return ok;
    },
  };
}

module.exports = { createTaskbarThumbnailBridge };
