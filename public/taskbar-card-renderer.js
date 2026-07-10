(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MineradioTaskbarCard = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  const CARD_WIDTH = 640;
  const CARD_HEIGHT = 768;
  const TRANSITION_STEPS = 6;
  const TRANSITION_MS = 180;
  const palette = {
    background: '#f5f6f7',
    text: '#181b20',
    muted: '#747b86',
    control: '#e7e9ec',
  };

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function cardVisualKey(state) {
    const value = state || {};
    return [
      clean(value.title),
      clean(value.artist),
      clean(value.cover),
      value.playing ? 1 : 0,
      value.hasTrack ? 1 : 0,
    ].join('|');
  }

  function fitText(ctx, text, maxWidth) {
    const value = clean(text);
    if (ctx.measureText(value).width <= maxWidth) return value;
    let low = 0;
    let high = value.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (ctx.measureText(value.slice(0, mid) + '…').width <= maxWidth) low = mid;
      else high = mid - 1;
    }
    return value.slice(0, low) + '…';
  }

  function taskbarCoverRequestSrc(src) {
    const value = clean(src);
    if (/^(data:|blob:)/i.test(value)) return value;
    return /^https?:\/\//i.test(value)
      ? '/api/cover?url=' + encodeURIComponent(value)
      : value;
  }

  function roundedRect(ctx, x, y, width, height, radius) {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function loadImage(src) {
    return new Promise(function(resolve, reject) {
      if (!src) {
        reject(new Error('image source is empty'));
        return;
      }
      const image = new Image();
      image.decoding = 'async';
      image.onload = function() { resolve(image); };
      image.onerror = function() { reject(new Error('image load failed')); };
      image.src = src;
    });
  }

  function drawCroppedImage(ctx, image, x, y, size, radius, alpha) {
    if (!image) return;
    const width = image.naturalWidth || image.width || 1;
    const height = image.naturalHeight || image.height || 1;
    const crop = Math.min(width, height);
    ctx.save();
    roundedRect(ctx, x, y, size, size, radius);
    ctx.clip();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.drawImage(
      image,
      (width - crop) / 2,
      (height - crop) / 2,
      crop,
      crop,
      x,
      y,
      size,
      size,
    );
    ctx.restore();
  }

  function drawPlaceholder(ctx, x, y, size) {
    ctx.save();
    roundedRect(ctx, x, y, size, size, 24);
    ctx.fillStyle = '#e3e6ea';
    ctx.fill();
    ctx.fillStyle = '#9aa1ab';
    ctx.font = '600 112px "Segoe UI Symbol"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('♪', x + size / 2, y + size / 2 - 4);
    ctx.restore();
  }

  function drawCard(ctx, state, images, coverMix) {
    ctx.clearRect(0, 0, CARD_WIDTH, CARD_HEIGHT);
    ctx.save();
    roundedRect(ctx, 0, 0, CARD_WIDTH, CARD_HEIGHT, 28);
    ctx.fillStyle = palette.background;
    ctx.fill();
    ctx.restore();

    if (images.logo) drawCroppedImage(ctx, images.logo, 42, 34, 56, 12, 1);

    ctx.fillStyle = palette.text;
    ctx.font = '600 28px "Segoe UI"';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(fitText(ctx, state.title || 'Mineradio', 458), 122, 64);
    ctx.fillStyle = palette.muted;
    ctx.font = '400 20px "Segoe UI"';
    ctx.fillText(
      fitText(ctx, state.artist || (state.hasTrack ? '未知歌手' : '音乐播放器'), 458),
      122,
      94,
    );

    ctx.save();
    ctx.shadowColor = 'rgba(20,24,32,.22)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 14;
    roundedRect(ctx, 96, 138, 448, 448, 24);
    ctx.fillStyle = '#e3e6ea';
    ctx.fill();
    ctx.restore();

    if (!images.previousCover && !images.nextCover) drawPlaceholder(ctx, 96, 138, 448);
    if (images.previousCover) {
      drawCroppedImage(ctx, images.previousCover, 96, 138, 448, 24, 1 - coverMix);
    }
    if (images.nextCover) {
      drawCroppedImage(ctx, images.nextCover, 96, 138, 448, 24, coverMix);
    }

    ctx.fillStyle = palette.control;
    roundedRect(ctx, 214, 654, 212, 4, 2);
    ctx.fill();
  }

  function createTaskbarCardRenderer(options) {
    const opts = options || {};
    const canvas = opts.canvas || document.createElement('canvas');
    canvas.width = CARD_WIDTH;
    canvas.height = CARD_HEIGHT;
    const ctx = canvas.getContext('2d', { alpha: true });
    const emitFrame = typeof opts.emitFrame === 'function' ? opts.emitFrame : function() {};
    let serial = 0;
    let destroyed = false;
    let currentCover = null;
    const logoPromise = loadImage(opts.logoUrl || '/assets/taskbar-logo.png').catch(function() {
      return null;
    });

    async function render(rawState) {
      const state = {
        title: clean(rawState && rawState.title) || 'Mineradio',
        artist: clean(rawState && rawState.artist),
        cover: clean(rawState && rawState.cover),
        playing: !!(rawState && rawState.playing),
        hasTrack: !!(rawState && rawState.hasTrack),
      };
      const token = ++serial;
      const logo = await logoPromise;
      if (destroyed || token !== serial) return;

      drawCard(ctx, state, { logo, previousCover: currentCover, nextCover: null }, 0);
      emitFrame({
        dataUrl: canvas.toDataURL('image/png'),
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        final: !state.cover,
      });
      if (!state.cover) return;

      const nextCover = await loadImage(taskbarCoverRequestSrc(state.cover)).catch(function() {
        return null;
      });
      if (destroyed || token !== serial) return;

      if (!nextCover) {
        currentCover = null;
        drawCard(ctx, state, { logo, previousCover: null, nextCover: null }, 1);
        emitFrame({
          dataUrl: canvas.toDataURL('image/png'),
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          final: true,
        });
        return;
      }

      for (let step = 1; step <= TRANSITION_STEPS; step++) {
        if (destroyed || token !== serial) return;
        drawCard(
          ctx,
          state,
          { logo, previousCover: currentCover, nextCover },
          step / TRANSITION_STEPS,
        );
        emitFrame({
          dataUrl: canvas.toDataURL('image/png'),
          width: CARD_WIDTH,
          height: CARD_HEIGHT,
          final: step === TRANSITION_STEPS,
        });
        if (step < TRANSITION_STEPS) {
          await new Promise(function(resolve) {
            setTimeout(resolve, TRANSITION_MS / TRANSITION_STEPS);
          });
        }
      }
      currentCover = nextCover;
    }

    return {
      canvas,
      render,
      destroy: function() {
        destroyed = true;
        serial++;
      },
    };
  }

  return {
    CARD_WIDTH,
    CARD_HEIGHT,
    fitText,
    taskbarCoverRequestSrc,
    cardVisualKey,
    createTaskbarCardRenderer,
  };
});
