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
 await page.waitForFunction(()=>typeof _runRewardedSession==='function');
 const result=await page.evaluate(async()=>{
  const wait=ms=>new Promise(r=>setTimeout(r,ms));
  adServiceAvailable=()=>true;isNoAds=()=>false;
  _adMobReady=true;_adsCanRequest=true;
  _prepareRewardedAd=async()=>{_rewardReady=true;return true;};
  const listeners=new Map();let mode='late-result',shows=0;
  let retainedDismiss;
  const bridge={
   kind:'unity',
   addListener:async(name,cb)=>{listeners.set(name,cb);return {remove:()=>{if(listeners.get(name)===cb)listeners.delete(name);}};},
   hideBanner:async()=>{},showBanner:async()=>{},resumeBanner:async()=>{},removeBanner:async()=>{},
   showRewardVideoAd:async()=>{
    shows++;const dismiss=listeners.get('onRewardedVideoAdDismissed'),reward=listeners.get('onRewardedVideoAdReward');retainedDismiss=dismiss;
    if(mode==='slow-result'){dismiss({completed:true});await wait(2800);return {completed:true,earned:true};}
    if(mode==='late-result'){dismiss({completed:true});await wait(50);return {completed:true,earned:true};}
    if(mode==='late-event'){dismiss({completed:true});setTimeout(()=>reward({completed:true}),50);return {};}
    if(mode==='duplicate'){reward({completed:true});dismiss({completed:true,earned:true});dismiss({completed:true,earned:true});return {completed:true,earned:true};}
    if(mode==='skip'){reward({});dismiss({completed:false,earned:false});return {completed:false,earned:false};}
    if(mode==='no-proof'){dismiss({});return {};}
    if(mode==='fail'){throw Error('show failed');}
    if(mode==='missing-event'){await wait(20);return {completed:true,earned:true};}
   }
  };
  _getAdMob=()=>bridge;
  let applied=0;
  for(const m of ['late-result','late-event','duplicate','missing-event','slow-result']){mode=m;const before=applied;const out=await showRewardedAd(()=>applied++,adContext('score'));if(out.status!=='earned'||applied!==before+1)throw Error(m+' lost or duplicated reward');if(listeners.size)throw Error('Leaked listeners');}
  const stale=retainedDismiss;
  mode='skip';const skipped=await showRewardedAd(()=>applied++,adContext('score'));stale({completed:true,earned:true});if(skipped.status!=='skipped'||applied!==5)throw Error('Skipped or stale reward granted');
  mode='no-proof';const absent=await showRewardedAd(()=>applied++,adContext('score'));if(absent.status!=='unavailable'||applied!==5)throw Error('Unconfirmed reward granted');closeAd(false);
  mode='fail';const failed=await showRewardedAd(()=>applied++,adContext('score'));if(failed.status!=='unavailable'||applied!==5||listeners.size)throw Error('Failed show granted or leaked');closeAd(false);
  mode='late-result';const one=showRewardedAd(()=>applied++,adContext('score'));const busy=await showRewardedAd(()=>applied++,adContext('score'));if(busy.status!=='busy')throw Error('Concurrent show allowed');await one;
  const hide=_hideAdOverlay;_hideAdOverlay=()=>{throw Error('Simulated cosmetic failure');};mode='missing-event';const before=applied;await showRewardedAd(()=>applied++,adContext('score'));_hideAdOverlay=hide;if(applied!==before+1)throw Error('UI failure blocked reward');

  // Exercise real game actions against out-of-order native notifications.
  mode='late-event';dead=false;bombCount=2;bombMode=false;_bombAdCredit=false;
  activateBomb();await wait(150);if(!bombMode||!_bombAdCredit)throw Error('Hammer not unlocked');
  const beforeShows=shows;activateBomb();activateBomb();await wait(30);if(shows!==beforeShows)throw Error('Unused hammer required a second ad');
  bombMode=false;dead=true;rescueUsed=false;
  grid=Array.from({length:GRID},()=>Array(GRID).fill(1));
  doRescue();await wait(150);if(dead||!rescueUsed||grid.flat().every(Boolean))throw Error('Continue not applied');
  let credited=0;tmAddCoins=n=>{credited+=n;};syncWallet=()=>{};updateStoreCoinBal=()=>{};
  _scoreCoinsClaimed=false;_pendingScoreCoins=37;
  claimScoreCoins();claimScoreCoins();await wait(150);if(credited!==37||!_scoreCoinsClaimed)throw Error('Score coins not applied exactly once');
  localStorage.removeItem('tm_treasure_date');const expected=dailyReward(loadStreak()).coins||0;
  claimTreasure(document.getElementById('tb-cta'));claimTreasure(document.getElementById('tb-cta'));await wait(200);
  if(!isTreasureClaimed()||credited!==37+expected)throw Error('Daily bonus not applied once');
  localStorage.removeItem('tm_treasure_date');mode='skip';const btn=document.getElementById('tb-cta');claimTreasure(btn);await wait(100);if(btn.disabled||isTreasureClaimed())throw Error('Skipped daily claim button not restored');
  return {outOfOrder:true,duplicates:true,skipped:true,missingProof:true,concurrent:true,cleanupFailure:true,hammer:true,continue:true,coins:true,daily:true,shows};
 });console.log(JSON.stringify(result));
}finally{await browser.close();await new Promise(r=>server.close(r));}
