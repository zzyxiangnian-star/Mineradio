function isRightEdgeChatTrigger(x, y, width, height, edgeWidth = 46) {
  return y > 96 && y < height - 116 && x >= width - edgeWidth;
}

function isChatPanelHover(x, y, rect, padding = 26) {
  if (!rect) return false;
  return x >= rect.left - padding &&
    x <= rect.right + padding &&
    y >= rect.top - padding &&
    y <= rect.bottom + padding;
}

function shouldKeepChatOpenAtPointer(x, y, width, height, rect) {
  return isRightEdgeChatTrigger(x, y, width, height) || isChatPanelHover(x, y, rect);
}

module.exports = {
  isRightEdgeChatTrigger,
  isChatPanelHover,
  shouldKeepChatOpenAtPointer,
};
