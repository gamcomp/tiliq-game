import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const deployDir = path.resolve(toolsDir, '..', '..');
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const requestedPath = path.resolve(deployDir, relative);
    if (requestedPath !== deployDir && !requestedPath.startsWith(`${deployDir}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const data = await fs.readFile(requestedPath);
    response.writeHead(200, {'Content-Type': mimeTypes[path.extname(requestedPath).toLowerCase()] || 'application/octet-stream'});
    response.end(data);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end();
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
let executablePath;
for (const candidate of chromeCandidates) {
  try { await fs.access(candidate); executablePath = candidate; break; } catch {}
}
if (!executablePath) throw new Error('Chrome or Edge was not found.');

const browser = await chromium.launch({executablePath, headless: true});
const page = await browser.newPage();

try {
  await page.goto(baseUrl, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => typeof showRewardedAd === 'function');

  const result = await page.evaluate(async () => {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    let accountDisabledReward = 0;
    await showRewardedAd(() => { accountDisabledReward += 1; }, adContext('color'));
    const accountDisabledOverlay = document.getElementById('ad-overlay')?'present':'none';

    // The remaining cases exercise the provider path independently from the
    // temporary production kill switch used while the account is disabled.
    adServiceAvailable = () => true;
    const listeners = new Map();
    let prepareMode = 'delayed-success';
    let lastPrepareOptions = null;
    const AdMob = {
      addListener: async (name, callback) => {
        listeners.set(name, callback);
        return {remove: () => listeners.delete(name)};
      },
      prepareRewardVideoAd: async (options) => {
        lastPrepareOptions = options;
        await wait(120);
        if (prepareMode === 'failure') throw new Error('no fill');
        return {adUnitId: 'test'};
      },
      showRewardVideoAd: async () => {
        listeners.get('onRewardedVideoAdReward')?.({type: 'coin', amount: 1});
        listeners.get('onRewardedVideoAdDismissed')?.();
        return {type: 'coin', amount: 1};
      },
    };
    window.Capacitor = {Plugins: {AdMob}};
    _adMobReady = true;
    _adsCanRequest = true;
    _useAdMobTestAds = true;

    // Regression: a tap during an existing preload must await that same request.
    _rewardReady = false;
    const preload = _prepareRewardedAd();
    let normalReward = 0;
    await wait(10);
    showRewardedAd(() => { normalReward += 1; }, adContext('rescue', {allowNoFill: true}));
    await preload;
    await wait(900);
    const testInventoryRequested = lastPrepareOptions?.isTesting === true;

    // No-fill: only the game-rescue context may continue without an ad.
    prepareMode = 'failure';
    _useAdMobTestAds = false;
    _rewardReady = false;
    let fallbackReward = 0;
    await showRewardedAd(() => { fallbackReward += 1; }, adContext('rescue', {allowNoFill: true}));
    const fallbackDirect = !document.getElementById('ad-overlay') && fallbackReward === 1;
    await wait(50);

    // Optional coin rewards must stay locked when inventory is unavailable.
    _rewardReady = false;
    let optionalReward = 0;
    await showRewardedAd(() => { optionalReward += 1; }, adContext('score'));
    const optionalDirect = !document.getElementById('ad-overlay') && !_rewardFlowActive;

    // TestFlight must remain reviewable even if Google's demo inventory has a
    // transient failure. Production optional rewards remain locked above.
    _useAdMobTestAds = true;
    _rewardReady = false;
    let testFlightFallbackReward = 0;
    await showRewardedAd(() => { testFlightFallbackReward += 1; }, adContext('color'));

    await wait(50);

    // Last-chance state: no normal piece fits, but a bomb can still save the run.
    grid = Array.from({length: GRID}, () => Array(GRID).fill(1));
    pieces = [{shape: {cells: [[0, 0]]}, placed: false}];
    bombCount = 1;
    bombMode = false;
    dead = false;
    _bombHintT = performance.now();
    updateBombBar();
    checkDead();
    const bombButton = document.getElementById('bomb-btn');
    const lastChanceShown = bombButton.classList.contains('last-chance');
    const lastChanceAnimation = getComputedStyle(bombButton, '::after').animationName;

    grid = Array.from({length: GRID}, () => Array(GRID).fill(0));
    checkDead();
    const lastChanceCleared = !bombButton.classList.contains('last-chance');

    grid = Array.from({length: GRID}, () => Array(GRID).fill(1));
    bombCount = 0;
    updateBombBar();
    checkDead();
    const noBombWarningHidden = !bombButton.classList.contains('last-chance');
    dead = true;

    // Exercise the Unity Capacitor adapter with platform-specific IDs and
    // native reward events: closing early must not grant an optional reward.
    const unityListeners = new Map();
    const unityLoads = [];
    const unityBridge = {
      addListener: async (name, callback) => {
        unityListeners.set(name, callback);
        return {remove: () => unityListeners.delete(name)};
      },
      initialize: async ({gameId}) => { unityLoads.push(`game:${gameId}`); },
      prepareRewardVideoAd: async ({adId}) => { unityLoads.push(`rewarded:${adId}`); },
      prepareInterstitial: async ({adId}) => { unityLoads.push(`interstitial:${adId}`); },
      showBanner: async ({adId}) => { unityLoads.push(`banner:${adId}`); },
      showRewardVideoAd: async () => {
        if (unityBridge.earned) unityListeners.get('onRewardedVideoAdReward')?.();
        unityListeners.get('onRewardedVideoAdDismissed')?.({completed: unityBridge.completed});
      },
    };
    window.Capacitor.getPlatform = () => 'android';
    window.Capacitor.Plugins.TiliqUnityAds = unityBridge;
    Object.assign(window.TILIQ_UNITY_ADS.android, {
      gameId: 'android-game', interstitial: 'android-inter',
      rewarded: 'android-reward', banner: 'android-banner',
    });
    const unityActive = window.TiliqUnityAdsProvider.active;
    await window.TiliqUnityAdsProvider.initialize();
    _useAdMobTestAds = false;
    _adMobReady = true;
    _adsCanRequest = true;
    _rewardReady = false;
    let unitySkippedReward = 0;
    // A stale reward callback followed by a skipped/failed completion must not
    // unlock the reward (the black-screen regression reported on TestFlight).
    unityBridge.earned = true;
    unityBridge.completed = false;
    await showRewardedAd(() => { unitySkippedReward += 1; }, adContext('score'));
    await wait(50);
    _rewardReady = false;
    let unityEarnedReward = 0;
    unityBridge.earned = true;
    unityBridge.completed = true;
    await showRewardedAd(() => { unityEarnedReward += 1; }, adContext('score'));
    await wait(900);
    // Completion carries its own earned bit; delivery order must not lose rewards.
    let immediateReward=0;
    unityBridge.showRewardVideoAd=async()=>{
      const dismissed=unityListeners.get('onRewardedVideoAdDismissed');
      dismissed?.({completed:true,earned:true});
      dismissed?.({completed:true,earned:true});
      if(immediateReward!==1)throw new Error('Reward was delayed or duplicated');
      return {completed:true,earned:true};
    };
    await showRewardedAd(()=>{immediateReward++;},adContext('score'));
    let promiseReward=0;
    unityBridge.showRewardVideoAd=async()=>({completed:true,earned:true});
    await showRewardedAd(()=>{promiseReward++;},adContext('score'));
    if(promiseReward!==1)throw new Error('Native completion result lost');

    // Cancelling a target or tapping empty space must retain the watched use.
    dead=false;bombCount=2;bombMode=false;_bombAdCredit=false;
    let toolShows=0;
    unityBridge.showRewardVideoAd=async()=>{toolShows++;return {completed:true,earned:true};};
    activateBomb();await wait(250);
    if(!bombMode)throw new Error('Hammer did not activate after ad');
    activateBomb();activateBomb();await wait(250);
    if(toolShows!==1||!bombMode)throw new Error('Unused hammer requested another ad');
    colorBlastMode=false;setColorBlast(1);_colorAdCredit=false;
    activateColorBlast();await wait(250);
    grid=Array.from({length:GRID},()=>Array(GRID).fill(0));
    useColorBlast(0,0);activateColorBlast();await wait(250);
    if(toolShows!==2||!colorBlastMode)throw new Error('Empty target consumed watched color use');
    dead=true;
    localStorage.removeItem('tiliq_interstitial_opportunities');
    let interstitialShows = 0;
    showInterstitial = () => { interstitialShows += 1; };
    backToMenu = () => {};
    menuWithAd();
    menuWithAd();
    const firstTwoInterstitialShows = interstitialShows;
    menuWithAd();
    window.Capacitor.getPlatform = () => 'ios';
    const iosUnityActive = window.TiliqUnityAdsProvider.active;
    await window.TiliqUnityAdsProvider.initialize();
    await window.TiliqUnityAdsProvider.prepareRewardVideoAd();
    await window.TiliqUnityAdsProvider.prepareInterstitial();
    await window.TiliqUnityAdsProvider.showBanner();

    // A resumed native banner must stay hidden if the screen changed mid-await.
    let releaseResume;
    unityBridge.resumeBanner=()=>new Promise(resolve=>{releaseResume=resolve;});
    unityBridge.hideBanner=async()=>{};
    isNoAds=()=>false;
    document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));
    document.getElementById('screen-menu').classList.add('active');
    _rewardFlowActive=false;_fullScreenAdOpen=false;
    _bannerNativeExists=true;_bannerState='hidden';
    const pendingBanner=showBanner();
    if(!releaseResume)throw new Error('Banner resume did not start');
    await hideBanner();releaseResume();await pendingBanner;
    if(_bannerShown||_bannerState!=='hidden')throw new Error('Stale banner resume became visible');
    _rewardFlowActive=true;
    await showBanner();
    if(_bannerDesired)throw new Error('Banner appeared over reward flow');
    _rewardFlowActive=false;

    return {accountDisabledReward, accountDisabledOverlay, normalReward, fallbackReward, optionalReward, testFlightFallbackReward, testInventoryRequested, fallbackDirect, optionalDirect, lastChanceShown, lastChanceAnimation, lastChanceCleared, noBombWarningHidden, unityActive, unityLoads, unitySkippedReward, unityEarnedReward, firstTwoInterstitialShows, interstitialShows, iosUnityActive};
  });

  if (result.accountDisabledReward !== 1 || result.accountDisabledOverlay !== 'none') throw new Error(`disabled-account fallback failed: ${JSON.stringify(result)}`);
  if (result.normalReward !== 1) throw new Error(`preload reward failed: ${JSON.stringify(result)}`);
  if (!result.testInventoryRequested) throw new Error(`TestFlight did not request demo inventory: ${JSON.stringify(result)}`);
  if (result.fallbackReward !== 1) throw new Error(`rescue fallback failed: ${JSON.stringify(result)}`);
  if (result.optionalReward !== 0) throw new Error(`optional reward leaked: ${JSON.stringify(result)}`);
  if (result.testFlightFallbackReward !== 1) throw new Error(`TestFlight fallback failed: ${JSON.stringify(result)}`);
  if (!result.unityActive || !result.unityLoads.includes('game:android-game') || !result.unityLoads.includes('rewarded:android-reward')) {
    throw new Error(`Unity platform mapping failed: ${JSON.stringify(result)}`);
  }
  if (result.unitySkippedReward !== 0 || result.unityEarnedReward !== 1) {
    throw new Error(`Unity native reward event failed: ${JSON.stringify(result)}`);
  }
  if (result.firstTwoInterstitialShows !== 0 || result.interstitialShows !== 1) {
    throw new Error(`interstitial pacing failed: ${JSON.stringify(result)}`);
  }
  if (!result.iosUnityActive || !['game:800374323', 'rewarded:BP_Rewarded_iOS', 'interstitial:BP_Interstitial_iOS', 'banner:BP_Banner_iOS'].every((id) => result.unityLoads.includes(id))) {
    throw new Error(`iOS Unity placement mapping failed: ${JSON.stringify(result)}`);
  }
  if (!result.fallbackDirect || !result.optionalDirect) throw new Error(`Unexpected post-ad screen: ${JSON.stringify(result)}`);
  if (!result.lastChanceShown || result.lastChanceAnimation !== 'sky-bomb-last-chance' || !result.lastChanceCleared || !result.noBombWarningHidden) {
    throw new Error(`bomb last-chance warning failed: ${JSON.stringify(result)}`);
  }
  console.log(`Rewarded ad and bomb last-chance flows passed: ${JSON.stringify(result)}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
