# Sky Harbor — local sound, material and combo review

Date: 2026-09-09. Status: integrated in web sources, awaiting user playtest. No deployment, native build, release upload or version bump.

## Open

Run `node scripts/preview-server.mjs` from this repository, then open http://localhost:4179.
The server binds only to loopback. Its in-memory preview disables Firebase initialization and remote connections through CSP. Local preview files are not copied into www. Baseline uses committed HEAD and improved uses the working tree; changing HEAD changes the baseline on a server restart.

## Changes

- User selected the original glossy tiles: the original renderer is restored exactly. The experimental enamel atlas is removed.
- Legal placement outlines and predicted line-clear borders; short direction-aware light sweeps.
- Ceramic placement sounds, harmonic clear chimes, bass/air bomb and color-blast sounds. A shared limiter, 24-voice cap, cached noise and cleanup apply to legacy effect calls as well.
- Independent effects/music levels; mute also silences effects already playing. Music ducks for power/clear cues. Resuming music no longer schedules a backlog of missed notes.
- Combo: moving brass/cyan perimeter trails, four small compass nodes, temporary localized combo ribbon and HUD number pop. High combo uses four trails. Purchased combo selections are retained.
- Shared transient particle budget: 100 on desktop, 30 on low-tier/reduced-motion paths. New effects honor reduced motion.

## Checks

`node scripts/check-harbor-preview.mjs` checks 360×640, 390×844, 430×932, 768×1024 and 1440×1000. It exercises real line clears, combo 10 (+500 points), last-bomb warning, bomb targeting and consumption, settings, audio output/mute/cleanup, and baseline switching. Screenshots and measured results: `preview/artifacts/qa.json` (local, git-ignored).

Browser run: no JavaScript page errors, no external network requests, no horizontal overflow at these sizes. A separate Android-user-agent/reduced-motion run checks the 30-particle budget and disabled number animation. ATT ordering and rewarded-ad regression scripts passed.

Desktop Chromium CPU submission measurements (full 64-cell board, 120 draws) are in the latest `preview/artifacts/qa.json`. The earlier atlas speedup no longer applies after restoring the original tiles. These are not end-to-end frame time, GPU draw-call count or physical-device FPS/battery measurements. Physical iOS/Android tests remain pending.

## Playtest

1. Compare “Önceki / Geliştirilmiş” on “Örnek tahta”.
2. Use “Çift sıra & kombo” or “Yüksek kombo”, then “Hazır hamleyi yerleştir”.
3. Try “Son şans: çekiç” using the actual in-game target/confirm flow.
4. Listen with “Sesleri dinle”; adjust individual mix levels in “Ses ayarları”.
5. Start “Yeni oyun” and play normally; check visibility and sound comfort.

Automatic browser launch was rejected by the environment policy. Open the localhost link manually. No attempt to bypass the restriction was made.

## Score / hammer follow-up

Score now retargets from the visible number, not the previous target. 420–700 ms smoothstep, subtle 1.025× HUD emphasis, time-based 1.1 s score badges; reset/restore cancels old animation frames. Reduced motion settles scores immediately. Point awards and combo multipliers are unchanged. No extra texture memory or particles; one active score animation frame loop.

`hammer-i18n.js` overrides Hammer terminology in all 14 supported locales, including button, super ability, inventory, packs, unlock, tutorial, last-chance hint and target-cancel accessibility label. Internal bomb IDs and saved inventory keys are intentionally unchanged. Daily reward and inventory celebration use localized text instead of bomb emoji.

`node scripts/check-score-hammer.mjs`: passed rapid retargeting without jumps, monotonic count-up, final totals, new-game reset, badge lifetime, reduced motion, and all 14 locale keys/labels/ARIA. Screenshots for TR/DE/RU/AR/JA inspected; no horizontal overflow at 390px. Results: `preview/artifacts/score-hammer-qa.json`. The five-size gameplay/audio suite also passed. Native builds and physical-device measurements remain pending; no release was published.

## Living Harbor and latest user corrections

- Gem currency HUD and its reads removed; coin/streak split the same wallet area. Stored gem values are preserved, not deleted.
- Light/dark selector removed. Fixed Sky Harbor uses dark base tokens; legacy light values from local storage or cloud cannot switch it back. Purchased palettes remain available.
- Original tile function matches committed HEAD byte-for-byte after newline normalization.
- Two small moving cloud wisps behind the menu, raised panel material, button press responses, short card/modal entrances, daily reward icon motion, progress transitions, tray piece settle and selected-tray marker. No new particles or raster assets. Hidden pages pause CSS motion; low-resource/reduced-motion paths disable new decorations.
- `node scripts/check-living-harbor.mjs`: 9 screens × 5 viewports passed, including panel bounds, no external requests or JavaScript errors, preservation of old gem data, fixed appearance, low-resource and reduced-motion cases. Screenshots at 390px inspected for menu, board, settings and store.
- Preview now has direct buttons for missions, daily reward, store, ranking (offline state), profile and game over. All changes remain local, with no native build/upload/deployment.

## Claimable rewards / add-friend

The old mission-ready status was updated in JavaScript but hidden by the reference-card CSS. Added separate count badges on mission/mail cards and both home-navigation entries. Incomplete/claimed tasks do not count; claiming updates badges immediately. On resume/day rollover/storage changes, counts refresh. Existing 14-language reward labels provide tooltips/ARIA. Three pulse cycles, no extra texture/particle use.

Add-friend and leaderboard previously shared z-index 200, and the later leaderboard element covered the dialog. Add-friend now uses 240, with an inert leaderboard, trapped keyboard focus, Escape dismissal and opener focus restoration. Closing without a signed-in account no longer prompts a fresh login solely from the close handler.

`node scripts/check-rewards-friends.mjs` passed at widths 360/390/430/768/1440: zero/ready/claimed reward states, exact mission award without double-claim, date rollover, real Add Friend button, hit-testing the front input, typing, keyboard focus containment, dismissal and parent restoration. Local identity fixtures only: live friend lookup/add and backend messaging were not tested. Results and screenshots are in `preview/artifacts/rewards-friends-qa.json` and neighboring PNGs. Preview buttons “Hazır ödül örneği” / “Arkadaş ekleme” exercise these flows without publishing.
