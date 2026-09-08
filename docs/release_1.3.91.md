# Tiliq 1.3.91 release

User authorized Android/iOS updates on 2026-09-09 after the local review iterations.

Includes: retained original tiles, refined sounds/combo/score feedback, Hammer in 14 languages, removed gem HUD and light/dark selection, restrained panel/cloud motion, claimable reward counts, fixed Add Friend stacking and keyboard focus.

Android versionCode: 155. iOS marketing version: 1.3.91; CI increments the build number from App Store/TestFlight.

Checks: score/Hammer, rewards/friend dialog, rewarded-ad and ATT regressions passed. Android bundleRelease succeeded. Main HTML and three new JS/CSS resources in the signed bundle match www SHA-256. No local preview fixture files in the bundle. Physical-device testing was not performed in this release turn.

Google Play preflight: production has no release and rejects a non-committing track check with FAILED_PRECONDITION. Existing alpha/internal releases are 1.3.90 (154). Update will use the existing alpha track; general availability requires resolving the Play Console prerequisite.

iOS workflow uploads and submits the matching version for App Store review with 14 localized release notes, automatic release only after Apple approval. Existing approved screenshots/review details are not overwritten by this workflow.

Final upload/build/review status is recorded in the task handoff; this document does not assert store approval.
