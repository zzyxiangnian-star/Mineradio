const assert = require('assert');
const fs = require('fs');

const { parseAiResponse } = require('./src/lib/ai/parseAiResponse');
const {
  normalizeCandidateTrack,
  buildCandidateList,
  validateRecommendations,
} = require('./src/lib/ai/recommendation');
const { normalizeMusicProfile } = require('./src/lib/ai/musicProfile');
const {
  normalizeBaseUrl,
  normalizeChatCompletionsUrl,
  maskApiKey,
  metadataFromConfig,
  resolveAiConfig,
  mergeAiConfigUpdate,
  detectAiProvider,
} = require('./src/lib/ai/configStore');
const { callMiMoChat } = require('./src/lib/ai/mimoClient');
const { MISS_SYSTEM_PROMPT } = require('./src/lib/ai/prompts');
const {
  normalizeQishuiShareUrl,
  extractQishuiPlaylistFromHtml,
  buildQishuiPlaylistId,
} = require('./src/lib/qishui');
const VinylLayout = require('./public/home-vinyl-layout');

function testParseJsonFence() {
  const parsed = parseAiResponse('```json\n{"reply":"Here","recommendations":[{"trackKey":"netease:1","reason":"calm"}],"actions":[]}\n```');
  assert.strictEqual(parsed.reply, 'Here');
  assert.deepStrictEqual(parsed.recommendations, [{ trackKey: 'netease:1', reason: 'calm' }]);
}

function testParsePlainJson() {
  const parsed = parseAiResponse('{"reply":"Plain","recommendations":[{"trackKey":"qq:abc","reason":"bright"}]}');
  assert.strictEqual(parsed.reply, 'Plain');
  assert.deepStrictEqual(parsed.recommendations, [{ trackKey: 'qq:abc', reason: 'bright' }]);
}

function testParsePlainTextFallback() {
  const parsed = parseAiResponse('I can talk, but not JSON.');
  assert.strictEqual(parsed.reply, 'I can talk, but not JSON.');
  assert.deepStrictEqual(parsed.recommendations, []);
}

function testNormalizeCandidateTrack() {
  const raw = {
    id: 123,
    name: 'Song A',
    ar: [{ name: 'Artist A' }],
    al: { name: 'Album A', picUrl: 'cover.jpg' },
    dt: 240000,
  };
  const track = normalizeCandidateTrack(raw, { liked: true, source: 'netease' });
  assert.deepStrictEqual(track, {
    trackKey: 'netease:123',
    source: 'netease',
    originalId: '123',
    title: 'Song A',
    artist: 'Artist A',
    album: 'Album A',
    cover: 'cover.jpg',
    duration: 240,
    liked: true,
  });
}

function testNormalizeAlreadyNormalizedCandidateTrack() {
  const track = normalizeCandidateTrack({
    trackKey: 'qq:abc',
    source: 'qq',
    originalId: 'abc',
    title: 'Song B',
    artist: 'Artist B',
    album: 'Album B',
    cover: 'cover-b.jpg',
    duration: 188,
    liked: true,
  });
  assert.deepStrictEqual(track, {
    trackKey: 'qq:abc',
    source: 'qq',
    originalId: 'abc',
    title: 'Song B',
    artist: 'Artist B',
    album: 'Album B',
    cover: 'cover-b.jpg',
    duration: 188,
    liked: false,
  });
}

function testBuildCandidateListPriorityDedupeAndLimit() {
  const currentTrack = { id: 1, name: 'Current' };
  const queue = Array.from({ length: 45 }, (_, i) => ({ id: i + 1, name: `Q${i + 1}` }));
  const searchResults = [{ id: 99, name: 'Search' }];
  const result = buildCandidateList({
    currentTrack,
    queue,
    currentPlaylist: [{ id: 2, name: 'Duplicate playlist song' }],
    likedRecent: [{ id: 88, name: 'Recent' }],
    searchResults,
  }, { limit: 40 });
  assert.strictEqual(result.length, 40);
  assert.strictEqual(result[0].trackKey, 'netease:1');
  assert.strictEqual(result.filter((item) => item.trackKey === 'netease:2').length, 1);
}

function testValidateRecommendationsDropsInvalidKeys() {
  const candidates = [
    { trackKey: 'netease:s1', title: 'Song One', artist: 'A' },
    { trackKey: 'qq:s2', title: 'Song Two', artist: 'B' },
  ];
  const result = validateRecommendations([
    { trackKey: 'netease:s1', reason: 'fits' },
    { trackKey: 'missing', reason: 'invented' },
    { trackKey: 'qq:s2', reason: '' },
  ], candidates);
  assert.deepStrictEqual(result.recommendations, [
    { trackKey: 'netease:s1', reason: 'fits', track: candidates[0] },
    { trackKey: 'qq:s2', reason: 'Miss picked this from your available songs.', track: candidates[1] },
  ]);
  assert.strictEqual(result.dropped.length, 1);
}

function testNormalizeMusicProfile() {
  const profile = normalizeMusicProfile({
    summary: 'Late-night and quiet',
    moodTags: ['late-night', 22, 'quiet'],
    genreTags: ['lo-fi'],
    tempoPreference: 'medium-slow',
    languagePreference: ['Chinese'],
    artistStyle: ['soft vocal'],
    recommendationStrategy: 'Avoid noisy songs.',
  });
  assert.deepStrictEqual(profile, {
    summary: 'Late-night and quiet',
    moodTags: ['late-night', 'quiet'],
    genreTags: ['lo-fi'],
    tempoPreference: 'medium-slow',
    languagePreference: ['Chinese'],
    artistStyle: ['soft vocal'],
    recommendationStrategy: 'Avoid noisy songs.',
  });
}

function testNormalizeChatCompletionsUrl() {
  assert.strictEqual(
    normalizeChatCompletionsUrl('https://api.xiaomimimo.com/v1'),
    'https://api.xiaomimimo.com/v1/chat/completions'
  );
  assert.strictEqual(
    normalizeChatCompletionsUrl('https://api.xiaomimimo.com/v1/'),
    'https://api.xiaomimimo.com/v1/chat/completions'
  );
  assert.strictEqual(
    normalizeChatCompletionsUrl('https://api.xiaomimimo.com/v1/chat/completions'),
    'https://api.xiaomimimo.com/v1/chat/completions'
  );
}

function testNormalizeBaseUrlRejectsUnsafeRemoteHttp() {
  assert.throws(() => normalizeBaseUrl('http://example.com/v1'), /Base URL must use https/);
  assert.strictEqual(normalizeBaseUrl('http://localhost:11434/v1'), 'http://localhost:11434/v1');
  assert.strictEqual(normalizeBaseUrl('http://127.0.0.1:11434/v1/chat/completions'), 'http://127.0.0.1:11434/v1');
}

function testMaskApiKeyAndMetadata() {
  assert.strictEqual(maskApiKey('abc123456789'), '••••••••6789');
  assert.strictEqual(maskApiKey('abcd'), '••••abcd');
  assert.deepStrictEqual(metadataFromConfig({
    enabled: true,
    apiKey: 'abc123456789',
    baseUrl: 'https://api.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
    authMethod: 'bearer',
  }), {
    enabled: true,
    baseUrl: 'https://api.xiaomimimo.com/v1',
    model: 'mimo-v2.5-pro',
    authMethod: 'bearer',
    hasApiKey: true,
    maskedApiKey: '••••••••6789',
  });
}

function testResolveAiConfigPrecedence() {
  const resolved = resolveAiConfig({
    saved: { enabled: true, apiKey: 'saved-key', baseUrl: 'https://saved.example/v1', model: 'saved-model', authMethod: 'bearer' },
    env: { MIMO_API_KEY: 'env-key', MIMO_BASE_URL: 'https://env.example/v1', MIMO_MODEL: 'env-model' },
  });
  assert.strictEqual(resolved.apiKey, 'saved-key');
  assert.strictEqual(resolved.baseUrl, 'https://saved.example/v1');
  assert.strictEqual(resolved.model, 'saved-model');
  assert.strictEqual(resolved.authMethod, 'bearer');
}

function testMergeAiConfigPreservesAndClearsKey() {
  const previous = { enabled: true, apiKey: 'old-key', baseUrl: 'https://old.example/v1', model: 'old-model', authMethod: 'api-key' };
  const preserved = mergeAiConfigUpdate(previous, {
    enabled: false,
    apiKey: '',
    baseUrl: 'https://new.example/v1/chat/completions',
    model: '',
    authMethod: '',
  });
  assert.strictEqual(preserved.apiKey, 'old-key');
  assert.strictEqual(preserved.enabled, false);
  assert.strictEqual(preserved.baseUrl, 'https://new.example/v1');
  assert.strictEqual(preserved.model, 'mimo-v2.5-pro');
  assert.strictEqual(preserved.authMethod, 'api-key');

  const cleared = mergeAiConfigUpdate(previous, { clearApiKey: true });
  assert.strictEqual(cleared.apiKey, '');
}

function testDeepSeekConfigCompatibility() {
  assert.strictEqual(typeof detectAiProvider, 'function');
  assert.strictEqual(detectAiProvider('https://api.deepseek.com'), 'deepseek');
  const migrated = resolveAiConfig({
    saved: { enabled: true, apiKey: 'deep-key', baseUrl: 'https://api.deepseek.com', model: 'mimo-v2.5-pro', authMethod: 'api-key' },
    env: {},
  });
  assert.strictEqual(migrated.model, 'deepseek-v4-pro');
  assert.strictEqual(migrated.authMethod, 'bearer');
  const explicit = resolveAiConfig({
    saved: { enabled: true, apiKey: 'deep-key', baseUrl: 'https://api.deepseek.com', model: 'deepseek-v4-flash', authMethod: 'api-key' },
    env: {},
  });
  assert.strictEqual(explicit.model, 'deepseek-v4-flash');
  assert.strictEqual(explicit.authMethod, 'bearer');
}

function testMusicSoulPromptStartsWithPlayfulGirlPersona() {
  assert.ok(MISS_SYSTEM_PROMPT.startsWith('你是 Music Soul，简称 MS，是 Mineradio 播放器里住着的 AI 音乐搭子。'));
  assert.match(MISS_SYSTEM_PROMPT, /说话轻轻俏皮的女生朋友/);
  assert.match(MISS_SYSTEM_PROMPT, /不要硬塞歌曲推荐/);
}

async function testCallMiMoChatUsesSelectedAuthHeader() {
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async function(url, options) {
    calls.push({ url, options });
    return {
      ok: true,
      text: async () => JSON.stringify({ choices: [{ message: { content: '{"reply":"ok"}' } }] }),
    };
  };
  try {
    await callMiMoChat([{ role: 'user', content: 'hi' }], {
      config: { enabled: true, apiKey: 'secret-one', baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2.5-pro', authMethod: 'api-key' },
      timeoutMs: 1000,
    });
    await callMiMoChat([{ role: 'user', content: 'hi' }], {
      config: { enabled: true, apiKey: 'secret-two', baseUrl: 'https://api.xiaomimimo.com/v1/chat/completions', model: 'mimo-v2.5-pro', authMethod: 'bearer' },
      timeoutMs: 1000,
    });
    await callMiMoChat([{ role: 'user', content: 'hi' }], {
      config: { enabled: true, apiKey: 'deep-secret', baseUrl: 'https://api.deepseek.com', model: 'mimo-v2.5-pro', authMethod: 'api-key' },
      timeoutMs: 1000,
      maxCompletionTokens: 321,
    });
  } finally {
    global.fetch = originalFetch;
  }
  assert.strictEqual(calls[0].url, 'https://api.xiaomimimo.com/v1/chat/completions');
  assert.strictEqual(calls[0].options.headers['api-key'], 'secret-one');
  assert.strictEqual(calls[0].options.headers.Authorization, undefined);
  assert.strictEqual(calls[1].url, 'https://api.xiaomimimo.com/v1/chat/completions');
  assert.strictEqual(calls[1].options.headers.Authorization, 'Bearer secret-two');
  assert.strictEqual(calls[1].options.headers['api-key'], undefined);
  const mimoBody = JSON.parse(calls[0].options.body);
  assert.strictEqual(mimoBody.max_completion_tokens, 1024);
  assert.strictEqual(mimoBody.max_tokens, undefined);
  assert.strictEqual(calls[2].url, 'https://api.deepseek.com/chat/completions');
  assert.strictEqual(calls[2].options.headers.Authorization, 'Bearer deep-secret');
  assert.strictEqual(calls[2].options.headers['api-key'], undefined);
  const deepSeekBody = JSON.parse(calls[2].options.body);
  assert.strictEqual(deepSeekBody.model, 'deepseek-v4-pro');
  assert.strictEqual(deepSeekBody.max_tokens, 321);
  assert.strictEqual(deepSeekBody.max_completion_tokens, undefined);
}

function testMusicSoulUiContract() {
  const html = fs.readFileSync('public/index.html', 'utf8');
  assert.match(html, /body\.splash-active[^{}]*#miss-fab/);
  assert.match(html, /body\.splash-active[^{}]*#miss-panel/);
  assert.match(html, /body\.splash-active[^{}]*#ms-settings-modal/);
  assert.ok(!html.includes("document.createElement('button');\n    settingsBtn.id = 'ms-settings-fab'"));
  assert.ok(!html.includes('#ms-settings-fab'));
  assert.match(html, /id="ms-menu-pop"/);
  assert.ok(!html.includes('<div class="miss-grid">\n      <button class="miss-btn primary" type="button" onclick="askMissRecommend()">推荐歌曲</button>'));
  assert.match(html, /MISS_PANEL_POS_STORE_KEY/);
  assert.match(html, /onMissPanelPointerDown/);
  assert.match(html, /isMissPanelBorderDragHandle/);
  assert.match(html, /e\.buttons !== 1/);
  assert.match(html, /#miss-panel\.miss-dragging\{transition:none!important/);
  assert.match(html, /panel\.classList\.add\('miss-dragging'\)/);
  assert.match(html, /\.ms-chat-shell\{[^}]*height:min/);
  assert.match(html, /\.ms-input-wrap\{[^}]*margin-top:auto/);
  assert.match(html, /\.ms-bubble\{[^}]*overflow:hidden/);
  assert.match(html, /\.ms-bubble \.miss-card\{[^}]*max-width:100%/);
  assert.match(html, /function shouldMissAutoPlayReply/);
  assert.match(html, /autoPlayFirst:\s*shouldMissAutoPlayReply\(message\)/);
  assert.match(html, /if \(opts\.autoPlayFirst && recs\.length\) missPlayRecommendation\(0\)/);
  assert.match(html, /suppressFabClick/);
  assert.match(html, /missState\.suppressFabClick = true/);
  assert.match(html, /localStorage\.removeItem\(MISS_FAB_POS_STORE_KEY\)/);
  assert.doesNotMatch(html, /applyMissFabPosition\(readMissFabPosition\(\)\)/);
  assert.doesNotMatch(html, /saveMissFabPosition\(r\.left, r\.top\)/);
  assert.match(html, /isMissUiAllowed/);
  assert.match(html, /syncMissEntryVisibility/);
  assert.match(html, /providerAvatarSrc\(activeAccountProvider/);
  assert.match(html, /home-ai-dj-showcase/);
  assert.match(html, /MISS_AI_DJ_AVATAR_SRC/);
  assert.match(html, /function openMissPanel/);
  assert.match(html, /function openHomeAiDjSettings/);
  assert.match(html, /function openHomeAiDjSmartContinue/);
  assert.match(html, /splashAutoDismissTimer/);
  assert.match(html, /setTimeout\(function\(\)\{\s*if \(splashReadyToEnter\) dismissSplash\(\);\s*\}, 700\)/);
  assert.match(html, /splashTimer = setTimeout\(markSplashReadyToEnter, 2600\)/);
  assert.doesNotMatch(html, /onclick="openHomeAiDjPanel\(\)"/);
  assert.doesNotMatch(html, /onclick="openHomeAiDjSmartContinue\(\)"/);
  assert.doesNotMatch(html, /onclick="openHomeAiDjSettings\(\)"/);
  assert.match(html, /href="home-vinyl\.css"/);
  assert.match(html, /class="home-vinyl-ambient"/);
  assert.doesNotMatch(html, /id="home-vinyl-player"/);
  assert.match(html, /id="home-vinyl-viewport"/);
  assert.match(html, /id="home-vinyl-grid"/);
  assert.doesNotMatch(html, /id="home-vinyl-tonearm"/);
  assert.doesNotMatch(html, /id="home-vinyl-play"/);
  assert.doesNotMatch(html, /id="home-vinyl-prev"/);
  assert.doesNotMatch(html, /id="home-vinyl-next"/);
  assert.doesNotMatch(html, /id="home-vinyl-volume"/);
  assert.doesNotMatch(html, /aria-label="主页播放器控制"/);
  assert.match(html, /onclick="openVinylPlaylistPicker\(\)"/);
  const vinylController = fs.readFileSync('public/home-vinyl.js', 'utf8');
  assert.match(vinylController, /window\.MineradioVinylHome/);
  assert.match(vinylController, /event\.stopPropagation\(\)/);
  assert.match(vinylController, /event\.preventDefault\(\)/);
  assert.match(vinylController, /data-dragging/);
  assert.match(vinylController, /downIndex/);
  assert.match(vinylController, /downPoint/);
  assert.match(vinylController, /suppressNextClick/);
  assert.match(vinylController, /function playIndex/);
  assert.match(vinylController, /playIndex\(clickIndex\)/);
  assert.match(vinylController, /playIndex\(index\)/);
  assert.match(vinylController, /function onWheel/);
  assert.match(vinylController, /zoom:\s*1/);
  assert.match(vinylController, /maxZoom:\s*2\.35/);
  assert.match(vinylController, /passive:\s*false/);
  assert.match(vinylController, /zoom:\s*state\.zoom/);
  assert.doesNotMatch(vinylController, /function onPlayClick/);
  assert.doesNotMatch(vinylController, /player:'home-vinyl-player'/);
  assert.match(vinylController, /function setPlaylist/);
  assert.match(vinylController, /function syncTrack/);
  const syncTrackSource = vinylController.slice(vinylController.indexOf('function syncTrack'), vinylController.indexOf('function syncPlayback'));
  assert.doesNotMatch(syncTrackSource, /selectIndex\(/);
  assert.match(vinylController, /function syncPlayback/);
  assert.match(vinylController, /requestAnimationFrame/);
  assert.match(vinylController, /visibleIndices/);
  assert.match(vinylController, /setPointerCapture/);
  assert.match(html, /var vinylPlaylistPickerActive = false/);
  assert.match(html, /function openVinylPlaylistPicker/);
  assert.match(html, /function fetchVinylPlaylistTracks/);
  assert.match(html, /function selectPlaylistForVinylHome/);
  assert.match(html, /if \(vinylPlaylistPickerActive\) \{/);
  assert.match(html, /MineradioVinylHome\.setPlaylist/);
  assert.match(html, /var vinylHomePlaybackSession = false/);
  assert.match(html, /function createVinylHomeAdapter/);
  assert.match(html, /function syncVinylHomeTrack/);
  assert.match(html, /function initVinylHome/);
  assert.match(html, /preserveHomeState: true/);
  assert.match(html, /MineradioVinylHome\.syncPlayback/);
  assert.match(html, /homeForcedOpen = true/);
  const vinylCss = fs.readFileSync('public/home-vinyl.css', 'utf8');
  assert.match(html, /role="listbox"/);
  assert.match(html, /id="home-vinyl-empty"[^>]*role="status"[^>]*aria-live="polite"/);
  assert.match(html, /class="home-vinyl-wallpaper-video"/);
  assert.match(html, /accept="image\/\*,video\/\*"/);
  assert.match(html, /AI DJ 展示栏壁纸/);
  assert.match(html, /function normalizeHomeVinylWallpaperMedia/);
  assert.match(html, /function syncHomeVinylWallpaperVideo/);
  assert.match(html, /homeVinylWallpaperMedia/);
  assert.match(html, /\.home-vinyl-shell/);
  assert.match(vinylCss, /clip-path:circle\(50% at 50% 50%\)/);
  assert.match(vinylCss, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(vinylCss, /home-vinyl-tonearm-elbow/);
  assert.doesNotMatch(vinylCss, /\.home-vinyl-player\{/);
  assert.doesNotMatch(vinylCss, /\.home-vinyl-controls\{/);
  assert.match(vinylCss, /home-vinyl-wallpaper-video/);
  assert.match(vinylCss, /mask-image:radial-gradient/);
  assert.match(vinylCss, /\.home-vinyl-viewport\{[^}]*background:transparent/);
  assert.doesNotMatch(vinylCss, /\.home-vinyl-viewport\{[^}]*rgba\(6,10,14/);
  assert.doesNotMatch(vinylCss, /\.home-vinyl-viewport\{[^}]*border:/);
  assert.doesNotMatch(html, /<div class="home-grid">/);
  assert.doesNotMatch(html, /id="home-continue-title"/);
  assert.doesNotMatch(html, /id="home-music-dna-summary"/);
  assert.ok(!html.includes('此处施工'));
  assert.ok(!html.includes("return 'me';"));

  const server = fs.readFileSync('server.js', 'utf8');
  assert.match(server, /function shouldAllowChatRecommendations/);
  assert.match(server, /allowRecommendations:\s*shouldAllowChatRecommendations/);
}

function testMissAiDjEnhancementContract() {
  const html = fs.readFileSync('public/index.html', 'utf8');
  const main = fs.readFileSync('src/desktop/main.js', 'utf8');
  const preload = fs.readFileSync('src/desktop/preload.js', 'utf8');
  const wallpaper = fs.readFileSync('public/wallpaper.html', 'utf8');
  const trayMenu = fs.existsSync('public/tray-menu.html') ? fs.readFileSync('public/tray-menu.html', 'utf8') : '';
  const server = fs.readFileSync('server.js', 'utf8');

  assert.match(html, /--ms-vinyl-cover/);
  assert.match(html, /MISS_AI_DJ_AVATAR_SRC/);
  assert.match(html, /function normalizeMissAvatarMedia/);
  assert.match(html, /function applyMissAvatarMedia/);
  assert.match(html, /function readMissAvatarMediaFile/);
  assert.match(html, /function normalizeMissChatWallpaperMedia/);
  assert.match(html, /function syncMissChatWallpaperVideo/);
  assert.match(html, /function readMissChatWallpaperFile/);
  assert.match(html, /missAvatarMedia/);
  assert.match(html, /missChatWallpaperMedia/);
  assert.match(html, /id="miss-avatar-input"[^>]*accept="image\/\*,video\/\*"/);
  assert.match(html, /id="miss-wallpaper-input"[^>]*accept="image\/\*,video\/\*"/);
  assert.match(html, /id="miss-avatar-zoom"/);
  assert.match(html, /id="miss-wallpaper-zoom"/);
  assert.match(html, /miss-wallpaper-video/);
  assert.match(html, /ms-avatar-media/);
  const earlyChatWallpaperApply = html.indexOf('applyMissChatWallpaperMedia();');
  const missStateInit = html.indexOf('var missState =');
  assert.ok(earlyChatWallpaperApply === -1 || earlyChatWallpaperApply > missStateInit, 'chat wallpaper should not touch missState before missState is initialized');
  assert.match(html, /function executeMissActions/);
  assert.match(html, /function missSearchAndPlay/);
  assert.match(html, /playQueueAt\(idx\)/);
  assert.match(html, /\/api\/artist\/search\?keyword=/);
  assert.match(html, /\/api\/artist\/songs\?/);
  assert.match(html, /function fetchArtistSearchResults/);
  assert.match(html, /function renderCombinedSearchResults/);
  assert.match(html, /function chooseCustomVideoWallpaper/);
  assert.match(html, /chooseVideoWallpaper/);
  assert.match(html, /customWallpaper/);
  assert.match(html, /function buildDesktopShellState/);
  assert.match(html, /function currentDesktopThumbnailClip/);
  assert.match(html, /thumbnailClip:\s*currentDesktopThumbnailClip\(\)/);
  assert.match(html, /function scheduleDesktopShellStatePush/);
  assert.match(html, /function pushDesktopShellState/);
  assert.match(html, /function handleDesktopShellCommand/);
  assert.match(html, /updateShellState/);
  assert.match(html, /onShellCommand/);
  assert.match(html, /case 'setPlayMode'/);
  assert.match(html, /toggleFx\('wallpaperMode'\)/);
  assert.match(html, /toggleFx\('desktopLyrics'\)/);
  assert.match(html, /toggleFxPanel\(false\)/);
  assert.match(html, /closeMissPanel\(\)/);

  assert.match(server, /\/api\/artist\/search/);
  assert.match(server, /\/api\/artist\/songs/);
  assert.match(server, /function normalizeArtistSearchResult/);

  assert.match(main, /\bTray\b/);
  assert.match(main, /\bMenu\b/);
  assert.match(main, /let tray = null/);
  assert.match(main, /let desktopShellState =/);
  assert.match(main, /let trayMenuWindow = null/);
  assert.match(main, /let isQuitting = false/);
  assert.match(main, /createAppTray/);
  assert.match(main, /function normalizeDesktopShellState/);
  assert.match(main, /function updateDesktopShellState/);
  assert.match(main, /function dispatchShellCommand/);
  assert.match(main, /function createTrayMenuWindow/);
  assert.match(main, /function showTrayMenuWindow/);
  assert.match(main, /function positionTrayMenuWindow/);
  assert.match(main, /function updateWindowsThumbarButtons/);
  assert.match(main, /function updateWindowsThumbnailPreview/);
  assert.match(main, /function normalizeThumbnailClip/);
  assert.match(main, /setThumbnailClip/);
  assert.match(main, /createThumbarIcon\('prev'\)/);
  assert.match(main, /createThumbarIcon\(desktopShellState\.playing \? 'pause' : 'play'\)/);
  assert.match(main, /createThumbarIcon\('next'\)/);
  assert.match(main, /setThumbarButtons/);
  assert.match(main, /mineradio-shell-state-update/);
  assert.match(main, /mineradio-tray-menu-command/);
  assert.match(main, /tray-menu\.html/);
  assert.match(main, /const TRAY_MENU_HEIGHT = 510/);
  assert.match(main, /MINERADIO_ALLOW_MULTI_INSTANCE/);
  assert.match(main, /app\.requestSingleInstanceLock\(\)/);
  assert.match(main, /mineradio-wallpaper-choose-video/);
  assert.match(main, /wallpapers/);

  assert.match(preload, /chooseVideoWallpaper/);
  assert.match(preload, /resetVideoWallpaper/);
  assert.match(preload, /updateShellState:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('mineradio-shell-state-update'/);
  assert.match(preload, /onShellCommand:\s*\(callback\)\s*=>/);
  assert.match(preload, /mineradio-shell-command/);
  assert.match(preload, /notifyShellCommandResult:\s*\(payload\)\s*=>\s*ipcRenderer\.invoke\('mineradio-shell-command-result'/);

  assert.match(wallpaper, /customVideo/);
  assert.match(wallpaper, /wallpaper-video/);

  assert.match(trayMenu, /tray-menu-card/);
  assert.match(trayMenu, /window\.trayMenu/);
  assert.match(trayMenu, /data-command="togglePlay"/);
  assert.match(trayMenu, /data-command="setPlayMode"/);
  assert.match(trayMenu, /data-mode="shuffle"/);
  assert.match(trayMenu, /data-command="toggleWallpaper"/);
  assert.match(trayMenu, /data-command="toggleDesktopLyrics"/);
  assert.match(trayMenu, /data-command="quit"/);
  assert.match(trayMenu, /class="tray-footer"[\s\S]*data-command="quit"/);
  assert.match(trayMenu, /\.items\s*\{[^}]*overflow-y:\s*auto/);
}

function testMineradioFollowupEnhancementContract() {
  const html = fs.readFileSync('public/index.html', 'utf8');
  const main = fs.readFileSync('src/desktop/main.js', 'utf8');
  const preload = fs.readFileSync('src/desktop/preload.js', 'utf8');
  const wallpaper = fs.readFileSync('public/wallpaper.html', 'utf8');
  const server = fs.readFileSync('server.js', 'utf8');

  assert.match(html, /artist-open-btn/);
  assert.doesNotMatch(html, /fab\.addEventListener\('mouseenter', function\(\)\{\s*if \(!missState\.drag/);
  assert.match(html, /MISS_COLLAPSE_STORE_KEY/);
  assert.match(html, /function collapseMissPanelToEdge/);
  assert.match(html, /function expandMissPanelFromEdge/);
  assert.match(html, /home-ai-dj-clock/);
  assert.match(html, /home-music-dna/);
  assert.match(html, /function refreshHomeMusicDna/);
  assert.match(html, /login-provider-kugou/);
  assert.match(html, /user-provider-kugou/);
  assert.match(html, /multiSourceAccountMode/);
  assert.match(html, /chooseWallpaperScene/);
  assert.match(html, /resetWallpaperScene/);
  assert.match(html, /window-resizing/);

  assert.match(server, /\/api\/kugou\/login\/status/);
  assert.match(server, /\/api\/kugou\/search/);
  assert.match(server, /\/api\/kugou\/playlists/);

  assert.match(main, /KUGOU_LOGIN_PARTITION/);
  assert.match(main, /openKugouMusicLoginWindow/);
  assert.match(main, /mineradio-wallpaper-choose-scene/);
  assert.match(main, /chooseWallpaperScene/);

  assert.match(preload, /openKugouMusicLogin/);
  assert.match(preload, /clearKugouMusicLogin/);
  assert.match(preload, /chooseWallpaperScene/);
  assert.match(preload, /resetWallpaperScene/);

  assert.match(wallpaper, /customScene/);
  assert.match(wallpaper, /scene-preview/);
  assert.match(wallpaper, /scene-status/);
}

function testQishuiHelpers() {
  const normalized = normalizeQishuiShareUrl('  https://qishui.douyin.com/s/iRSNtxYM/  ');
  assert.strictEqual(normalized, 'https://qishui.douyin.com/s/iRSNtxYM/');
  assert.strictEqual(normalizeQishuiShareUrl('分享给你 https://qishui.douyin.com/s/iRSNtxYM/ 打开汽水音乐'), normalized);
  assert.throws(() => normalizeQishuiShareUrl('https://example.com/s/iRSNtxYM/'), /QISHUI_URL_UNSUPPORTED/);
  assert.match(buildQishuiPlaylistId(normalized), /^qishui-[a-f0-9]{12}$/);

  const html = '<html><head><title>我的汽水歌单 - 汽水音乐</title></head><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"playlist":{"title":"我的汽水歌单","cover":"cover.jpg","tracks":[{"songName":"愿与愁","artistName":"林俊杰"},{"name":"关键词","singers":[{"name":"林俊杰"}]}]}}}}</script></body></html>';
  const parsed = extractQishuiPlaylistFromHtml(html, normalized);
  assert.strictEqual(parsed.playlist.name, '我的汽水歌单');
  assert.strictEqual(parsed.tracks.length, 2);
  assert.deepStrictEqual(parsed.tracks[0], { title: '愿与愁', artist: '林俊杰', cover: '', raw: parsed.tracks[0].raw });
}

function testQishuiUiContract() {
  const html = fs.readFileSync('public/index.html', 'utf8');
  assert.match(html, /QISHUI_PLAYLIST_STORE_KEY/);
  assert.match(html, /function importQishuiPlaylist/);
  assert.match(html, /apiJson\('\/api\/qishui\/playlist\/import'/);
  assert.match(html, /provider === 'qishui'/);
  assert.match(html, /playlistPanelProviderId\(provider, pid\)/);
  assert.match(html, /qishuiImportedPlaylists/);

  const server = fs.readFileSync('server.js', 'utf8');
  assert.match(server, /require\('\.\/src\/lib\/qishui'\)/);
  assert.match(server, /\/api\/qishui\/playlist\/import/);
  assert.match(server, /handleQishuiPlaylistImport/);
}

function testVinylHexLayoutUsesStaggeredRows() {
  const layout = VinylLayout.buildHexLayout(7, 100);
  assert.strictEqual(layout.items.length, 7);
  assert.deepStrictEqual(layout.items[0], { index: 0, row: 0, column: 0, x: 0, y: 0 });
  assert.deepStrictEqual(layout.items[3], { index: 3, row: 1, column: 0, x: 59, y: 104 });
  assert.strictEqual(layout.spacingX, 118);
  assert.strictEqual(layout.spacingY, 104);
}

function testVinylVisualWeightFallsTowardCircleEdge() {
  const center = VinylLayout.visualForPoint(0, 0, 300);
  const edge = VinylLayout.visualForPoint(300, 0, 300);
  assert.ok(center.scale >= 1.08 && center.scale <= 1.16);
  assert.ok(edge.scale >= 0.68 && edge.scale <= 0.76);
  assert.ok(edge.opacity <= 0.28);
  assert.ok(center.opacity > edge.opacity);
  assert.ok(center.zIndex > edge.zIndex);
}

function testVinylNearestAndSnapUseViewportCenter() {
  const layout = VinylLayout.buildHexLayout(8, 100);
  const nearest = VinylLayout.nearestIndex(layout.items, { x: 12, y: -20 }, { x: 50, y: 58 });
  const snap = VinylLayout.snapOffsetForIndex(layout.items, nearest, { x: 50, y: 58 });
  assert.strictEqual(layout.items[nearest].x + snap.x, 50);
  assert.strictEqual(layout.items[nearest].y + snap.y, 58);
}

function testVinylVisibilityDoesNotReturnEntireLargePlaylist() {
  const layout = VinylLayout.buildHexLayout(300, 82);
  const visible = VinylLayout.visibleIndices(layout.items, { x: 0, y: 0 }, {
    width: 620,
    height: 620,
    radius: 310,
    overscan: 100,
  });
  assert.ok(visible.length > 0);
  assert.ok(visible.length < 120);
}

testParseJsonFence();
testParsePlainJson();
testParsePlainTextFallback();
testNormalizeCandidateTrack();
testNormalizeAlreadyNormalizedCandidateTrack();
testBuildCandidateListPriorityDedupeAndLimit();
testValidateRecommendationsDropsInvalidKeys();
testNormalizeMusicProfile();
testNormalizeChatCompletionsUrl();
testNormalizeBaseUrlRejectsUnsafeRemoteHttp();
testMaskApiKeyAndMetadata();
testResolveAiConfigPrecedence();
testMergeAiConfigPreservesAndClearsKey();
testDeepSeekConfigCompatibility();
testMusicSoulPromptStartsWithPlayfulGirlPersona();
testMusicSoulUiContract();
testMissAiDjEnhancementContract();
testMineradioFollowupEnhancementContract();
testQishuiHelpers();
testQishuiUiContract();
testVinylHexLayoutUsesStaggeredRows();
testVinylVisualWeightFallsTowardCircleEdge();
testVinylNearestAndSnapUseViewportCenter();
testVinylVisibilityDoesNotReturnEntireLargePlaylist();
testCallMiMoChatUsesSelectedAuthHeader().then(() => {
  console.log('AI helper module tests passed');
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
