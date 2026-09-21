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
 await page.waitForFunction(()=>typeof _showBombTargetBar==='function');
 await page.waitForTimeout(3500);
 const sizes=[[320,568,20,0],[375,667,20,0],[375,812,44,34],[390,844,47,34],[393,852,59,34],[414,896,44,34],[430,932,59,34],[360,640,24,0],[360,740,24,16],[768,1024,24,20],[820,1180,24,20]];
 let cases=0;
 for(const [width,height,top,bottom] of sizes){
  await page.setViewportSize({width,height});
  for(const banner of [0,50,90]){
   await page.evaluate(({top,bottom,banner})=>{
    for(const id of ['login-gate','lang-screen','splash','offline-gate']){const el=document.getElementById(id);if(el)el.style.display='none';}
    document.documentElement.style.setProperty('--safe-top',top+'px');document.documentElement.style.setProperty('--safe-bottom',bottom+'px');
    showScreen('game');document.getElementById('overlay').classList.remove('active');_setBannerSpacers(banner);resizeCanvas();
    bombMode=true;bombType='normal';_showBombTargetBar();selectBombTarget(7,7);
   },{top,bottom,banner});
   await page.waitForTimeout(300);
   const check=await page.evaluate(()=>{
    const panel=document.getElementById('bomb-target-bar').getBoundingClientRect(),c=canvas.getBoundingClientRect(),nav=document.querySelector('.game-nav').getBoundingClientRect();
    const boardBottom=c.top+GOY+CELL*GRID;
    const small=[...document.querySelectorAll('#bomb-target-bar button')].some(el=>{const r=el.getBoundingClientRect();return r.width<44||r.height<44;});
    return {boardBottom,panelTop:panel.top,panelBottom:panel.bottom,navTop:nav.top,small,cell:CELL};
   });
   if(check.small||check.panelTop<check.boardBottom+8||check.panelBottom>check.navTop-2)throw Error(JSON.stringify({width,height,banner,...check}));
   cases++;
  }
 }
 await page.setViewportSize({width:393,height:852});
 await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-top','59px');document.documentElement.style.setProperty('--safe-bottom','34px');_setBannerSpacers(50);resizeCanvas();});
 await page.waitForTimeout(300);
 await page.evaluate(()=>{grid=Array.from({length:GRID},(_,r)=>Array.from({length:GRID},(_,c)=>(r+c)%4===0?1:0));ctx.clearRect(0,0,canvas.width,canvas.height);drawBoard(performance.now());});
 await page.screenshot({path:'store-assets/raw/hammer-layout-qa.png'});
 const restored=await page.evaluate(()=>{const before=CELL;cancelBombMode();return !bombMode&&!document.getElementById('bomb-target-bar').classList.contains('active')&&CELL===before;});
 if(!restored)throw Error('Cancel did not restore tray or changed board geometry');
 console.log(JSON.stringify({cases,boardOverlap:0,navigationOverlap:0,minTouchSize:44,cancelRestores:true}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
