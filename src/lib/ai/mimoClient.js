const {
  resolveAiConfig,
  normalizeChatCompletionsUrl,
  detectAiProvider,
  DEFAULT_MODEL,
} = require('./configStore');

function aiConfig() {
  return resolveAiConfig();
}

function buildChatRequestBody(config, messages, options = {}) {
  const provider = detectAiProvider(config.baseUrl);
  const body = {
    model: config.model || DEFAULT_MODEL,
    messages,
    temperature: options.temperature == null ? 1.0 : Number(options.temperature),
    top_p: options.topP == null ? 0.95 : Number(options.topP),
    stream: false,
    thinking: { type: 'disabled' },
  };
  const maxTokens = Number(options.maxCompletionTokens || 1024);
  if (provider === 'deepseek') body.max_tokens = maxTokens;
  else body.max_completion_tokens = maxTokens;
  return body;
}

async function callMiMoChat(messages, options = {}) {
  const config = options.config ? resolveAiConfig({ saved: options.config, env: {} }) : aiConfig();
  if (config.enabled === false) {
    const error = new Error('Miss is disabled');
    error.code = 'MIMO_DISABLED';
    throw error;
  }
  if (!config.apiKey) {
    const error = new Error('Miss is not configured. Please add your MiMo API key in Settings.');
    error.code = 'MIMO_API_KEY_MISSING';
    throw error;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (config.authMethod === 'bearer') headers.Authorization = `Bearer ${config.apiKey}`;
  else headers['api-key'] = config.apiKey;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Number(options.timeoutMs || 30000));
  try {
    const response = await fetch(normalizeChatCompletionsUrl(config.baseUrl), {
      method: 'POST',
      headers,
      body: JSON.stringify(buildChatRequestBody(config, messages, options)),
      signal: controller.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      const error = new Error(`MiMo request failed with status ${response.status}`);
      error.code = 'MIMO_REQUEST_FAILED';
      error.status = response.status;
      error.bodyPreview = text.slice(0, 240);
      throw error;
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (parseError) {
      const error = new Error('MiMo returned non-JSON response');
      error.code = 'MIMO_RESPONSE_NOT_JSON';
      throw error;
    }
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!content) {
      const error = new Error('MiMo response did not include message content');
      error.code = 'MIMO_EMPTY_RESPONSE';
      throw error;
    }
    return { content, raw: data };
  } catch (error) {
    if (error && error.name === 'AbortError') {
      const timeoutError = new Error('MiMo request timed out');
      timeoutError.code = 'MIMO_TIMEOUT';
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = { aiConfig, buildChatRequestBody, callMiMoChat };
