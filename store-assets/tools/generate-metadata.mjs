import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const storeAssetsDir = path.resolve(toolsDir, '..');
const deployDir = path.resolve(storeAssetsDir, '..');
const workspaceDir = path.resolve(deployDir, '..');
const sourcePath = path.join(storeAssetsDir, 'store-metadata.json');
const source = JSON.parse(await fs.readFile(sourcePath, 'utf8'));
const localeEntries = Object.entries(source.locales);

const chars = (value) => [...value].length;
const bytes = (value) => Buffer.byteLength(value, 'utf8');
const problems = [];

if (localeEntries.length !== 14) {
  problems.push(`Expected 14 locales, found ${localeEntries.length}.`);
}

try {
  const supportUrl = new URL(source.supportUrl);
  if (supportUrl.protocol !== 'https:') {
    problems.push('supportUrl must use HTTPS.');
  }
} catch {
  problems.push('supportUrl must be a valid URL.');
}

for (const [googleLocale, locale] of localeEntries) {
  const checks = [
    ['title', chars(locale.title), 30],
    ['shortDescription', chars(locale.shortDescription), 80],
    ['fullDescription', chars(locale.fullDescription), 4000],
    ['subtitle', chars(locale.subtitle), 30],
    ['promotionalText', chars(locale.promotionalText), 170],
    ['releaseNotes', chars(locale.releaseNotes), 500],
  ];
  for (const [field, actual, limit] of checks) {
    if (actual > limit) problems.push(`${googleLocale}.${field}: ${actual}/${limit} characters.`);
  }
  if (bytes(locale.keywords) > 100) {
    problems.push(`${googleLocale}.keywords: ${bytes(locale.keywords)}/100 UTF-8 bytes.`);
  }
  if (!Array.isArray(locale.screenshots) || locale.screenshots.length !== 6) {
    problems.push(`${googleLocale}.screenshots: expected exactly 6 taglines.`);
  }
  const joined = JSON.stringify(locale);
  if (/�|Ã.|â€|\u0000/u.test(joined)) {
    problems.push(`${googleLocale}: replacement or mojibake characters detected.`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const writeText = async (filePath, content) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${content.trim()}\n`, 'utf8');
};

const googleListings = [];
const appStoreLocalizations = [];

for (const [googleLocale, locale] of localeEntries) {
  const googleDir = path.join(storeAssetsDir, 'metadata', 'google-play', googleLocale);
  await writeText(path.join(googleDir, 'title.txt'), locale.title);
  await writeText(path.join(googleDir, 'short_description.txt'), locale.shortDescription);
  await writeText(path.join(googleDir, 'full_description.txt'), locale.fullDescription);
  await writeText(path.join(googleDir, 'changelogs', `${source.versionCode}.txt`), locale.releaseNotes);
  await writeText(path.join(googleDir, 'screenshot_taglines.txt'), locale.screenshots.join('\n'));

  const appStoreDir = path.join(storeAssetsDir, 'metadata', 'app-store', locale.appStoreLocale);
  await writeText(path.join(appStoreDir, 'name.txt'), locale.title);
  await writeText(path.join(appStoreDir, 'subtitle.txt'), locale.subtitle);
  await writeText(path.join(appStoreDir, 'promotional_text.txt'), locale.promotionalText);
  await writeText(path.join(appStoreDir, 'description.txt'), locale.fullDescription);
  await writeText(path.join(appStoreDir, 'keywords.txt'), locale.keywords);
  await writeText(path.join(appStoreDir, 'release_notes.txt'), locale.releaseNotes);
  await writeText(path.join(appStoreDir, 'support_url.txt'), source.supportUrl);
  await writeText(path.join(appStoreDir, 'screenshot_taglines.txt'), locale.screenshots.join('\n'));

  googleListings.push({
    language: googleLocale,
    title: locale.title,
    fullDescription: locale.fullDescription,
    shortDescription: locale.shortDescription,
  });
  appStoreLocalizations.push({
    locale: locale.appStoreLocale,
    name: locale.title,
    subtitle: locale.subtitle,
    promotionalText: locale.promotionalText,
    description: locale.fullDescription,
    keywords: locale.keywords,
    releaseNotes: locale.releaseNotes,
    supportUrl: source.supportUrl,
  });
}

const googlePayload = { kind: 'androidpublisher#listingsListResponse', listings: googleListings };
await fs.writeFile(
  path.join(storeAssetsDir, 'metadata', 'google-play-listings.json'),
  `${JSON.stringify(googlePayload, null, 2)}\n`,
  'utf8',
);
await fs.writeFile(
  path.join(storeAssetsDir, 'metadata', 'app-store-localizations.json'),
  `${JSON.stringify({ version: source.version, localizations: appStoreLocalizations }, null, 2)}\n`,
  'utf8',
);

// Keep the existing workspace-level Google Play export in sync with the new source of truth.
await fs.writeFile(path.join(workspaceDir, 'listings_full.json'), `${JSON.stringify(googlePayload, null, 2)}\n`, 'utf8');

const manifest = {
  appVersion: source.version,
  versionCode: source.versionCode,
  updatedAt: source.updatedAt,
  supportUrl: source.supportUrl,
  localeCount: localeEntries.length,
  screenshotCountPerLocale: 6,
  platforms: {
    googlePlay: {
      size: '1080x1920',
      format: 'JPEG',
      directory: 'screenshots/google-play/<locale>/phone',
    },
    appStore: {
      size: '1260x2736',
      format: 'JPEG',
      directory: 'screenshots/app-store/<locale>/iphone-6.9',
    },
  },
  googleLocales: localeEntries.map(([googleLocale]) => googleLocale),
  appStoreLocales: localeEntries.map(([, locale]) => locale.appStoreLocale),
};
await fs.writeFile(
  path.join(storeAssetsDir, 'upload-manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
);

console.log(`Generated metadata for ${localeEntries.length} locales.`);
console.log(`Google Play: ${path.join(storeAssetsDir, 'metadata', 'google-play')}`);
console.log(`App Store:   ${path.join(storeAssetsDir, 'metadata', 'app-store')}`);
