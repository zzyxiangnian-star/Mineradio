const fs = require('fs');
const path = require('path');

const DEFAULT_BASE_URL = 'https://api.xiaomimimo.com/v1';
const DEFAULT_MODEL = 'mimo-v2.5-pro';
const DEFAULT_AUTH_METHOD = 'api-key';

function isLocalHttpUrl(url) {
  return url.protocol === 'http:' && /^(localhost|127\.0\.0\.1|\[::1\]|::1)$/i.test(url.hostname);
}

function normalizeBaseUrl(input) {
  const raw = String(input || DEFAULT_BASE_URL).trim() || DEFAULT_BASE_URL;
  let url;
  try {
    url = new URL(raw);
  } catch (error) {
    const err = new Error('Base URL is invalid.');
    err.code = 'AI_CONFIG_BASE_URL_INVALID';
    throw err;
  }
  if (url.protocol !== 'https:' && !isLocalHttpUrl(url)) {
    const err = new Error('Base URL must use https, except localhost debug endpoints.');
    err.code = 'AI_CONFIG_BASE_URL_INVALID';
    throw err;
  }
  url.hash = '';
  url.search = '';
  let pathname = url.pathname.replace(/\/+$/, '');
  pathname = pathname.replace(/\/chat\/completions$/i, '');
  url.pathname = pathname || '';
  return url.toString().replace(/\/+$/, '');
}

function normalizeChatCompletionsUrl(baseUrl) {
  return normalizeBaseUrl(baseUrl) + '/chat/completions';
}

function normalizeAuthMethod(value) {
  return String(value || DEFAULT_AUTH_METHOD).toLowerCase() === 'bearer' ? 'bearer' : DEFAULT_AUTH_METHOD;
}

function maskApiKey(apiKey) {
  const key = String(apiKey || '');
  if (!key) return '';
  return (key.length <= 4 ? '••••' : '••••••••') + key.slice(-4);
}

function metadataFromConfig(config) {
  const resolved = config || {};
  return {
    enabled: resolved.enabled !== false,
    baseUrl: normalizeBaseUrl(resolved.baseUrl || DEFAULT_BASE_URL),
    model: String(resolved.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    authMethod: normalizeAuthMethod(resolved.authMethod),
    hasApiKey: !!String(resolved.apiKey || '').trim(),
    maskedApiKey: maskApiKey(resolved.apiKey),
  };
}

function configFilePath() {
  const appDataDir = process.env.MINERADIO_USER_DATA_DIR || process.env.APPDATA || process.env.LOCALAPPDATA || '';
  if (appDataDir) return path.join(appDataDir, 'Mineradio', '.miss-ai-config.json');
  return path.join(__dirname, '..', '..', '.miss-ai-config.json');
}

function readSavedAiConfig(filePath) {
  const target = filePath || configFilePath();
  try {
    if (!fs.existsSync(target)) return {};
    const parsed = JSON.parse(fs.readFileSync(target, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    return {};
  }
}

function resolveAiConfig(options = {}) {
  const env = options.env || process.env;
  const saved = options.saved || readSavedAiConfig(options.filePath);
  const savedHasKey = !!String(saved.apiKey || '').trim();
  const envHasKey = !!String(env.MIMO_API_KEY || '').trim();
  const fromSaved = savedHasKey || saved.enabled === false || saved.baseUrl || saved.model || saved.authMethod;
  const base = {
    enabled: saved.enabled !== false,
    apiKey: savedHasKey ? String(saved.apiKey).trim() : (envHasKey ? String(env.MIMO_API_KEY).trim() : ''),
    baseUrl: saved.baseUrl || env.MIMO_BASE_URL || DEFAULT_BASE_URL,
    model: saved.model || env.MIMO_MODEL || DEFAULT_MODEL,
    authMethod: saved.authMethod || env.MIMO_AUTH_METHOD || DEFAULT_AUTH_METHOD,
    source: fromSaved ? 'saved' : (envHasKey ? 'env' : 'default'),
  };
  return {
    enabled: base.enabled,
    apiKey: base.apiKey,
    baseUrl: normalizeBaseUrl(base.baseUrl),
    model: String(base.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    authMethod: normalizeAuthMethod(base.authMethod),
    source: base.source,
  };
}

function mergeAiConfigUpdate(previous, update) {
  previous = previous || {};
  update = update || {};
  const next = {
    enabled: update.enabled == null ? previous.enabled !== false : !!update.enabled,
    apiKey: String(previous.apiKey || ''),
    baseUrl: normalizeBaseUrl(update.baseUrl || DEFAULT_BASE_URL),
    model: String(update.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL,
    authMethod: normalizeAuthMethod(update.authMethod),
  };
  if (update.clearApiKey) next.apiKey = '';
  else if (typeof update.apiKey === 'string' && update.apiKey.trim()) next.apiKey = update.apiKey.trim();
  return next;
}

function saveAiConfig(update, filePath) {
  const target = filePath || configFilePath();
  const previous = readSavedAiConfig(target);
  const next = mergeAiConfigUpdate(previous, update);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(next, null, 2), 'utf8');
  return next;
}

function clearAiConfig(filePath) {
  const target = filePath || configFilePath();
  try {
    if (fs.existsSync(target)) fs.unlinkSync(target);
  } catch (error) {}
  return {};
}

module.exports = {
  DEFAULT_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_AUTH_METHOD,
  normalizeBaseUrl,
  normalizeChatCompletionsUrl,
  normalizeAuthMethod,
  maskApiKey,
  metadataFromConfig,
  configFilePath,
  readSavedAiConfig,
  resolveAiConfig,
  mergeAiConfigUpdate,
  saveAiConfig,
  clearAiConfig,
};
