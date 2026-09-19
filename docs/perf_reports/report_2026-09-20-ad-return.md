# Direct return after ads — 2026-09-20 / 1.3.100

- Removed the shared loading/error/reward-flow panel from the DOM and all ad paths.
- Earned rewards apply automatically; dismiss/skip/failure returns to the underlying screen.
- Existing no-fill rescue and AdMob sandbox fallback apply immediately without a second tap. Optional Unity rewards still require earned confirmation.
- Browser preview no longer shows a simulated countdown panel.
- Native advertising SDK, IDs, and banner lifecycle unchanged.

Validation: rewarded settlement (15 shows including hammer, continue, coins and daily), fallback policy, banner lifecycle, ATT order, and menu smoke tests passed. All HTML mirrors synchronized; Capacitor iOS copy completed.
Native build/TestFlight pending CI. Device testing pending.
Performance: removed a full-screen panel and mock timer; no new assets or render passes. Device FPS/RAM not measured.
