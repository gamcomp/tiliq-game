import { createSign } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const marker = path.join(root, 'store-assets', '.update-app-store-support-url-once');

if (process.env.GITHUB_ACTIONS !== 'true' || !existsSync(marker)) {
  process.exit(0);
}

const keyId = process.env.APP_STORE_CONNECT_KEY_IDENTIFIER;
const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID;
const privateKey = process.env.APP_STORE_CONNECT_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!keyId || !issuerId || !privateKey) {
  throw new Error('App Store Connect API credentials are missing.');
}

const metadata = JSON.parse(
  await readFile(path.join(root, 'store-assets', 'store-metadata.json'), 'utf8'),
);
const appId = '6789283001';
const expectedLocales = new Set(
  Object.values(metadata.locales).map(({ appStoreLocale }) => appStoreLocale),
);

const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsignedToken = `${encode({ alg: 'ES256', kid: keyId, typ: 'JWT' })}.${encode({
  iss: issuerId,
  iat: now,
  exp: now + 15 * 60,
  aud: 'appstoreconnect-v1',
})}`;
const signer = createSign('SHA256');
signer.update(unsignedToken);
signer.end();
const signature = signer
  .sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
  .toString('base64url');
const token = `${unsignedToken}.${signature}`;

const request = async (urlOrPath, options = {}) => {
  const response = await fetch(new URL(urlOrPath, 'https://api.appstoreconnect.apple.com'), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const details = payload?.errors
      ?.map((error) => `${error.code}: ${error.detail}`)
      .join('; ') ?? text;
    throw new Error(`${response.status} ${response.statusText}: ${details}`);
  }
  return payload;
};

const versionQuery = new URLSearchParams({
  'filter[platform]': 'IOS',
  'filter[versionString]': metadata.version,
  limit: '10',
});
const versions = await request(`/v1/apps/${appId}/appStoreVersions?${versionQuery}`);
if (versions.data.length !== 1) {
  throw new Error(`Expected one iOS ${metadata.version} version, found ${versions.data.length}.`);
}

const version = versions.data[0];
let nextUrl = `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=200`;
const localizations = [];
while (nextUrl) {
  const page = await request(nextUrl);
  localizations.push(...page.data);
  nextUrl = page.links?.next ?? null;
}

const actualLocales = new Set(localizations.map(({ attributes }) => attributes.locale));
const missingLocales = [...expectedLocales].filter((locale) => !actualLocales.has(locale));
if (localizations.length !== expectedLocales.size || missingLocales.length) {
  throw new Error(
    `Expected ${expectedLocales.size} localizations, found ${localizations.length}. Missing: ${missingLocales.join(', ') || 'none'}.`,
  );
}

for (const localization of localizations) {
  await request(`/v1/appStoreVersionLocalizations/${localization.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'appStoreVersionLocalizations',
        id: localization.id,
        attributes: { supportUrl: metadata.supportUrl },
      },
    }),
  });
  console.log(`Updated ${localization.attributes.locale}: ${metadata.supportUrl}`);
}

const verification = await request(
  `/v1/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=200`,
);
const invalid = verification.data.filter(
  ({ attributes }) => attributes.supportUrl !== metadata.supportUrl,
);
if (verification.data.length !== expectedLocales.size || invalid.length) {
  throw new Error(
    `Support URL verification failed for ${invalid.map(({ attributes }) => attributes.locale).join(', ')}.`,
  );
}

console.log(
  `Verified ${verification.data.length} App Store Support URLs for version ${metadata.version}.`,
);
