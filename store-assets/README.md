# Tiliq Store Refresh — 1.3.88

This directory is the source of truth for the Google Play and App Store refresh completed on 2026-08-27.

## Deliverables

- 14 localized Google Play listings under `metadata/google-play/`
- 14 localized App Store listings under `metadata/app-store/`
- 6 localized Google Play phone screenshots per locale under `screenshots/google-play/`
- 6 localized App Store iPhone 6.9-inch screenshots per locale under `screenshots/app-store/`
- 168 final JPEG screenshots in total: 84 per platform
- Google Play app icon (`512×512`) and feature graphic (`1024×500`) under `graphics/google-play/`
- Machine-readable exports in `metadata/google-play-listings.json` and `metadata/app-store-localizations.json`
- Upload mapping and version data in `upload-manifest.json`

The canonical copy is `store-metadata.json`. Generated text files and the workspace-level `listings_full.json` are derived from it.

## Locales

| Google Play | App Store | In-game language |
| --- | --- | --- |
| tr-TR | tr | Turkish |
| en-US | en-US | English (U.S.) |
| de-DE | de-DE | German |
| fr-FR | fr-FR | French |
| es-ES | es-ES | Spanish (Spain) |
| it-IT | it | Italian |
| pt-BR | pt-BR | Portuguese (Brazil) |
| ru-RU | ru | Russian |
| ja-JP | ja | Japanese |
| ko-KR | ko | Korean |
| zh-CN | zh-Hans | Simplified Chinese |
| hi-IN | hi | Hindi |
| ar | ar-SA | Arabic |
| nl-NL | nl-NL | Dutch |

## Generate and validate

Run from `deploy-tiliq/`:

```powershell
npm run store:metadata
npm run store:screenshots
npm run store:validate
node store-assets/tools/generate-google-brand-assets.mjs
```

To regenerate one locale while reviewing copy or layout:

```powershell
node store-assets/tools/capture-screenshots.mjs --locale=tr-TR
```

The capture tool uses the real current `index.html` UI at a 500×932 reference viewport. It seeds only demo score, board, reward, and anonymous ranking data; it does not replace the game UI with a mockup. Final screenshots use localized taglines and an opaque JPEG export.

## Store specifications used

- Google Play: 1080×1920 portrait JPEGs, six per locale. This meets the 9:16, minimum-1080 recommendation for games and stays within the 320–3840 pixel requirement. Additional tagline text occupies less than 20% of each image.
- App Store: 1260×2736 portrait JPEGs for the current iPhone 6.9-inch screenshot class, six per locale.
- Google listing limits: title 30 characters, short description 80, full description 4000.
- App Store limits: name 30 characters, subtitle 30, promotional text 170, description 4000, keywords 100 UTF-8 bytes.

Official references:

- https://support.google.com/googleplay/android-developer/answer/9866151
- https://support.google.com/googleplay/android-developer/answer/9859152
- https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- https://developer.apple.com/help/app-store-connect/reference/app-information/platform-version-information/

## Publishing

Credentials must stay outside the repository. Pass a local Google Play service-account JSON file explicitly:

```powershell
node store-assets/tools/upload-google-play.mjs --credentials "C:\secure\play-service-account.json" --verify
node store-assets/tools/upload-google-play.mjs --credentials "C:\secure\play-service-account.json" --commit --brand-assets
node store-assets/tools/release-google-play.mjs --credentials "C:\secure\play-service-account.json" --bundle "android\app\build\outputs\bundle\release\app-release.aab" --track alpha --commit
```

The 14 localized listings, 84 phone screenshots, 14 localized icons, and 14 localized feature graphics were committed to Google Play on 2026-08-27. Android `1.3.88` (`versionCode 148`) is active on the closed-testing track. Production remains gated by Google Play's production-access requirement for new personal accounts.

App Store metadata and screenshots were uploaded through the repository's App Store Connect workflow. iOS binaries are built and uploaded through `.github/workflows/ios-release.yml` without storing signing material in the repository.
