import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const storeAssetsDir = path.resolve(toolsDir, '..');
const metadata = JSON.parse(await fs.readFile(path.join(storeAssetsDir, 'store-metadata.json'), 'utf8'));
const entries = Object.entries(metadata.locales);
const failures = [];
let checkedScreenshots = 0;

const jpegDimensions = (buffer) => {
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) throw new Error('not a JPEG file');
  let offset = 2;
  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = buffer[offset + 1];
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    }
    if (marker === 0xd8 || marker === 0xd9) {
      offset += 2;
      continue;
    }
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if (!segmentLength) break;
    offset += 2 + segmentLength;
  }
  throw new Error('JPEG dimensions were not found');
};

const expectedFiles = ['01-home.jpg', '02-gameplay.jpg', '03-power-ups.jpg', '04-daily-rewards.jpg', '05-rankings.jpg', '06-customize.jpg'];
const targets = (googleLocale, entry) => [
  {
    label: `Google Play ${googleLocale}`,
    directory: path.join(storeAssetsDir, 'screenshots', 'google-play', googleLocale, 'phone'),
    width: 1080,
    height: 1920,
  },
  {
    label: `App Store ${entry.appStoreLocale}`,
    directory: path.join(storeAssetsDir, 'screenshots', 'app-store', entry.appStoreLocale, 'iphone-6.9'),
    width: 1260,
    height: 2736,
  },
];

for (const [googleLocale, entry] of entries) {
  for (const target of targets(googleLocale, entry)) {
    for (const fileName of expectedFiles) {
      const filePath = path.join(target.directory, fileName);
      try {
        const buffer = await fs.readFile(filePath);
        const dimensions = jpegDimensions(buffer);
        if (dimensions.width !== target.width || dimensions.height !== target.height) {
          failures.push(`${target.label}/${fileName}: ${dimensions.width}x${dimensions.height}, expected ${target.width}x${target.height}.`);
        }
        if (buffer.length > 8 * 1024 * 1024) {
          failures.push(`${target.label}/${fileName}: ${(buffer.length / 1024 / 1024).toFixed(2)} MB exceeds 8 MB.`);
        }
        checkedScreenshots += 1;
      } catch (error) {
        failures.push(`${target.label}/${fileName}: ${error.message}`);
      }
    }
  }

  const googleMetadataDir = path.join(storeAssetsDir, 'metadata', 'google-play', googleLocale);
  const appStoreMetadataDir = path.join(storeAssetsDir, 'metadata', 'app-store', entry.appStoreLocale);
  const requiredMetadata = [
    path.join(googleMetadataDir, 'title.txt'),
    path.join(googleMetadataDir, 'short_description.txt'),
    path.join(googleMetadataDir, 'full_description.txt'),
    path.join(googleMetadataDir, 'changelogs', `${metadata.versionCode}.txt`),
    path.join(appStoreMetadataDir, 'name.txt'),
    path.join(appStoreMetadataDir, 'subtitle.txt'),
    path.join(appStoreMetadataDir, 'promotional_text.txt'),
    path.join(appStoreMetadataDir, 'description.txt'),
    path.join(appStoreMetadataDir, 'keywords.txt'),
    path.join(appStoreMetadataDir, 'release_notes.txt'),
  ];
  for (const filePath of requiredMetadata) {
    try {
      const value = await fs.readFile(filePath, 'utf8');
      if (/�|Ã.|â€/u.test(value)) failures.push(`${filePath}: replacement or mojibake characters detected.`);
    } catch (error) {
      failures.push(`${filePath}: ${error.message}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}

console.log(`Validated ${entries.length} locales.`);
console.log(`Validated ${checkedScreenshots} final JPEG screenshots (${checkedScreenshots / 2} per platform).`);
console.log('All dimensions, file sizes, required metadata files, and encoding checks passed.');

