# iOS 1.3.103 App Store submission — 2026-09-21

User explicitly authorized live iOS publication, followed by Android preparation.
Release source includes ad lifecycle/reward corrections, removal of the ad transition panel, responsive home menu and hammer targeting layout fixes.

Production CI generates live Unity ad configuration for root/www, verifies the native bundled copy, prepares 14 localized release notes, signs/uploads the IPA and submits the matching version with AFTER_APPROVAL automatic release. Test branch inventory configuration remains enabled for device testing. Release and TestFlight jobs share one concurrency group to avoid build-number races.

Validation: production configuration in isolated temporary workspace passed; store asset validation passed (14 locales, 168 screenshots). Layout and reward regressions were completed on the preceding source commits. Store approval and release status require App Store Connect confirmation.

Android is a separate follow-up: its Game/Placement IDs are currently empty. Do not ship its ad-disabled fallback as a working monetization integration.
