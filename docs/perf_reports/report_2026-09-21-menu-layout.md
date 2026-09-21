# Responsive menu — 2026-09-21 / 1.3.102

Fixed the play/mail overlap reported on a phone with a visible native banner.

Root causes: menu flex spacer and absolute CTA banner offset both reserved the same ad height; right-side cards were not bounded by the CTA position. Short-screen navigation sizing also used inconsistent offsets.

Changes: menu uses one banner reservation, shared footer dimensions, bounded card column and flexible card/icon heights. Existing reference hierarchy, artwork, colors, navigation and gameplay layout retained. CSS cache version updated and web/iOS copies synchronized.

Validation: 33 automated rectangle checks over 11 phone/tablet viewports with 0/50/90 px banners, simulated status/notch/home-indicator safe areas. No play/action/nav intersections; checked controls at least 44 px. Screenshot visually compared with reference/home-reference.png. Native device confirmation remains pending.

Performance: CSS only, no resize observers, JS frame loops or new assets. Device FPS/RAM not measured.
Previous ad audit build 1.3.101 completed successfully; this build includes those changes.
