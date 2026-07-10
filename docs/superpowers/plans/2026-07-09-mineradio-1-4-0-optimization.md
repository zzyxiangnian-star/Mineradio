# Mineradio 1.4.0 Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the 1.4.0 desktop player preview, playlist panel, external playlist import, Kugou source handling, and online update flow.

**Architecture:** Keep the existing Electron renderer/main-process split. Add small focused helper modules for behavior that can be tested with `node:test`, while wiring the large existing `public/index.html` only where UI integration is required.

**Tech Stack:** Electron, vanilla browser JavaScript, Node.js `node:test`, GitHub Releases update metadata.

## Global Constraints

- Preserve existing playback state and queue behavior.
- Do not overwrite unrelated dirty workspace changes.
- Implement each feature with a failing test first where the behavior can be isolated.
- After each task, verify the running UI with the Chrome plugin before moving on.
- Version metadata for this work is `1.4.0`.

---

### Task 1: Windows Taskbar Player Preview

**Files:**
- Create: `src/desktop/taskbarPreview.js`
- Modify: `src/desktop/main.js`
- Modify: `src/desktop/preload.js`
- Modify: `public/index.html`
- Test: `test/taskbar-preview.test.js`

**Interfaces:**
- Produces: `normalizeTaskbarPreviewState(payload)` and `taskbarClipForPreview(bounds)`.
- Consumes: renderer playback state with `title`, `artist`, `cover`, `playing`, and `hasTrack`.

- [ ] Write failing tests for preview state normalization and clip calculation.
- [ ] Implement helper module and IPC bridge.
- [ ] Add hidden renderer preview card bound to current song cover and playback state.
- [ ] Wire main process to receive shell state and update native taskbar buttons/title/clip.
- [ ] Run `node --test test/taskbar-preview.test.js`.
- [ ] Open the app with Chrome plugin and verify the preview-card DOM updates with current song data.

### Task 2: Playlist Panel Inline Expansion

**Files:**
- Create: `src/desktop/playlistPanelModel.js`
- Modify: `public/index.html`
- Test: `test/playlist-panel-model.test.js`

**Interfaces:**
- Produces: `buildInlinePlaylistPanelModel(playlists, state)`.
- Consumes: existing `userPlaylists`, `playlistPanelDetailState`, and playlist detail render functions.

- [ ] Write failing tests that one expanded playlist appears once and owns its child tracks.
- [ ] Implement model helper.
- [ ] Update playlist rendering so clicked playlists expand inline instead of duplicating a second playlist card.
- [ ] Verify NetEase, QQ, Kugou, and Qishui provider labels remain.
- [ ] Run `node --test test/playlist-panel-model.test.js`.
- [ ] Use Chrome plugin to hover the left panel, click a playlist, and verify one playlist card plus inline songs.

### Task 3: External Playlist Link Import

**Files:**
- Create: `src/desktop/playlistImport.js`
- Modify: `server.js`
- Modify: `public/index.html`
- Test: `test/playlist-import.test.js`

**Interfaces:**
- Produces: `detectPlaylistImportUrl(url)` returning `{ provider, id, url }`.
- Consumes: existing Qishui import code and playlist track endpoints.

- [ ] Write failing tests for Qishui, Kugou, NetEase, QQ, unsupported, and malformed URLs.
- [ ] Implement URL detection.
- [ ] Add `/api/playlist/import-link` route that normalizes the link and returns playlist metadata/tracks.
- [ ] Add a search-box import icon button and modal input.
- [ ] Add success/error toasts and insert imported playlists into `userPlaylists`.
- [ ] Run `node --test test/playlist-import.test.js`.
- [ ] Use Chrome plugin to open the modal and verify unsupported-link error plus one supported-link flow or mocked route.

### Task 4: Kugou Source Recognition

**Files:**
- Create: `src/desktop/kugouMatch.js`
- Modify: `server.js`
- Test: `test/kugou-match.test.js`

**Interfaces:**
- Produces: `scoreKugouSongMatch(query, song)` and `normalizeKugouSong(raw)`.
- Consumes: existing Kugou search and playlist mapping.

- [ ] Write failing tests for same-title artist matching, duration proximity, album/cover normalization, and playable metadata.
- [ ] Implement helpers.
- [ ] Use helpers in Kugou search and playlist-track mapping.
- [ ] Improve user-facing restriction messages for login, VIP, copyright, and URL lookup failures.
- [ ] Run `node --test test/kugou-match.test.js`.
- [ ] Use Chrome plugin to search and inspect Kugou results and playback failure messaging.

### Task 5: Online Update Push and One-Click Download

**Files:**
- Create: `src/desktop/updateMetadata.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `server.js`
- Modify: `public/index.html`
- Modify: `dist/latest.yml` if publishing metadata is needed locally.
- Test: `test/update-metadata.test.js`

**Interfaces:**
- Produces: `normalizeUpdateInfoForClient(info, currentVersion)`.
- Consumes: existing update check/download endpoints and GitHub Releases metadata.

- [ ] Write failing tests that `1.3.x` clients see `1.4.0` as available and same-version clients do not.
- [ ] Set app version metadata to `1.4.0`.
- [ ] Ensure `latest.yml` points at `Mineradio-Setup-1.4.0.exe` and includes the correct blockmap/sha data if present.
- [ ] Improve renderer update notification copy and one-click download/open installer states.
- [ ] Run `node --test test/update-metadata.test.js`.
- [ ] Use Chrome plugin with a mocked update response to verify notification, download, progress, failure, and open-installer UI states.

## Self-Review

- Spec coverage: all five requested tasks map to one task each.
- Placeholder scan: no TBD/TODO placeholders remain.
- Type consistency: exported helper names are defined in their producing tasks and consumed by later wiring.
