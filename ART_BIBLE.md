# Tiliq — Sky Harbor

## Established visual direction

Authoritative references: `reference/home-reference.png`, `reference/game-reference.png`.
Style: illustrated sky port, polished brass, ivory enamel, blue instrument panels, colored enamel cargo tiles. Preserve the existing composition and artwork. This pass creates procedural Canvas materials, not new raster artwork.

## Existing palette

- Navy: #08233c, #0a3157, #0d4a7b
- Sky: #1686c1, #70c6e9
- Brass: #8a5422, #bb762d, #e3ad53, #f8e2aa
- Ivory: #fff6e5
- Action coral: #e96749
- Warning: existing bomb red #ff4054
- Block colors: active theme CLR values; all purchased palettes remain supported.

## Materials and legibility

Blocks: original pre-polish Sky Harbor renderer restored at the user's request: glossy colored face, warm rim, oval highlight and small central ring. No replacement seals or new atlas. Empty board sockets retain the reference ivory surface. Legal placement has a segmented outline; lines that will clear get a thin brass perimeter. Keep scores and controls unobscured.

## Sound direction

Retain the original Sky Harbor harp/celesta music. Replace sharp SFX with short ceramic/wood clicks, harmonic clear chimes, soft bass and filtered air for powers. Use the AudioContext clock, bounded voice count, cached noise, compressor and automatic music ducking. Independent SFX/music levels, remembered settings, silence on background and mute.

## Technical budget

Original procedural Canvas tiles and cached board layer; the experimental ~1 MiB enamel atlas was removed when the user selected the old squares. No new downloaded art/audio. At most 24 SFX voices; one cached noise buffer. New effects use time-based fading and honor reduced motion. Existing transient particles share a total budget of 100 (30 on low-tier/reduced motion).

These are implementation budgets, not physical-device performance measurements. Browser QA and measurements are recorded separately in docs/.

## Score polish and hammer terminology (user follow-up)

Score count-up uses a 420–700 ms smooth transition from the actual displayed value. Small HUD emphasis peaks at 1.025× scale. Score badges rise 14px over 1.1 seconds with gentle fade-in/out; reduced motion disables travel and count-up. No additional textures, particles or colors. Use Hammer terminology in all 14 languages, retaining stable inventory and function IDs for save compatibility.

## Combo polish (user follow-up)

Standard combo: two moving cyan/brass comet trails on the outside frame; four trails at high tiers. Small compass nodes at the four corners, no thick rails over playable cells. On a clear at combo 2+, show a short enamel pilot ribbon with localized combo label, the same combo count as the HUD, and five energy dots. Purchased combo effects remain selected; the new clear announcement is shared. Reduced motion uses a static frame and fades the announcement. No additional particle emitters or image assets.

## Living Harbor / gem removal — local review

User-authorized HUD exception: remove the unused gem wallet, spread the remaining two wallet slots across the existing area. No save deletion; rank names are not currency. Remove light/dark settings and ignore legacy local/cloud preferences; retain the established fixed Sky Harbor appearance and purchased block palettes.

Retain all reference artwork, layout, palette and purchased themes. Add two small CSS cloud wisps behind menu content; subtle ivory/brass panel highlights; consistent raised button press states; short card entrances and hero-icon motion only in visible panels; 240 ms tray-piece settling and a selected-tray marker. No continuous movement of the board or playable cells. Old tile drawing is unchanged; no new bitmap assets.

Decorative motion disabled on reduced-motion/low-resource paths, paused when hidden or covered by a modal. No new particles. Two cloud layers, each max 300×96 CSS px; other decorations reuse existing elements. Native GPU/RAM/FPS must be measured on physical devices, not inferred from these budgets.

## Claimable rewards and dialog hierarchy

Use compact coral badges with navy exclamation/count and ivory/brass outlines on missions, daily mail and home navigation. Count only completed/unclaimed missions and today's unclaimed daily reward. Count and shape supplement color (UI law 19). Pulse for three cycles only; disabled for low/reduced-motion modes. Use existing localized rewardReadyCount in accessible labels/tooltips. No textures or particles added; four reusable badge elements.

Add-friend is a child dialog above leaderboard: z-index 240 vs 200. Leaderboard becomes inert while the dialog is active. Focus stays inside the dialog and returns to the opener on close; login/offline gates retain their higher priority.
