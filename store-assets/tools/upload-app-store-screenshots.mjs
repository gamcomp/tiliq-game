import { createHash, createSign } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const API_ROOT = 'https://api.appstoreconnect.apple.com/v1';
const TARGET_DISPLAY_TYPE = 'APP_IPHONE_67';
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};
const shouldCommit = args.includes('--commit');
const shouldCancelReview = args.includes('--cancel-review');
const shouldResubmit = args.includes('--resubmit');
const buildNumber = valueAfter('--build-number');
const appId = valueAfter('--app-id') || process.env.APP_ID;
const keyId = process.env.ASC_KEY_ID || process.env.APP_STORE_CONNECT_KEY_IDENTIFIER;
const issuerId = process.env.ASC_ISSUER_ID || process.env.APP_STORE_CONNECT_ISSUER_ID;
const privateKey = (process.env.ASC_PRIVATE_KEY || process.env.APP_STORE_CONNECT_PRIVATE_KEY || '')
  .replace(/^['"]|['"]$/g, '')
  .replace(/\\n/g, '\n');

if (!appId || !keyId || !issuerId || !privateKey) {
  throw new Error('APP_ID and App Store Connect key ID, issuer ID, and private key are required.');
}

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const storeAssetsDir = path.resolve(toolsDir, '..');
const metadata = JSON.parse(await fs.readFile(path.join(storeAssetsDir, 'store-metadata.json'), 'utf8'));
const versionString = valueAfter('--version') || metadata.version;
const localeEntries = Object.values(metadata.locales)
  .map((entry) => ({ locale: entry.appStoreLocale }))
  .sort((a, b) => a.locale.localeCompare(b.locale));

const base64url = (value) => Buffer.from(value).toString('base64url');
let cachedToken = '';
let tokenExpiresAt = 0;

function authorizationToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && now < tokenExpiresAt - 120) return cachedToken;
  const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
  const payload = { iss: issuerId, iat: now - 5, exp: now + 900, aud: 'appstoreconnect-v1' };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signer = createSign('SHA256');
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' });
  cachedToken = `${unsigned}.${signature.toString('base64url')}`;
  tokenExpiresAt = payload.exp;
  return cachedToken;
}

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function apiRequest(method, endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_ROOT}${endpoint}`;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${authorizationToken()}`,
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const responseText = await response.text();
    let payload = null;
    if (responseText) {
      try { payload = JSON.parse(responseText); } catch { payload = responseText; }
    }
    if (response.ok) return payload;
    if ((response.status === 429 || response.status >= 500) && attempt < 5) {
      const retryAfter = Number(response.headers.get('retry-after')) || attempt * 3;
      await delay(retryAfter * 1000);
      continue;
    }
    throw new Error(`${method} ${url} failed (${response.status}): ${typeof payload === 'string' ? payload : JSON.stringify(payload)}`);
  }
  throw new Error(`${method} ${url} failed after retries.`);
}

async function listAll(endpoint) {
  const items = [];
  let next = endpoint;
  while (next) {
    const payload = await apiRequest('GET', next);
    items.push(...(payload?.data || []));
    next = payload?.links?.next || null;
  }
  return items;
}

async function uploadPart(operation, fileBuffer) {
  const headers = Object.fromEntries((operation.requestHeaders || []).map((header) => [header.name, header.value]));
  const body = fileBuffer.subarray(operation.offset, operation.offset + operation.length);
  const response = await fetch(operation.url, { method: operation.method, headers, body });
  if (!response.ok) {
    throw new Error(`Screenshot blob upload failed (${response.status}): ${await response.text()}`);
  }
}

async function reserveAndUploadScreenshot(setId, filePath) {
  const file = await fs.readFile(filePath);
  const fileName = path.basename(filePath);
  const reservation = await apiRequest('POST', '/appScreenshots', {
    body: {
      data: {
        type: 'appScreenshots',
        attributes: { fileSize: file.length, fileName },
        relationships: {
          appScreenshotSet: { data: { type: 'appScreenshotSets', id: setId } },
        },
      },
    },
  });
  const screenshotId = reservation.data.id;
  await Promise.all((reservation.data.attributes.uploadOperations || []).map((operation) => uploadPart(operation, file)));
  await apiRequest('PATCH', `/appScreenshots/${screenshotId}`, {
    body: {
      data: {
        type: 'appScreenshots',
        id: screenshotId,
        attributes: {
          uploaded: true,
          sourceFileChecksum: createHash('md5').update(file).digest('hex'),
        },
      },
    },
  });
  return screenshotId;
}

async function waitForScreenshot(screenshotId) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const screenshot = await apiRequest('GET', `/appScreenshots/${screenshotId}`);
    const delivery = screenshot.data.attributes.assetDeliveryState || {};
    if (delivery.state === 'COMPLETE') return;
    if (delivery.state === 'FAILED') {
      throw new Error(`Screenshot ${screenshotId} processing failed: ${JSON.stringify(delivery.errors || [])}`);
    }
    await delay(3000);
  }
  throw new Error(`Screenshot ${screenshotId} did not finish processing within three minutes.`);
}

const lockedVersionStates = new Set(['READY_FOR_REVIEW', 'WAITING_FOR_REVIEW', 'IN_REVIEW']);

async function cancelActiveReview(version) {
  const submissions = await listAll(`/apps/${encodeURIComponent(appId)}/reviewSubmissions?limit=200`);
  const activeSubmission = submissions.find((entry) =>
    ['WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(entry.attributes.state));
  if (!activeSubmission) {
    throw new Error(`App Store version ${versionString} is locked, but no cancelable review submission was found.`);
  }
  await apiRequest('PATCH', `/reviewSubmissions/${activeSubmission.id}`, {
    body: {
      data: {
        type: 'reviewSubmissions',
        id: activeSubmission.id,
        attributes: { canceled: true },
      },
    },
  });
  console.log(`Cancellation requested for review submission ${activeSubmission.id}.`);

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const [submissionPayload, versionPayload] = await Promise.all([
      apiRequest('GET', `/reviewSubmissions/${activeSubmission.id}`),
      apiRequest('GET', `/appStoreVersions/${version.id}`),
    ]);
    const submissionState = submissionPayload.data.attributes.state;
    const versionState = versionPayload.data.attributes.appStoreState;
    if (submissionState === 'COMPLETE' && !lockedVersionStates.has(versionState)) {
      console.log(`Review cancellation completed; App Store version state is ${versionState}.`);
      return versionPayload.data;
    }
    await delay(5000);
  }
  throw new Error('The review submission did not finish canceling within ten minutes.');
}

async function waitForValidBuild(requestedBuildNumber) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const builds = await listAll(`/builds?filter%5Bapp%5D=${encodeURIComponent(appId)}&filter%5Bversion%5D=${encodeURIComponent(requestedBuildNumber)}&limit=50`);
    const validBuild = builds.find((entry) => entry.attributes.processingState === 'VALID');
    if (validBuild) return validBuild;
    const failedBuild = builds.find((entry) => ['FAILED', 'INVALID'].includes(entry.attributes.processingState));
    if (failedBuild) throw new Error(`App Store build ${requestedBuildNumber} is ${failedBuild.attributes.processingState}.`);
    await delay(10000);
  }
  throw new Error(`App Store build ${requestedBuildNumber} did not become valid within fifteen minutes.`);
}

async function attachBuildAndResubmit(version, requestedBuildNumber) {
  if (!requestedBuildNumber) throw new Error('--build-number is required with --resubmit.');
  const build = await waitForValidBuild(requestedBuildNumber);
  await apiRequest('PATCH', `/appStoreVersions/${version.id}/relationships/build`, {
    body: { data: { type: 'builds', id: build.id } },
  });
  const buildLinkage = await apiRequest('GET', `/appStoreVersions/${version.id}/relationships/build`);
  if (buildLinkage?.data?.id !== build.id) throw new Error(`Build ${requestedBuildNumber} was not attached to the App Store version.`);
  console.log(`Attached App Store build ${requestedBuildNumber} to version ${versionString}.`);

  const existingSubmissions = await listAll(`/apps/${encodeURIComponent(appId)}/reviewSubmissions?limit=200`);
  let submission = existingSubmissions.find((entry) =>
    entry.attributes.state === 'READY_FOR_REVIEW' && entry.attributes.platform === 'IOS');
  if (!submission) {
    const created = await apiRequest('POST', '/reviewSubmissions', {
      body: {
        data: {
          type: 'reviewSubmissions',
          attributes: { platform: 'IOS' },
          relationships: { app: { data: { type: 'apps', id: appId } } },
        },
      },
    });
    submission = created.data;
  }

  const existingItems = await apiRequest('GET', `/reviewSubmissions/${submission.id}/items?include=appStoreVersion&limit=200`);
  const hasVersionItem = (existingItems.included || []).some((entry) =>
    entry.type === 'appStoreVersions' && entry.id === version.id);
  if (!hasVersionItem) {
    await apiRequest('POST', '/reviewSubmissionItems', {
      body: {
        data: {
          type: 'reviewSubmissionItems',
          relationships: {
            reviewSubmission: { data: { type: 'reviewSubmissions', id: submission.id } },
            appStoreVersion: { data: { type: 'appStoreVersions', id: version.id } },
          },
        },
      },
    });
  }

  await apiRequest('PATCH', `/reviewSubmissions/${submission.id}`, {
    body: {
      data: {
        type: 'reviewSubmissions',
        id: submission.id,
        attributes: { submitted: true },
      },
    },
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const submitted = await apiRequest('GET', `/reviewSubmissions/${submission.id}`);
    const state = submitted.data.attributes.state;
    if (['WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(state)) {
      console.log(`Review submission ${submission.id} is ${state} with build ${requestedBuildNumber}.`);
      return;
    }
    if (state === 'UNRESOLVED_ISSUES') throw new Error(`Review submission ${submission.id} has unresolved issues.`);
    await delay(5000);
  }
  throw new Error('The new review submission did not enter the review queue within five minutes.');
}

const versions = await listAll(`/apps/${encodeURIComponent(appId)}/appStoreVersions?filter%5Bplatform%5D=IOS&limit=200`);
let version = versions.find((entry) => entry.attributes.versionString === versionString);
if (!version) throw new Error(`iOS App Store version ${versionString} was not found for app ${appId}.`);

if (shouldCommit && lockedVersionStates.has(version.attributes.appStoreState)) {
  if (!shouldCancelReview) {
    throw new Error(`App Store version ${versionString} is ${version.attributes.appStoreState}; pass --cancel-review to update screenshots.`);
  }
  version = await cancelActiveReview(version);
}

const remoteLocalizations = await listAll(`/appStoreVersions/${version.id}/appStoreVersionLocalizations?limit=200`);
const localizationByLocale = new Map(remoteLocalizations.map((entry) => [entry.attributes.locale, entry]));
const missingLocales = localeEntries.filter(({ locale }) => !localizationByLocale.has(locale)).map(({ locale }) => locale);
if (missingLocales.length) throw new Error(`Missing App Store version localizations: ${missingLocales.join(', ')}`);

console.log(`App Store version ${versionString} (${version.attributes.appStoreState}) has all ${localeEntries.length} localizations.`);

for (const [index, { locale }] of localeEntries.entries()) {
  const localization = localizationByLocale.get(locale);
  const screenshotFiles = (await fs.readdir(path.join(storeAssetsDir, 'screenshots', 'app-store', locale, 'iphone-6.9')))
    .filter((name) => /\.jpe?g$/i.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => path.join(storeAssetsDir, 'screenshots', 'app-store', locale, 'iphone-6.9', name));
  if (screenshotFiles.length !== 6) throw new Error(`${locale}: expected 6 screenshots, found ${screenshotFiles.length}.`);

  const sets = await listAll(`/appStoreVersionLocalizations/${localization.id}/appScreenshotSets?limit=50`);
  const targetSets = sets.filter((entry) => entry.attributes.screenshotDisplayType === TARGET_DISPLAY_TYPE);
  if (!shouldCommit) {
    const screenshotCount = targetSets.length
      ? (await listAll(`/appScreenshotSets/${targetSets[0].id}/appScreenshots?limit=50`)).length
      : 0;
    console.log(`[${index + 1}/${localeEntries.length}] ${locale}: ${targetSets.length} target set(s), ${screenshotCount} screenshot(s).`);
    continue;
  }

  for (const duplicate of targetSets.slice(1)) await apiRequest('DELETE', `/appScreenshotSets/${duplicate.id}`);
  let set = targetSets[0];
  if (!set) {
    const created = await apiRequest('POST', '/appScreenshotSets', {
      body: {
        data: {
          type: 'appScreenshotSets',
          attributes: { screenshotDisplayType: TARGET_DISPLAY_TYPE },
          relationships: {
            appStoreVersionLocalization: {
              data: { type: 'appStoreVersionLocalizations', id: localization.id },
            },
          },
        },
      },
    });
    set = created.data;
  }

  const oldScreenshots = await listAll(`/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
  const newScreenshotIds = [];
  for (let screenshotIndex = 0; screenshotIndex < screenshotFiles.length; screenshotIndex += 1) {
    if (oldScreenshots[screenshotIndex]) {
      await apiRequest('DELETE', `/appScreenshots/${oldScreenshots[screenshotIndex].id}`);
    }
    newScreenshotIds.push(await reserveAndUploadScreenshot(set.id, screenshotFiles[screenshotIndex]));
  }
  for (const extra of oldScreenshots.slice(screenshotFiles.length)) {
    await apiRequest('DELETE', `/appScreenshots/${extra.id}`);
  }
  await Promise.all(newScreenshotIds.map(waitForScreenshot));
  await apiRequest('PATCH', `/appScreenshotSets/${set.id}/relationships/appScreenshots`, {
    body: { data: newScreenshotIds.map((id) => ({ type: 'appScreenshots', id })) },
  });

  const verified = await listAll(`/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
  if (verified.length !== 6) throw new Error(`${locale}: App Store retained ${verified.length} screenshots instead of 6.`);

  const legacyIphoneSets = sets.filter((entry) =>
    entry.id !== set.id
    && entry.attributes.screenshotDisplayType.startsWith('APP_IPHONE_')
    && entry.attributes.screenshotDisplayType !== TARGET_DISPLAY_TYPE);
  for (const legacySet of legacyIphoneSets) await apiRequest('DELETE', `/appScreenshotSets/${legacySet.id}`);
  console.log(`[${index + 1}/${localeEntries.length}] ${locale}: 6 screenshots uploaded and verified.`);
}

console.log(shouldCommit
  ? `Committed ${localeEntries.length * 6} App Store screenshots across ${localeEntries.length} locales.`
  : 'Check-only mode completed; no App Store changes were made.');

if (shouldCommit && shouldResubmit) await attachBuildAndResubmit(version, buildNumber);
