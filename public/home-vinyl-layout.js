(function(root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.MineradioVinylLayout = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function buildHexLayout(count, iconSize) {
    count = Math.max(0, Math.floor(Number(count) || 0));
    iconSize = Math.max(24, Number(iconSize) || 84);
    var spacingX = Math.round(iconSize * 0.9 * 1000) / 1000;
    var spacingY = Math.round(iconSize * 0.78 * 1000) / 1000;
    var columns = Math.max(3, Math.ceil(Math.sqrt(Math.max(1, count) * 1.18)));
    var items = [];
    for (var index = 0; index < count; index++) {
      var row = Math.floor(index / columns);
      var column = index % columns;
      items.push({
        index: index,
        row: row,
        column: column,
        x: column * spacingX + (row % 2 ? spacingX / 2 : 0),
        y: row * spacingY,
      });
    }
    var maxX = items.reduce(function(max, item){ return Math.max(max, item.x); }, 0);
    var maxY = items.reduce(function(max, item){ return Math.max(max, item.y); }, 0);
    return {
      items: items,
      iconSize: iconSize,
      spacingX: spacingX,
      spacingY: spacingY,
      columns: columns,
      bounds: { minX: 0, minY: 0, maxX: maxX, maxY: maxY },
    };
  }

  function visualForPoint(dx, dy, radius) {
    radius = Math.max(1, Number(radius) || 1);
    var normalized = clamp(Math.sqrt(dx * dx + dy * dy) / radius, 0, 1);
    return {
      scale: 1.3 - normalized * 0.58,
      opacity: 1 - normalized * 0.34,
      zIndex: Math.round((1 - normalized) * 1000),
      normalized: normalized,
    };
  }

  function visibleIndices(items, offset, viewport) {
    offset = offset || { x: 0, y: 0 };
    viewport = viewport || {};
    var width = Math.max(1, Number(viewport.width) || 1);
    var height = Math.max(1, Number(viewport.height) || 1);
    var radius = Math.max(1, Number(viewport.radius) || Math.min(width, height) / 2);
    var overscan = Math.max(0, Number(viewport.overscan) || 0);
    var cx = width / 2;
    var cy = height / 2;
    var limit = radius + overscan;
    var result = [];
    for (var i = 0; i < items.length; i++) {
      var x = items[i].x + offset.x;
      var y = items[i].y + offset.y;
      if (Math.abs(x - cx) > limit || Math.abs(y - cy) > limit) continue;
      if (Math.hypot(x - cx, y - cy) <= limit * 1.12) result.push(items[i].index);
    }
    return result;
  }

  function nearestIndex(items, offset, center) {
    if (!items || !items.length) return -1;
    offset = offset || { x: 0, y: 0 };
    center = center || { x: 0, y: 0 };
    var nearest = 0;
    var distance = Infinity;
    for (var i = 0; i < items.length; i++) {
      var dx = items[i].x + offset.x - center.x;
      var dy = items[i].y + offset.y - center.y;
      var next = dx * dx + dy * dy;
      if (next < distance) {
        distance = next;
        nearest = items[i].index;
      }
    }
    return nearest;
  }

  function snapOffsetForIndex(items, index, center) {
    center = center || { x: 0, y: 0 };
    var item = items && items[index];
    return item ? { x: center.x - item.x, y: center.y - item.y } : { x: 0, y: 0 };
  }

  function clampOffset(offset, layout, viewport) {
    if (!layout || !layout.items.length) return { x: 0, y: 0 };
    var width = Math.max(1, Number(viewport.width) || 1);
    var height = Math.max(1, Number(viewport.height) || 1);
    var pad = Math.max(layout.iconSize, Number(viewport.radius) * 0.32);
    var minX = width - layout.bounds.maxX - pad;
    var maxX = pad;
    var minY = height - layout.bounds.maxY - pad;
    var maxY = pad;
    return {
      x: clamp(offset.x, Math.min(minX, maxX), Math.max(minX, maxX)),
      y: clamp(offset.y, Math.min(minY, maxY), Math.max(minY, maxY)),
    };
  }

  return {
    clamp: clamp,
    buildHexLayout: buildHexLayout,
    visualForPoint: visualForPoint,
    visibleIndices: visibleIndices,
    nearestIndex: nearestIndex,
    snapOffsetForIndex: snapOffsetForIndex,
    clampOffset: clampOffset,
  };
});
