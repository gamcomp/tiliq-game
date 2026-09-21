# 1.3.104 portrait lock and release

User requested the game stay upright even with phone auto-rotate enabled. iPhone/iPad supported orientation arrays now contain portrait only; iPad full-screen opt-in added. Android MainActivity uses screenOrientation=portrait. Existing game layout and native ad SDK unchanged.

Android assembleDebug passed; merged application manifest confirms portrait on MainActivity. iOS plist arrays inspected. Physical rotation test pending.

Supersedes the queued 1.3.103 production job (cancel accepted by GitHub). 1.3.104 release uses production Unity configuration and AFTER_APPROVAL publication. The CLI may replace an older pending App Store submission so the latest authorized update is reviewed. Android debug version aligned to 1.3.104 (156); Android ad IDs still pending and no Android store upload authorized/completed in this turn.
