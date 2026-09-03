import { createHash, createSign } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const API_ROOT = 'https://api.appstoreconnect.apple.com/v1';
const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : undefined;
};

const shouldCommit = args.includes('--commit');
const appId = valueAfter('--app-id') || process.env.APP_ID;
const versionString = valueAfter('--version') || '1.3.88';
const buildNumber = valueAfter('--build-number');
const videoPath = valueAfter('--video');
const keyId = process.env.ASC_KEY_ID || process.env.APP_STORE_CONNECT_KEY_IDENTIFIER;
const issuerId = process.env.ASC_ISSUER_ID || process.env.APP_STORE_CONNECT_ISSUER_ID;
const privateKey = (process.env.ASC_PRIVATE_KEY || process.env.APP_STORE_CONNECT_PRIVATE_KEY || '')
  .replace(/^['"]|['"]$/g, '')
  .replace(/\\n/g, '\n');

if (!appId || !keyId || !issuerId || !privateKey) {
  throw new Error('APP_ID and App Store Connect API credentials are required.');
}
if (!buildNumber || !videoPath) throw new Error('--build-number and --video are required.');

const video = await fs.readFile(videoPath);
const uploadName = `Tiliq-ATT-Build-${buildNumber}-Physical-iPhone.mp4`;
const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
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
      await delay(attempt * 3000);
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

async function uploadPart(operation) {
  const headers = Object.fromEntries((operation.requestHeaders || []).map((header) => [header.name, header.value]));
  const body = video.subarray(operation.offset, operation.offset + operation.length);
  const response = await fetch(operation.url, { method: operation.method, headers, body });
  if (!response.ok) throw new Error(`Video part upload failed (${response.status}): ${await response.text()}`);
}

const lockedVersionStates = new Set(['READY_FOR_REVIEW', 'WAITING_FOR_REVIEW', 'IN_REVIEW']);

async function cancelActiveReview(version) {
  const submissions = await listAll(`/apps/${encodeURIComponent(appId)}/reviewSubmissions?limit=200`);
  const active = submissions.find((entry) => ['WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(entry.attributes.state));
  if (!active) throw new Error(`Version ${versionString} is locked, but no cancelable review submission exists.`);
  await apiRequest('PATCH', `/reviewSubmissions/${active.id}`, {
    body: { data: { type: 'reviewSubmissions', id: active.id, attributes: { canceled: true } } },
  });
  console.log(`Cancellation requested for review submission ${active.id}.`);
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const [submissionPayload, versionPayload] = await Promise.all([
      apiRequest('GET', `/reviewSubmissions/${active.id}`),
      apiRequest('GET', `/appStoreVersions/${version.id}`),
    ]);
    if (submissionPayload.data.attributes.state === 'COMPLETE'
      && !lockedVersionStates.has(versionPayload.data.attributes.appStoreState)) {
      console.log(`Cancellation completed; version state is ${versionPayload.data.attributes.appStoreState}.`);
      return versionPayload.data;
    }
    await delay(5000);
  }
  throw new Error('Review cancellation did not complete within ten minutes.');
}

async function waitForBuild() {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const builds = await listAll(`/builds?filter%5Bapp%5D=${encodeURIComponent(appId)}&filter%5Bversion%5D=${encodeURIComponent(buildNumber)}&limit=50`);
    const valid = builds.find((entry) => entry.attributes.processingState === 'VALID');
    if (valid) return valid;
    const failed = builds.find((entry) => ['FAILED', 'INVALID'].includes(entry.attributes.processingState));
    if (failed) throw new Error(`Build ${buildNumber} is ${failed.attributes.processingState}.`);
    await delay(10000);
  }
  throw new Error(`Build ${buildNumber} did not become valid within fifteen minutes.`);
}

async function uploadReviewVideo(reviewDetailId) {
  const existing = await listAll(`/appStoreReviewDetails/${reviewDetailId}/appStoreReviewAttachments?limit=50`);
  for (const attachment of existing.filter((entry) => entry.attributes.fileName === uploadName)) {
    await apiRequest('DELETE', `/appStoreReviewAttachments/${attachment.id}`);
  }
  const reservation = await apiRequest('POST', '/appStoreReviewAttachments', {
    body: {
      data: {
        type: 'appStoreReviewAttachments',
        attributes: { fileSize: video.length, fileName: uploadName },
        relationships: {
          appStoreReviewDetail: { data: { type: 'appStoreReviewDetails', id: reviewDetailId } },
        },
      },
    },
  });
  const attachmentId = reservation.data.id;
  await Promise.all((reservation.data.attributes.uploadOperations || []).map(uploadPart));
  await apiRequest('PATCH', `/appStoreReviewAttachments/${attachmentId}`, {
    body: {
      data: {
        type: 'appStoreReviewAttachments',
        id: attachmentId,
        attributes: {
          uploaded: true,
          sourceFileChecksum: createHash('md5').update(video).digest('hex'),
        },
      },
    },
  });
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const attachment = await apiRequest('GET', `/appStoreReviewAttachments/${attachmentId}`);
    const delivery = attachment.data.attributes.assetDeliveryState || {};
    if (delivery.state === 'COMPLETE') {
      console.log(`Uploaded and verified review video ${uploadName} (${attachmentId}).`);
      return attachmentId;
    }
    if (delivery.state === 'FAILED') throw new Error(`Review video processing failed: ${JSON.stringify(delivery.errors || [])}`);
    await delay(3000);
  }
  throw new Error('Review video did not finish processing within six minutes.');
}

async function submit(version) {
  const submissions = await listAll(`/apps/${encodeURIComponent(appId)}/reviewSubmissions?limit=200`);
  let submission = submissions.find((entry) => entry.attributes.state === 'READY_FOR_REVIEW' && entry.attributes.platform === 'IOS');
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
  const items = await apiRequest('GET', `/reviewSubmissions/${submission.id}/items?include=appStoreVersion&limit=200`);
  const hasVersion = (items.included || []).some((entry) => entry.type === 'appStoreVersions' && entry.id === version.id);
  if (!hasVersion) {
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
    body: { data: { type: 'reviewSubmissions', id: submission.id, attributes: { submitted: true } } },
  });
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const payload = await apiRequest('GET', `/reviewSubmissions/${submission.id}`);
    const state = payload.data.attributes.state;
    if (['WAITING_FOR_REVIEW', 'IN_REVIEW'].includes(state)) {
      console.log(`Review submission ${submission.id} is ${state}.`);
      return submission.id;
    }
    if (state === 'UNRESOLVED_ISSUES') throw new Error(`Review submission ${submission.id} has unresolved issues.`);
    await delay(5000);
  }
  throw new Error('Review submission did not enter the queue within five minutes.');
}

const versions = await listAll(`/apps/${encodeURIComponent(appId)}/appStoreVersions?filter%5Bplatform%5D=IOS&limit=200`);
let version = versions.find((entry) => entry.attributes.versionString === versionString);
if (!version) throw new Error(`Version ${versionString} was not found.`);
const build = await waitForBuild();
const reviewDetail = await apiRequest('GET', `/appStoreVersions/${version.id}/appStoreReviewDetail`);
console.log(`Ready: version ${versionString} (${version.attributes.appStoreState}), build ${buildNumber} (${build.attributes.processingState}), video ${video.length} bytes.`);

if (!shouldCommit) {
  console.log('Dry run completed; pass --commit to cancel, update, upload, and resubmit.');
  process.exit(0);
}

if (lockedVersionStates.has(version.attributes.appStoreState)) version = await cancelActiveReview(version);

await apiRequest('PATCH', `/appStoreVersions/${version.id}/relationships/build`, {
  body: { data: { type: 'builds', id: build.id } },
});
const linkedBuild = await apiRequest('GET', `/appStoreVersions/${version.id}/relationships/build`);
if (linkedBuild?.data?.id !== build.id) throw new Error(`Build ${buildNumber} was not attached.`);
console.log(`Attached build ${buildNumber} to App Store version ${versionString}.`);

const notes = [
  `Guideline 2.1 — App Tracking Transparency verification for Tiliq ${versionString} (build ${buildNumber}).`,
  '',
  'Build 88 contained an early return in the advertising-consent flow that could prevent the ATT request from being reached. This is corrected in build 89.',
  'On a fresh installation, Tiliq now requests App Tracking Transparency after the application becomes active and before Firebase Analytics, Google Mobile Ads, UMP, or any advertising request is initialized. Declining tracking does not block gameplay.',
  '',
  `Attached physical-device screen recording: ${uploadName}`,
  'The unedited recording shows installation from TestFlight, launching build 89, the native ATT permission request, selecting “Ask App Not to Track,” and the user flow that follows through language selection, sign-in, the main menu, and rankings.',
  '',
  'No demo credentials or sample files are required. Reviewers may also choose “Continue as guest.”',
].join('\n');

await apiRequest('PATCH', `/appStoreReviewDetails/${reviewDetail.data.id}`, {
  body: {
    data: {
      type: 'appStoreReviewDetails',
      id: reviewDetail.data.id,
      attributes: { notes },
    },
  },
});
console.log('Updated App Review Information notes.');
const attachmentId = await uploadReviewVideo(reviewDetail.data.id);
const submissionId = await submit(version);
console.log(JSON.stringify({ version: versionString, build: buildNumber, attachmentId, submissionId, status: 'WAITING_FOR_REVIEW' }));
