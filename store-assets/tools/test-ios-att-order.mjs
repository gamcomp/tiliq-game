import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(toolsDir, '..', '..');
const webFiles = ['index.html', 'game.html', path.join('www', 'index.html')];
const webSources = await Promise.all(webFiles.map((file) => fs.readFile(path.join(root, file), 'utf8')));

if (!webSources.every((source) => source === webSources[0])) {
  throw new Error('Root, game, and www HTML copies are not identical.');
}

const source = webSources[0];
const initStart = source.indexOf('async function initAdMob()');
const initEnd = source.indexOf('function _updateAdPrivacyUI', initStart);
if (initStart < 0 || initEnd < 0) throw new Error('initAdMob block was not found.');
const initBlock = source.slice(initStart, initEnd);
const attIndex = initBlock.indexOf('await _resolveIosTrackingAuthorization(AdMob)');
const analyticsIndex = initBlock.indexOf('await initFirebaseAnalytics()');
const adsIndex = initBlock.indexOf('await AdMob.initialize(');
const consentIndex = initBlock.indexOf('await AdMob.requestConsentInfo()');
if ([attIndex, analyticsIndex, adsIndex, consentIndex].some((index) => index < 0)) {
  throw new Error('ATT, Analytics, AdMob, or UMP initialization call is missing.');
}
if (!(attIndex < analyticsIndex && analyticsIndex < adsIndex && adsIndex < consentIndex)) {
  throw new Error('Tracking initialization order must be ATT -> Analytics -> AdMob -> UMP.');
}

const authStart = source.indexOf('async function initFirebaseAuth()');
const authEnd = source.indexOf('function _updateLoginGate', authStart);
const authBlock = source.slice(authStart, authEnd > authStart ? authEnd : source.length);
if (!authBlock.includes('if(!_isIOS)await initFirebaseAnalytics();')) {
  throw new Error('iOS Firebase Analytics is not gated behind ATT.');
}

const appDelegate = await fs.readFile(path.join(root, 'ios', 'App', 'App', 'AppDelegate.swift'), 'utf8');
for (const marker of [
  'import AppTrackingTransparency',
  'func applicationDidBecomeActive',
  'ATTrackingManager.trackingAuthorizationStatus == .notDetermined',
  'ATTrackingManager.requestTrackingAuthorization',
  'application.applicationState == .active',
]) {
  if (!appDelegate.includes(marker)) throw new Error(`Native ATT marker is missing: ${marker}`);
}

const infoPlist = await fs.readFile(path.join(root, 'ios', 'App', 'App', 'Info.plist'), 'utf8');
if (!infoPlist.includes('<key>NSUserTrackingUsageDescription</key>')) {
  throw new Error('NSUserTrackingUsageDescription is missing.');
}

console.log('iOS ATT order passed: native active-state request; ATT -> Analytics -> AdMob -> UMP.');
