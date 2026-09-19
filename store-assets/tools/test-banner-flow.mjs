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
 await page.waitForFunction(()=>typeof showBanner==='function');
 const result=await page.evaluate(async()=>{
  const assert=(ok,msg)=>{if(!ok)throw Error(msg);};
  const tick=()=>new Promise(r=>originalSetTimeout(r,0));
  const originalSetTimeout=window.setTimeout,originalClearTimeout=window.clearTimeout;
  const timers=new Map();let timerId=100000;
  window.setTimeout=(fn,ms,...args)=>{if(ms===20000||[2000,5000,10000,30000,60000].includes(ms)){const id=++timerId;timers.set(id,{fn,ms});return id;}return originalSetTimeout(fn,ms,...args);};
  window.clearTimeout=id=>{timers.delete(id);originalClearTimeout(id);};
  const listeners={};let shows=0,resumes=0,removes=0,mode='success',release;
  const ad={
   addListener:async(name,fn)=>{listeners[name]=fn;return {remove(){}};},
   showBanner:()=>{shows++;if(mode==='pending')return new Promise(r=>release=r);if(mode==='fail'){listeners.bannerAdFailedToLoad({message:'no fill'});return Promise.reject(Error('no fill'));}return Promise.resolve();},
   resumeBanner:async()=>{resumes++;if(mode==='expired')throw Error('expired');},
   hideBanner:async()=>{},removeBanner:async()=>{removes++;}
  };
  adServiceAvailable=()=>true;isNoAds=()=>false;_getAdMob=()=>ad;
  window.TiliqUnityAdsProvider=ad;_adMobReady=true;_adsCanRequest=true;_fullScreenAdOpen=false;_rewardFlowActive=false;
  document.querySelectorAll('.screen.active').forEach(el=>el.classList.remove('active'));document.getElementById('screen-menu').classList.add('active');
  _bannerSizeListenerAdded=false;await _installBannerListeners(ad);
  const reset=async()=>{await hideBanner();_bannerNativeExists=false;_bannerState='idle';_bannerRetryAttempt=0;await tick();};
  await reset();await showBanner();assert(_bannerShown&&_bannerLoadTimer===null,'Unity resolved banner remained loading without event');
  await hideBanner();await showBanner();assert(resumes===1&&shows===1,'Cached banner was unnecessarily reloaded');
  await hideBanner();mode='expired';await showBanner();assert(shows===2&&_bannerShown,'Expired cached banner did not load immediately');
  await reset();mode='fail';await showBanner();await tick();assert(_bannerState==='failed'&&_bannerRetryAttempt===1,'Failure counted twice');assert(timers.get(_bannerRetryTimer)?.ms===2000,'First retry is not 2 seconds');
  const retry=timers.get(_bannerRetryTimer).fn;mode='success';retry();await tick();assert(_bannerShown,'Retry failed to show');listeners.bannerAdImpression();assert(_bannerRetryAttempt===0,'Impression did not reset backoff');
  await reset();mode='pending';const pending=showBanner();await tick();const oldRelease=release;assert(_bannerState==='loading','Expected pending load');
  const timeout=timers.get(_bannerLoadTimer).fn;timeout();await tick();assert(_bannerState==='failed','Hung load not released');
  mode='success';await showBanner();oldRelease();await pending;assert(_bannerShown,'Old load completion overwrote new request');
  await reset();mode='pending';const hiddenLoad=showBanner();await tick();await hideBanner();release();await hiddenLoad;assert(!_bannerShown&&_bannerState==='hidden','Hidden load became visible');
  mode='success';await _resumeBannerAfterForeground();assert(_bannerShown,'Foreground did not restore banner');
  await hideBanner();_rewardFlowActive=true;const count=shows;await showBanner();assert(shows===count&&!_bannerDesired,'Banner requested during rewarded flow');_rewardFlowActive=false;
  await showBanner();await hideBanner();assert(!_bannerRetryTimer&&!_bannerLoadTimer&&_bannerHeight===0,'Hidden banner left timer or spacer');
  window.setTimeout=originalSetTimeout;window.clearTimeout=originalClearTimeout;
  return {promiseFallback:true,cachedResume:true,expiredReload:true,singleRetry:true,loadTimeout:true,staleCompletion:true,hideDuringLoad:true,foreground:true,rewardedHidden:true,shows,resumes,removes};
 });console.log(JSON.stringify(result));
}finally{await browser.close();await new Promise(r=>server.close(r));}
