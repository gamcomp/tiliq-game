import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const marker = join(root, "store-assets", ".upload-app-store-once");

if (process.env.GITHUB_ACTIONS !== "true" || !existsSync(marker)) {
  process.exit(0);
}

if (process.platform !== "darwin") {
  throw new Error("The one-time App Store upload must run on a macOS GitHub runner.");
}

const requiredEnvironment = [
  "APP_STORE_CONNECT_KEY_IDENTIFIER",
  "APP_STORE_CONNECT_ISSUER_ID",
  "APP_STORE_CONNECT_PRIVATE_KEY",
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`Missing required App Store Connect environment variable: ${name}`);
  }
}

const uploadRoot = mkdtempSync(join(tmpdir(), "tiliq-app-store-upload-"));
const metadataDestination = join(uploadRoot, "metadata");
const screenshotDestination = join(uploadRoot, "screenshots");
const apiKeyPath = join(uploadRoot, "app-store-connect-api-key.json");
const fastlaneDirectory = join(uploadRoot, "fastlane");
const metadataSource = join(root, "store-assets", "metadata", "app-store");
const screenshotSource = join(root, "store-assets", "screenshots", "app-store");
const metadataFiles = [
  "name.txt",
  "subtitle.txt",
  "promotional_text.txt",
  "description.txt",
  "keywords.txt",
  "release_notes.txt",
];

function run(command, args, workingDirectory = root, extraEnvironment = {}) {
  const result = spawnSync(command, args, {
    cwd: workingDirectory,
    env: {
      ...process.env,
      FASTLANE_HIDE_CHANGELOG: "1",
      FASTLANE_SKIP_UPDATE_CHECK: "1",
      ...extraEnvironment,
    },
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status}`);
  }
}

try {
  mkdirSync(metadataDestination, { recursive: true });
  mkdirSync(screenshotDestination, { recursive: true });
  mkdirSync(fastlaneDirectory, { recursive: true });

  const locales = readdirSync(metadataSource, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  let metadataCount = 0;
  let screenshotCount = 0;

  for (const locale of locales) {
    const localeMetadataDestination = join(metadataDestination, locale);
    const localeScreenshotDestination = join(screenshotDestination, locale);
    mkdirSync(localeMetadataDestination, { recursive: true });
    mkdirSync(localeScreenshotDestination, { recursive: true });

    for (const filename of metadataFiles) {
      copyFileSync(
        join(metadataSource, locale, filename),
        join(localeMetadataDestination, filename),
      );
      metadataCount += 1;
    }

    const localeScreenshots = readdirSync(
      join(screenshotSource, locale, "iphone-6.9"),
      { withFileTypes: true },
    )
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jpg"))
      .map((entry) => entry.name)
      .sort();

    for (const filename of localeScreenshots) {
      copyFileSync(
        join(screenshotSource, locale, "iphone-6.9", filename),
        join(localeScreenshotDestination, filename),
      );
      screenshotCount += 1;
    }
  }

  if (locales.length !== 14 || metadataCount !== 84 || screenshotCount !== 84) {
    throw new Error(
      `Expected 14 locales, 84 metadata files, and 84 screenshots; found ${locales.length}, ${metadataCount}, and ${screenshotCount}.`,
    );
  }

  console.log(
    `Staged ${metadataCount} metadata files and ${screenshotCount} screenshots for ${locales.length} App Store locales.`,
  );

  const privateKey = process.env.APP_STORE_CONNECT_PRIVATE_KEY.replace(/\\n/g, "\n");
  writeFileSync(
    apiKeyPath,
    JSON.stringify({
      key_id: process.env.APP_STORE_CONNECT_KEY_IDENTIFIER,
      issuer_id: process.env.APP_STORE_CONNECT_ISSUER_ID,
      key: privateKey,
      duration: 1200,
      in_house: false,
    }),
    { encoding: "utf8", mode: 0o600 },
  );
  chmodSync(apiKeyPath, 0o600);

  writeFileSync(
    join(fastlaneDirectory, "Fastfile"),
    `default_platform(:ios)

platform :ios do
  lane :store_metadata do
    deliver(
      api_key_path: ENV.fetch("TILIQ_ASC_API_KEY_PATH"),
      app_identifier: "com.tiliq.game",
      app_version: "1.3.88",
      platform: "ios",
      metadata_path: ENV.fetch("TILIQ_METADATA_PATH"),
      screenshots_path: ENV.fetch("TILIQ_SCREENSHOTS_PATH"),
      skip_binary_upload: true,
      overwrite_screenshots: true,
      force: true,
      submit_for_review: false,
      run_precheck_before_submit: false,
    )
  end
end
`,
    "utf8",
  );

  run("bash", [
    "-lc",
    "command -v fastlane >/dev/null 2>&1 || brew install fastlane",
  ]);

  run(
    "fastlane",
    ["ios", "store_metadata"],
    uploadRoot,
    {
      TILIQ_ASC_API_KEY_PATH: apiKeyPath,
      TILIQ_METADATA_PATH: metadataDestination,
      TILIQ_SCREENSHOTS_PATH: screenshotDestination,
    },
  );

  console.log("App Store metadata and screenshot upload completed successfully.");
} finally {
  if (existsSync(uploadRoot) && basename(uploadRoot).startsWith("tiliq-app-store-upload-")) {
    rmSync(uploadRoot, { recursive: true, force: true });
  }
}
