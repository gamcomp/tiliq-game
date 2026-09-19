# Ads audit and recovery — 2026-09-20 / 1.3.101

Scope: shared ad manager, Unity provider, iOS native bridge, reward callers, banner lifecycle, foreground/online recovery. Android bridge inspected; Android native runtime/device validation not performed. iOS is the configured target for this test release.

## Fixed
- Interstitial preload is shared; reserve fullscreen before awaiting it. Rewarded/interstitial requests cannot overlap during preparation.
- Interstitial cleanup works with Unity promise-only completion, events despite a hanging promise, failed show, or partial listener setup; hides/restores banner and audio.
- Native iOS initialization, presentation and load/show callbacks serialized on main queue.
- Per-request load/show delegates reject obsolete results; native loads release their lock after 20 seconds, initialization after 25 seconds. JS load deadlines are longer than native deadlines and cleared after settlement.
- Completed placement-based Unity reward no longer depends on receiving a separate start notification. Skipped/failed ads still do not grant optional rewards.
- Increased overly short 75-second native / 90-second JS show recovery limits to 180/195 seconds to accommodate longer creatives. Timeout is never proof of reward.
- Transient consent/info errors no longer cache initialization forever; online/foreground can retry.
- Partial banner listener setup cleans up before retry.
- Removed post-ad panel remains absent; existing reward and no-fill rescue policy retained.

## Verification
Passed: rewarded flow, 15-session reward settlement with real hammer/continue/coin/daily callers, banner recovery, fullscreen lifecycle/concurrency, consent recovery, ATT ordering, social/menu smoke (14 languages, 5 viewport sizes).
Native compile and TestFlight delivery pending CI. Physical-device/live-inventory validation pending.

## Performance
Timers are cleared after completion. Single shared preload per format; no new render passes or assets. Device FPS/RAM not measured. No claim of guaranteed fill or absence of third-party creative errors.

Unity placement reward contract: https://docs.unity.com/en-us/grow/ads/ios-sdk/rewarded-ads
