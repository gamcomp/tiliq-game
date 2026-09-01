import { createSign } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_NAME = 'com.tiliq.game';
const SCOPE = 'https://www.googleapis.com/auth/androidpublisher';
const API_ROOT = 'https://androidpublisher.googleapis.com/androidpublisher/v3';
const UPLOAD_ROOT = 'https://androidpublisher.googleapis.com/upload/androidpublisher/v3';

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const credentialsPath = valueAfter('--credentials') || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const bundlePath = valueAfter('--bundle');
const existingVersionCode = valueAfter('--version-code');
const track = valueAfter('--track') || 'production';
const shouldCommit = args.includes('--commit');
const shouldCheckPermission = args.includes('--check-permission');
const TEST_TRACK_ONLY_VERSION_CODES = new Set([152]);

if (!credentialsPath) throw new Error('Pass --credentials <service-account.json>.');
if (!shouldCheckPermission && ((!bundlePath && !existingVersionCode) || !shouldCommit)) {
  throw new Error('A release requires --bundle <app.aab> or --version-code <code>, plus --commit.');
}

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const storeAssetsDir = path.resolve(toolsDir, '..');
const metadata = JSON.parse(await fs.readFile(path.join(storeAssetsDir, 'store-metadata.json'), 'utf8'));
const credentials = JSON.parse(await fs.readFile(path.resolve(credentialsPath), 'utf8'));

if (credentials.type !== 'service_account' || !credentials.client_email || !credentials.private_key) {
  throw new Error('The credential file is not a valid service-account JSON file.');
}

const base64url = (value) => Buffer.from(value).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const tokenUri = credentials.token_uri || 'https://oauth2.googleapis.com/token';
const header = { alg: 'RS256', typ: 'JWT', kid: credentials.private_key_id };
const claims = { iss: credentials.client_email, scope: SCOPE, aud: tokenUri, iat: now, exp: now + 3600 };
const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
const signer = createSign('RSA-SHA256');
signer.update(unsigned);
signer.end();
const assertion = `${unsigned}.${signer.sign(credentials.private_key).toString('base64url')}`;
const tokenResponse = await fetch(tokenUri, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  }),
});
const tokenPayload = await tokenResponse.json();
if (!tokenResponse.ok || !tokenPayload.access_token) {
  throw new Error(`OAuth token request failed (${tokenResponse.status}): ${JSON.stringify(tokenPayload)}`);
}

async function request(method, url, options = {}) {
  const isBinary = Buffer.isBuffer(options.body);
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${tokenPayload.access_token}`,
      ...(options.body === undefined ? {} : { 'content-type': options.contentType || 'application/json' }),
    },
    body: options.body === undefined ? undefined : isBinary ? options.body : JSON.stringify(options.body),
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try { payload = JSON.parse(text); } catch { payload = text; }
  }
  if (!response.ok) {
    throw new Error(`${method} ${url} failed (${response.status}): ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }
  return payload;
}

const appPath = `applications/${encodeURIComponent(PACKAGE_NAME)}`;
const edit = await request('POST', `${API_ROOT}/${appPath}/edits`, { body: {} });
const editId = edit.id;
let editOpen = true;

async function deleteEdit() {
  if (!editOpen) return;
  try { await request('DELETE', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}`); } catch {}
  editOpen = false;
}

try {
  const tracks = await request('GET', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/tracks`);
  const currentTrack = (tracks?.tracks || []).find((entry) => entry.track === track) || { track, releases: [] };

  if (shouldCheckPermission) {
    let permissionCheckReleases = currentTrack.releases || [];
    if (!permissionCheckReleases.length) {
      const existingRelease = (tracks?.tracks || []).flatMap((entry) => entry.releases || [])
        .find((release) => release.versionCodes?.length);
      if (!existingRelease) throw new Error('No existing release is available for a non-committing permission check.');
      permissionCheckReleases = [{
        name: `Permission check ${existingRelease.name || ''}`.trim(),
        versionCodes: existingRelease.versionCodes,
        status: 'draft',
      }];
    }
    await request('PUT', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/tracks/${encodeURIComponent(track)}`, {
      body: { track, releases: permissionCheckReleases },
    });
    console.log(`Release permission verified for ${PACKAGE_NAME} track ${track}; no changes committed.`);
    await deleteEdit();
    process.exit(0);
  }

  let versionCode;
  if (bundlePath) {
    const bundle = await fs.readFile(path.resolve(bundlePath));
    const uploaded = await request(
      'POST',
      `${UPLOAD_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/bundles?uploadType=media`,
      { body: bundle, contentType: 'application/octet-stream' },
    );
    versionCode = Number(uploaded.versionCode);
    console.log(`Uploaded AAB ${metadata.version} (${versionCode}).`);
  } else {
    versionCode = Number(existingVersionCode);
    if (!Number.isInteger(versionCode) || versionCode <= 0) throw new Error(`Invalid --version-code: ${existingVersionCode}`);
    console.log(`Promoting existing AAB ${metadata.version} (${versionCode}).`);
  }
  if (versionCode !== Number(metadata.versionCode)) {
    throw new Error(`Uploaded bundle versionCode ${versionCode} does not match metadata ${metadata.versionCode}.`);
  }
  if (track === 'production' && TEST_TRACK_ONLY_VERSION_CODES.has(versionCode)) {
    throw new Error(`versionCode ${versionCode} uses test ads and cannot be released to production.`);
  }

  const releaseNotes = Object.entries(metadata.locales).map(([language, locale]) => ({
    language,
    text: locale.releaseNotes,
  }));
  await request('PUT', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}/tracks/${encodeURIComponent(track)}`, {
    body: {
      track,
      releases: [{
        name: metadata.version,
        versionCodes: [String(versionCode)],
        status: 'completed',
        releaseNotes,
      }],
    },
  });
  console.log(`Assigned versionCode ${versionCode} to ${track} with ${releaseNotes.length} localized release notes.`);

  await request('POST', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}:validate`, { body: {} });
  console.log('Google Play release validation passed.');
  await request('POST', `${API_ROOT}/${appPath}/edits/${encodeURIComponent(editId)}:commit`, { body: {} });
  editOpen = false;
  console.log(`Committed ${track} release edit ${editId}.`);
} catch (error) {
  await deleteEdit();
  throw error;
}
