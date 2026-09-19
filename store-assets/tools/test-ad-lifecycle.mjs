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

try{
 await page.goto(baseUrl,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof showInterstitial==='function');
 const result=await page.evaluate(async()=>{
  const assert=(v,m)=>{if(!v)throw Error(m);};
  const tick=()=>new Promise(r=>setTimeout(r,0));
  const handlers=new Map();let loads=0,shows=0,hidden=0,restored=0,releaseLoad,mode='promise';
  const ad={kind:'unity',addListener:async(n,fn)=>{handlers.set(n,fn);return {remove:()=>handlers.delete(n)};},
   prepareInterstitial:()=>{loads++;return new Promise(r=>releaseLoad=r);},
   showInterstitial:async()=>{shows++;if(mode==='failure')throw Error('show failed');if(mode==='event'){handlers.get('interstitialAdDismissed')?.();return new Promise(()=>{});}},
   hideBanner:async()=>{hidden++;},resumeBanner:async()=>{},showBanner:async()=>{},removeBanner:async()=>{}
  };
  adServiceAvailable=()=>true;isNoAds=()=>false;_getAdMob=()=>ad;_adMobReady=true;_adsCanRequest=true;
  _restoreAfterAd=()=>{restored++;};
  _interReady=false;_lastInterstitialAt=0;
  const pre=_prepareInterstitial();const first=showInterstitial();await tick();
  await showInterstitial();const reward=await showRewardedAd(()=>{},adContext('score'));
  assert(loads===1&&reward.status==='busy','Shared load/fullscreen reservation failed');
  releaseLoad();await pre;await first;
  assert(shows===1&&!_interFlowActive&&!_fullScreenAdOpen&&!handlers.size,'Promise-only close leaked lock/listeners');
  // Post-show preload is shared with the next request.
  releaseLoad();await tick();_lastInterstitialAt=0;mode='event';await showInterstitial();
  assert(shows===2&&!_fullScreenAdOpen&&handlers.size===0,'Dismissal with hung show promise did not release');
  releaseLoad();await tick();_lastInterstitialAt=0;mode='failure';await showInterstitial();
  assert(!_interFlowActive&&!_fullScreenAdOpen&&handlers.size===0,'Show failure leaked lock');
  releaseLoad();await tick();_lastInterstitialAt=0;_rewardFlowActive=true;
  await showInterstitial();assert(shows===3,'Interstitial interrupted reward');_rewardFlowActive=false;
  _adsCanRequest=false;_adMobReady=true;_adMobInitPromise=null;
  let consentCalls=0;initFirebaseAnalytics=async()=>{};_syncAdAudioPolicy=()=>{};_prepareRewardedAd=async()=>false;
  ad.requestConsentInfo=async()=>({canRequestAds:++consentCalls>1});
  await initAdMob();assert(!_adsCanRequest&&_adMobInitPromise===null,'Failed consent permanently cached');
  await initAdMob();assert(_adsCanRequest&&consentCalls===2,'Consent/network retry did not recover');
  return {sharedPreload:true,fullScreenExclusion:true,promiseOnlyClose:true,eventOnlyClose:true,showFailure:true,consentRecovery:true,shows,hidden,restored};
 });console.log(JSON.stringify(result));
}finally{await browser.close();await new Promise(r=>server.close(r));}
