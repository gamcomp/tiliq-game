# Banner recovery — 2026-09-19 / 1.3.99

## Changes
- Retry after 2, 5, 10, 30, then 60 seconds; reset backoff on impression or foreground/network recovery.
- Bound loading to 20 seconds; serialize removal before replacement.
- Restore cached banners immediately, reload expired caches without retry delay.
- Ignore obsolete JS completions and native SDK load callbacks after removal.
- Unity show completion restores banner state even if the loaded event is missed.
- Keep existing HUD spacer policy, SDK version, ad IDs and rewarded settlement.

## Validation
- test:banner: passed (missing loaded event, cached resume, expired cache, duplicate failure, timeout, stale completion, hiding during load, foreground, rewarded exclusion).
- test:rewarded, test:rewarded-settlement, test:att: passed.
- Social/menu smoke test: passed (14 languages, 5 viewport widths).
- Web mirrors copied and Capacitor iOS assets copied.
- Native compilation and TestFlight upload: pending CI.
- Live device / live ad inventory: not verified in this Windows session.

## Performance
No new assets, rendering passes or polling loops. At most one banner load timer and one retry timer; both cleared on hide. FPS/RAM require device measurement. Ad inventory and connection latency still determine fill time.
