import { createSign } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'com.tiliq.game';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API_ROOT = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD_ROOT = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';

const args = process.argv.slice(2);
const credentialsIndex = args.indexOf('--credentials');
const credentialsPath = credentialsIndex >= 0 ? args[credentialsIndex + 1] : process.env.GOOGLE_APPLICATION_CREDENTIALS;
const shouldCommit = args.includes('--commit');
const shouldVerify = args.includes('--verify');
const shouldShowStatus = args.includes('--status');
const shouldUploadBrandAssets = args.includes('--brand-assets');

if (!credentialsPath) {
  throw new Error('Pass --credentials <service-account.json> or set GOOGLE_APPLICATION_CREDENTIALS.');
}

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const storeAssetsDir = path.resolve(toolsDir, '..');
const metadataRoot = path.join(storeAssetsDir, 'metadata', 'google-play');
const screenshotsRoot = path.join(storeAssetsDir, 'screenshots', 'google-play');
const credentials = JSON.parse(await fs.readFile(path.resolve(credentialsPath), 'utf8'));

if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) {
  throw new Error('The credential file is not a valid Google service-account JSON file.');
}

const base64url = (value) => Buffer.from(value).toString('base64url');

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
  const header = { alg: 'RS256', typ: 'JWT', kid: credentials.private_key_id };
  const claims = {
    iss: credentials.client_email,
    scope: SCOPE,
    aud: tokenUri,
    iat: now,
    exp: now + 3600,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const assertion = `${unsigned}.${signer.sign(credentials.private_key).toString('base64url')}`;
  const response = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) {
    throw new Error(`OAuth token request failed (${response.status}): ${JSON.stringify(payload)}`);
  }
  return payload.access_token;
}

const accessToken = await getAccessToken();

async function request(method, url, options = {}) {
  const isBinary = Buffer.isBuffer(options.body);
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(options.body === undefined ? {} : { 'content-type': options.contentType || 'application/json' }),
    },
    body: options.body === undefined ? undefined : isBinary ? options.body : JSON.stringify(options.body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    throw new Error(`${method} ${url} failed (${response.status}): ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }
  return payload;
}

async function loadLocales() {
  const entries = await fs.readdir(metadataRoot, { withFileTypes: true });
  const locales = [];
  for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
    const language = entry.name;
    const metadataDir = path.join(metadataRoot, language);
    const screenshotsDir = path.join(screenshotsRoot, language, 'phone');
    const [title, shortDescription, fullDescription, screenshotNames] = await Promise.all([
      fs.readFile(path.join(metadataDir, 'title.txt'), 'utf8'),
      fs.readFile(path.join(metadataDir, 'short_description.txt'), 'utf8'),
      fs.readFile(path.join(metadataDir, 'full_description.txt'), 'utf8'),
      fs.readdir(screenshotsDir),
    ]);
    const screenshots = screenshotNames
      .filter((name) => /\.jpe?g$/i.test(name))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name) => path.join(screenshotsDir, name));
    if (screenshots.length !== 6) {
      throw new Error(`${language}: expected 6 phone screenshots, found ${screenshots.length}.`);
    }
    locales.push({
      language,
      listing: {
        language,
        title: title.trim(),
        shortDescription: shortDescription.trim(),
        fullDescription: fullDescription.trim(),
      },
      screenshots,
    });
  }
  if (locales.length !== 14) {
    throw new Error(`Expected 14 locales, found ${locales.length}.`);
  }
  return locales;
}

const locales = await loadLocales();
const appPath = `applications/${encodeURIComponent(PACKAGE_NAME)}`;
const edit = await request('POST', `${API_ROOT}/${appPath}/edits`, { body: {} });
const editId = edit.id;
let editOpen = true;

async function deleteEdit() {
  if (!editOpen) return;
  try {
    await request('DELETE', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}`);
  } catch {
    // The edit may already be committed or expired.
  }
  editOpen = false;
}

try {
  const currentListings = await request('GET', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/listings`);
  console.log(`Access verified for ${PACKAGE_NAME}; current listings: ${currentListings?.listings?.length || 0}.`);

  if (!shouldCommit) {
    if (shouldShowStatus) {
      const [tracks, bundles] = await Promise.all([
        request('GET', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/tracks`),
        request('GET', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/bundles`),
      ]);
      const testerSummary = {};
      for (const testerTrack of ['alpha', 'internal']) {
        try {
          const testers = await request('GET', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/testers/${testerTrack}`);
          testerSummary[testerTrack] = testers;
        } catch {
          testerSummary[testerTrack] = null;
        }
      }
      const trackSummary = (tracks?.tracks || []).map((track) => ({
        track: track.track,
        releases: (track.releases || []).map((release) => ({
          name: release.name || '',
          status: release.status,
          versionCodes: release.versionCodes || [],
          userFraction: release.userFraction ?? null,
        })),
      }));
      const bundleVersionCodes = (bundles?.bundles || []).map((bundle) => bundle.versionCode);
      console.log(JSON.stringify({ trackSummary, bundleVersionCodes, testerSummary }, null, 2));
    } else if (shouldVerify) {
      const remoteListings = new Map((currentListings?.listings || []).map((listing) => [listing.language, listing]));
      let verifiedImages = 0;
      for (const locale of locales) {
        const remote = remoteListings.get(locale.language);
        if (!remote) {
          throw new Error(`${locale.language}: listing is missing after commit.`);
        }
        for (const field of ['title', 'shortDescription', 'fullDescription']) {
          if (remote[field] !== locale.listing[field]) {
            throw new Error(`${locale.language}: ${field} does not match after commit.`);
          }
        }
        const localeBase = `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/listings/${encodeURIComponent(locale.language)}`;
        if (shouldUploadBrandAssets) {
          for (const imageType of ['icon', 'featureGraphic']) {
            const imageList = await request('GET', `${localeBase}/${imageType}`);
            const imageCount = imageList?.images?.length || 0;
            if (imageCount !== 1) {
              throw new Error(`${locale.language}: expected 1 committed ${imageType}, found ${imageCount}.`);
            }
            verifiedImages += imageCount;
          }
        } else {
          const imageList = await request('GET', `${localeBase}/phoneScreenshots`);
          const imageCount = imageList?.images?.length || 0;
          if (imageCount !== 6) {
            throw new Error(`${locale.language}: expected 6 committed phone screenshots, found ${imageCount}.`);
          }
          verifiedImages += imageCount;
        }
      }
      console.log(`Post-commit verification passed for ${locales.length} listings and ${verifiedImages} ${shouldUploadBrandAssets ? 'brand images' : 'phone screenshots'}.`);
    } else {
      console.log('Check-only mode completed; no store changes were committed.');
    }
    await deleteEdit();
    process.exit(0);
  }

  let uploadedImages = 0;
  if (shouldUploadBrandAssets) {
    const brandAssets = [
      { imageType: 'icon', file: path.join(storeAssetsDir, 'graphics', 'google-play', 'icon.png') },
      { imageType: 'featureGraphic', file: path.join(storeAssetsDir, 'graphics', 'google-play', 'feature-graphic.png') },
    ];
    for (const [localeIndex, locale] of locales.entries()) {
      const localeBase = `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/listings/${encodeURIComponent(locale.language)}`;
      for (const asset of brandAssets) {
        await request('DELETE', `${localeBase}/${asset.imageType}`);
        const image = await fs.readFile(asset.file);
        const uploadUrl = `${UPLOAD_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/listings/${encodeURIComponent(locale.language)}/${asset.imageType}?uploadType=media`;
        await request('POST', uploadUrl, { body: image, contentType: 'image/png' });
        const imageList = await request('GET', `${localeBase}/${asset.imageType}`);
        if ((imageList?.images?.length || 0) !== 1) {
          throw new Error(`${locale.language}: Google Play did not retain ${asset.imageType}.`);
        }
        uploadedImages += 1;
      }
      console.log(`[${localeIndex + 1}/${locales.length}] ${locale.language}: icon + feature graphic uploaded.`);
    }
  } else {
    for (const [localeIndex, locale] of locales.entries()) {
      const localeBase = `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/listings/${encodeURIComponent(locale.language)}`;
      await request('PUT', localeBase, { body: locale.listing });
      await request('DELETE', `${localeBase}/phoneScreenshots`);

      for (const screenshotPath of locale.screenshots) {
        const image = await fs.readFile(screenshotPath);
        const uploadUrl = `${UPLOAD_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/listings/${encodeURIComponent(locale.language)}/phoneScreenshots?uploadType=media`;
        await request('POST', uploadUrl, { body: image, contentType: 'image/jpeg' });
        uploadedImages += 1;
      }

      const imageList = await request('GET', `${localeBase}/phoneScreenshots`);
      const imageCount = imageList?.images?.length || 0;
      if (imageCount !== 6) {
        throw new Error(`${locale.language}: Google Play reports ${imageCount} phone screenshots after upload.`);
      }
      console.log(`[${localeIndex + 1}/${locales.length}] ${locale.language}: listing + 6 phone screenshots uploaded.`);
    }
  }

  await request('POST', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}:validate`, { body: {} });
  console.log(`Google Play validation passed for ${locales.length} locales and ${uploadedImages} ${shouldUploadBrandAssets ? 'brand images' : 'screenshots'}.`);
  await request('POST', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}:commit`, { body: {} });
  editOpen = false;
  console.log(`Committed edit ${editId}.`);
} catch (error) {
  await deleteEdit();
  throw error;
}
