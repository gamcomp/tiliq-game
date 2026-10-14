import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const server = http.createServer(async (request, response) => {
  try {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) return response.writeHead(403).end();
    const types = {'.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.html': 'text/html; charset=utf-8'};
    response.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream'});
    response.end(await fs.readFile(file));
  } catch { response.end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://localhost:${server.address().port}`;
let browser;
try {
  let executablePath;
  for (const candidate of [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean)) {
    try { await fs.access(candidate); executablePath = candidate; break; } catch {}
  }
  browser = await chromium.launch({executablePath, headless: true});
  const page = await browser.newPage({viewport: {width: 393, height: 852}});
  page.on('pageerror', error => console.error('Page error:', error.message));
  // Keep QA wallet/score activity local; no authenticated backend is used.
  await page.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
  await page.goto(origin, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => typeof showRewardedAd === 'function');
  const result = await page.evaluate(async () => {
    const assert = (ok, message) => { if (!ok) throw Error(message); };
    const calls = [];
    const spy = new Proxy({}, {get: (_, name) => async () => {
      calls.push(String(name));
      throw Error('An ad bridge was called while disabled: ' + String(name));
    }});
    window.Capacitor = {getPlatform: () => 'android', isNativePlatform: () => true, Plugins: {TiliqUnityAds: spy, AdMob: spy}};
    // Exercise the emergency disabled flow independently of release inventory settings.
    window.TILIQ_UNITY_ADS.android.enabled = false;
    initFirebaseAnalytics = async () => {};
    syncWallet = () => {};
    logEvent = () => {};
    _firestorePushScore = () => {};
    updateMyWeeklyScore = () => {};
    for (const id of ['login-gate', 'lang-screen', 'splash', 'offline-gate']) {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    }
    showScreen('menu');
    assert(!adServiceAvailable() && !TiliqUnityAdsProvider.active && _getAdMob() === null, 'Disabled Android still exposes an ad provider');
    await initAdMob();
    await showBanner();
    await hideBanner();
    await _resumeBannerAfterForeground();
    await _prepareInterstitial();
    await _prepareRewardedAd();
    await showInterstitial();
    let directInitRejected = false;
    try { await TiliqUnityAdsProvider.initialize(); } catch { directInitRejected = true; }
    assert(directInitRejected, 'Direct initialize bypassed the disabled setting');
    for (const id of ['banner-spacer-menu', 'banner-spacer-game']) {
      assert(document.getElementById(id).style.height === '0px' || document.getElementById(id).style.height === '0', 'Empty banner space: ' + id);
    }
    let rewarded = 0;
    await showRewardedAd(() => rewarded++, adContext('score'));
    assert(rewarded === 1 && !_rewardFlowActive && !_fullScreenAdOpen, 'Free reward did not settle immediately');

    startGame();
    bombCount = 1; bombMode = false; dead = false;
    activateBomb();
    assert(bombMode && bombCount === 1, 'Hammer still waits for an ad');
    bombMode = false;
    setColorBlast(1); colorBlastMode = false;
    activateColorBlast();
    assert(colorBlastMode, 'Color blast still waits for an ad');
    colorBlastMode = false;

    for (const code of SKY_LANGS) {
      lang = code; applyLang();
      dead = true; _rescueShownThisGame = false; _r2adUsedThisGame = false;
      showOver();
      assert(document.querySelector('.continue-ad-note').style.display === 'none', 'Ad prompt visible in ' + code);
      assert(document.querySelector('.cp-yes .ui-video-icon').style.display === 'none', 'Ad icon visible in ' + code);
      assert(document.querySelector('.cp-yes [data-t="watchAd"]').textContent === t('continueFlight'), 'Continue label wrong in ' + code);
      assert(document.getElementById('go-reward-sub').textContent === t('dailyCollect'), 'Score reward asks for an ad in ' + code);
    }
    lang = 'TR'; applyLang();
    grid = Array.from({length: GRID}, () => Array(GRID).fill(1));
    dead = true; _r2adUsedThisGame = false;
    answerContinue(true);
    assert(!dead && _r2adUsedThisGame && !grid.flat().every(Boolean), 'Free continue did not restore play');

    let credited = 0;
    tmAddCoins = n => { credited += n; };
    _setupScoreReward(1480);
    claimScoreCoins(); claimScoreCoins();
    assert(credited === coinsFromScore(1480) && _scoreCoinsClaimed, 'Score reward duplicated or blocked');
    localStorage.removeItem('tm_treasure_date'); localStorage.removeItem('tm_mail_week');
    const expected = mailReward().coins || 0; // haftalık posta kutusu (2026-10-15)
    const before = credited;
    claimTreasure(document.getElementById('tb-cta'));
    claimTreasure(document.getElementById('tb-cta'));
    assert(isTreasureClaimed() && credited === before + expected, 'Daily reward duplicated or blocked');
    await new Promise(resolve => setTimeout(resolve, 700));
    assert(calls.length === 0, 'Native ad calls occurred: ' + calls.join(', '));

    window.Capacitor.getPlatform = () => 'ios';
    assert(TiliqUnityAdsProvider.enabled && TiliqUnityAdsProvider.active && adServiceAvailable(), 'Android switch disabled iOS');
    window.Capacitor.getPlatform = () => 'android';
    showScreen('menu');
    return {nativeAdCalls: calls.length, freeRewards: true, singleDailyClaim: true, singleScoreClaim: true, continue: true, hammer: true, colorBlast: true, noBannerGap: true, languages: SKY_LANGS.length, iosPreserved: true};
  });
  console.log(JSON.stringify(result));
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
