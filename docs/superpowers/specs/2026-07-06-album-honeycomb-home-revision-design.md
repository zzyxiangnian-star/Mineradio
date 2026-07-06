# Mineradio Album Honeycomb Home Revision Design

**Date:** 2026-07-06

**Status:** Approved for implementation planning

**Scope:** Refine the already-landed album honeycomb home in `D:\Mineradio\.worktrees\album-honeycomb-home`. This revision keeps the existing playback bridge, playlist selection flow, Music Soul shortcut input, and visual-console location. It changes only the vinyl player visual, honeycomb spacing/fade, home placement, and the small player wallpaper media setting.

## Goals

1. Keep the current left player area, text, controls, and Music Soul layout intact, while making the vinyl record and tonearm match the provided reference more closely.
2. Make the right honeycomb read like separated circular app icons: no overlap, visible gaps, and fewer simultaneous discs if needed.
3. Make discs at the edge of the circular viewport fade out naturally instead of remaining crisp until clipped.
4. Separate the two main home UI blocks so the small player sits near the desktop left side and the honeycomb is centered in the right-side empty area.
5. Convert the existing visual-console "AI DJ showcase wallpaper" control into a small-player wallpaper control that supports both images and videos.

## Non-Goals

- Do not redesign the full home page from scratch.
- Do not replace the existing `MineradioVinylHome` controller, playback queue bridge, playlist picker bridge, Music Soul chat bridge, or provider APIs.
- Do not add React, Vue, Canvas, Three.js, or a new animation library.
- Do not change the full immersive player, bottom bar, search, login, desktop lyrics, or existing global background media system.
- Do not alter unrelated dirty changes currently present in `src/desktop/main.js` and `test-ai-modules.js` except where tests must be extended for this revision.

## Design

### 1. Left Vinyl UI

The left player card keeps its current structure: intro header, vinyl deck, track line, controls, and shortcut chat. Only the visual record and tonearm are revised.

The record remains a black vinyl disc with a circular album cover and center hole. Playback rotation continues on the full vinyl disc while audio is actually playing. When the current track changes, the album cover fades out briefly, updates its background image, then fades back in. The disc itself must not jump, resize, or restart visibly during that cover swap.

The tonearm changes to the reference-style white bent arm above the record:

- A circular white pivot sits above the record.
- The arm has an angled/bent path rather than a straight bar.
- A white cartridge/head sits near the record side.
- The resting pose is raised above the record.
- When playback becomes active, the arm eases along a rotation path down to the outer record ring.
- When playback pauses, errors, or ends, the arm follows the same path back up.

The player can keep Mineradio's dark/glass visual language around the deck. The requested strictness applies to the record-and-tonearm UI, not to the surrounding text or controls.

### 2. Honeycomb Spacing

The honeycomb remains a virtualized hex-grid of circular album discs, but the geometry changes from overlapping discs to separated discs.

The layout engine should use visible gaps of roughly 15% to 20% of disc diameter. A practical target is:

- horizontal spacing: about `1.18 * iconSize`
- vertical spacing: about `1.04 * iconSize`
- alternating rows still offset by half the horizontal spacing

The controller may reduce icon size modestly so the circular viewport still feels populated, but discs must not overlap in normal desktop sizes. Center emphasis can remain through scale and z-index, but it must not cause the center disc to cover its neighbors. If necessary, center scale should be capped lower than the current value.

### 3. Edge Fade

The circular viewport uses two fade layers:

1. Per-disc fade from `visualForPoint()`: opacity drops strongly as the disc approaches the circular boundary.
2. Viewport edge fade: a radial mask or overlay softens the outer ring so the edge feels misted rather than hard-clipped.

The edge discs should look partially lost into the circular frame before they are clipped. The viewport still clips all pixels outside the circle, and it remains visually borderless.

### 4. Home Placement

The two-column 40:60 relationship remains, but the blocks no longer sit visually crowded together.

The home shell should use the available desktop width more intentionally:

- The left small player aligns closer to the desktop left side.
- The right honeycomb remains centered inside the right-side empty area.
- The gap between the two blocks increases enough that they no longer appear stuck together.
- The layout still works at the existing minimum desktop size without horizontal scrolling.

This is a layout refinement, not a change to the home visibility rules or playback state rules.

### 5. Small-Player Wallpaper Media

The current visual-console row for "AI DJ showcase wallpaper" becomes "small player wallpaper".

The setting applies to the entire left player card background layer. The wallpaper sits behind the intro, record, controls, and chat; the existing dark overlay remains so foreground content stays readable.

Supported media:

- Images: keep the existing compressed data URL behavior where possible.
- Videos: accept common video files and render them in the left card background as muted, looped, playsinline media.

Control behavior:

- The visual-console row keeps a select button, label, and clear button.
- The hidden file input accepts both image and video MIME types.
- The label reports "custom image", "custom video", or "default".
- Clearing the setting removes the image/video layer and restores the default look.

The implementation should reuse the project's existing media-normalization patterns where they fit, but the left player wallpaper remains independent from the global background media setting.

## Component Boundaries

- `public/home-vinyl.css`: record visual, reference-style tonearm, viewport edge fade, spacing-aware visual styling, and home placement.
- `public/home-vinyl-layout.js`: hex spacing, per-disc opacity/scale curve, and any layout tests for non-overlap/fade.
- `public/home-vinyl.js`: cover fade sequencing if needed, bounded center scale, and media-safe render updates.
- `public/index.html`: wallpaper media markup, visual-console labels/input accept list, settings persistence, and file reading.
- `test-ai-modules.js`: contract tests for the revised tonearm classes, no-overlap layout spacing, stronger edge opacity falloff, and image/video wallpaper support.

## Acceptance Criteria

1. The left player card's surrounding UI remains recognizable and unchanged except for the record/tonearm and wallpaper layer.
2. The tonearm visually resembles the provided reference: white, bent, placed above the disc, with pivot and cartridge/head.
3. Playback lowers the tonearm to the record's outer ring with easing; pause/end/error raises it along the same path.
4. The black vinyl disc rotates continuously while audio is truly playing.
5. Track changes fade the old cover out, update the cover, then fade the new cover in without moving the full disc.
6. Right-side honeycomb discs no longer overlap at normal desktop sizes.
7. Honeycomb spacing reads as clear gaps of roughly 15% to 20% of disc diameter.
8. Edge discs fade through both per-disc opacity and viewport edge treatment before clipping.
9. The circular viewport remains borderless and clips all outside pixels.
10. The left small player sits closer to the desktop left side, while the honeycomb is centered in the right blank area.
11. The two UI blocks have noticeably more breathing room than in the current screenshot.
12. The visual-console wallpaper row supports both image and video selection for the left small player.
13. Selected video wallpaper plays muted, looped, and behind all left-card foreground content.
14. Clearing the wallpaper restores the default left player background.
15. Existing playlist selection, playback sync, Music Soul shortcut chat, search, global background, and immersive player behavior keep working.

## Verification

- Run `node test-ai-modules.js`.
- Start the Electron app and inspect the home page at normal desktop size and minimum desktop size.
- Verify play, pause, next, previous, and a track-change cover swap.
- Load a playlist with enough tracks to fill the honeycomb and confirm spacing, edge fade, clipping, and drag/click behavior.
- Pick an image wallpaper and a video wallpaper from the visual console, then clear the setting.
