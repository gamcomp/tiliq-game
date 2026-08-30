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
    const listeners = new Map();
    let prepareMode = 'delayed-success';
    const AdMob = {
      addListener: async (name, callback) => {
        listeners.set(name, callback);
        return {remove: () => listeners.delete(name)};
      },
      prepareRewardVideoAd: async () => {
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

    // Regression: a tap during an existing preload must await that same request.
    _rewardReady = false;
    const preload = _prepareRewardedAd();
    let normalReward = 0;
    await wait(10);
    showRewardedAd(() => { normalReward += 1; }, adContext('rescue', {allowNoFill: true}));
    await preload;
    await wait(900);

    // No-fill: only the game-rescue context may continue without an ad.
    prepareMode = 'failure';
    _rewardReady = false;
    let fallbackReward = 0;
    await showRewardedAd(() => { fallbackReward += 1; }, adContext('rescue', {allowNoFill: true}));
    const fallbackLabel = document.getElementById('ad-skip-btn').textContent;
    document.getElementById('ad-skip-btn').click();
    await wait(50);

    // Optional coin rewards must stay locked when inventory is unavailable.
    _rewardReady = false;
    let optionalReward = 0;
    await showRewardedAd(() => { optionalReward += 1; }, adContext('score'));
    const optionalLabel = document.getElementById('ad-skip-btn').textContent;
    document.getElementById('ad-skip-btn').click();

    return {normalReward, fallbackReward, optionalReward, fallbackLabel, optionalLabel};
  });

  if (result.normalReward !== 1) throw new Error(`preload reward failed: ${JSON.stringify(result)}`);
  if (result.fallbackReward !== 1) throw new Error(`rescue fallback failed: ${JSON.stringify(result)}`);
  if (result.optionalReward !== 0) throw new Error(`optional reward leaked: ${JSON.stringify(result)}`);
  if (!result.fallbackLabel || result.fallbackLabel === result.optionalLabel) throw new Error(`fallback label failed: ${JSON.stringify(result)}`);
  console.log(`Rewarded ad flow passed: ${JSON.stringify(result)}`);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
