function extractJsonText(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence && fence[1]) return fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return '';
}

function normalizeRecommendation(item) {
  const trackKey = String(item && (item.trackKey || item.trackId) || '').trim();
  if (!trackKey) return null;
  return {
    trackKey,
    reason: String(item && item.reason || '').trim().slice(0, 240),
  };
}

function normalizeAction(action) {
  const type = String(action && action.type || '').trim();
  if (!/^(play|add_to_queue|like|create_temp_playlist|add_all_to_queue)$/.test(type)) return null;
  return {
    type,
    trackKey: action && (action.trackKey || action.trackId) != null ? String(action.trackKey || action.trackId) : '',
    label: String(action && action.label || '').slice(0, 40),
  };
}

function parseAiResponse(raw) {
  const fallback = String(raw || '').trim();
  const jsonText = extractJsonText(fallback);
  if (!jsonText) {
    return {
      reply: fallback || 'Miss 暂时没有组织好语言。',
      recommendations: [],
      actions: [],
      parseFallback: true,
    };
  }
  try {
    const parsed = JSON.parse(jsonText);
    const recommendations = Array.isArray(parsed.recommendations)
      ? parsed.recommendations.map(normalizeRecommendation).filter(Boolean)
      : [];
    const actions = Array.isArray(parsed.actions)
      ? parsed.actions.map(normalizeAction).filter(Boolean)
      : [];
    return {
      reply: String(parsed.reply || '').trim() || 'Miss 找到了一些可以继续听的方向。',
      recommendations,
      actions,
      parseFallback: false,
    };
  } catch (error) {
    return {
      reply: fallback || 'Miss 的回复格式有点乱，请再试一次。',
      recommendations: [],
      actions: [],
      parseFallback: true,
    };
  }
}

module.exports = { parseAiResponse, extractJsonText };
