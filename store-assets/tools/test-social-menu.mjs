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
 await page.goto(baseUrl,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>typeof openLeaderboardTab==='function');
 const result=await page.evaluate(()=>{
  requireAccount=()=>true;isLoggedIn=()=>true;fetchFriendScores=async()=>{};renderLB=()=>{};
  acct.mascot='pilot';acct.name='Me';
  saveFriendsList([{name:'Mira',code:'ABC123',score:200,mascot:'navigator'},{name:'Atlas',code:'XYZ789',score:100,mascot:'commander'}]);
  openLeaderboardTab('friends');
  if(currentLBTab!=='friends'||!document.querySelector('.lb-tab-body[data-tab="friends"]').classList.contains('active'))throw Error('Friends route');
  const sources=[...document.querySelectorAll('#lb-friends-list .friend-avatar img')].map(x=>x.getAttribute('src'));
  if(!sources.includes(avatarImg('navigator'))||!sources.includes(avatarImg('commander'))||!sources.includes(avatarImg('pilot')))throw Error('Selected portraits missing');
  openLeaderboardTab('global');if(currentLBTab!=='global')throw Error('World route');
  for(const code of SKY_LANGS){lang=code;applyLang();for(const key of ['navTeam','navPalace','dailyMailStreak'])if(!SKY_TEXT[code][key])throw Error('Translation missing '+code+key);renderDailyModal();if(document.querySelectorAll('#daily-modal-body .dr-day').length!==7)throw Error('Mail series');}
  return {languages:SKY_LANGS.length,portraits:sources.length,mailDays:7};
 });
 for(const width of [320,375,390,430,820]){
  await page.setViewportSize({width,height:width===820?1180:844});
  await page.evaluate(()=>{lang='TR';applyLang();document.getElementById('lb-panel').classList.remove('open');showScreen('menu');});
  await page.waitForTimeout(100);
  const overflow=await page.evaluate(()=>[...document.querySelectorAll('#menu-nav [data-t]')].filter(el=>el.scrollWidth>el.clientWidth+2).map(el=>el.textContent));
  if(overflow.length)throw Error('Nav overflow '+width+': '+overflow.join(','));
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>openLeaderboardTab('friends'));
 await page.screenshot({path:'store-assets/raw/friends-qa.png'});
 console.log(JSON.stringify({...result,screenWidths:[320,375,390,430,820]}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
