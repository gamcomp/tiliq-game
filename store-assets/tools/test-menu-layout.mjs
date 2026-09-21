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
 await page.waitForFunction(()=>typeof showScreen==='function');
 await page.waitForTimeout(3500);
 await page.evaluate(()=>{for(const id of ['login-gate','lang-screen','splash','offline-gate']){const el=document.getElementById(id);if(el)el.style.display='none';}showScreen('menu');});
 const cases=[];
 for(const [width,height,top,bottom] of [[320,568,20,0],[375,667,20,0],[375,812,44,34],[390,844,47,34],[393,852,59,34],[414,896,44,34],[430,932,59,34],[360,640,24,0],[360,740,24,16],[768,1024,24,20],[820,1180,24,20]]){
  await page.setViewportSize({width,height});
  for(const banner of [0,50,90]){
   await page.evaluate(({top,bottom,banner})=>{showScreen('menu');document.documentElement.style.setProperty('--safe-top',top+'px');document.documentElement.style.setProperty('--safe-bottom',bottom+'px');_setBannerSpacers(banner);},{top,bottom,banner});
   await page.waitForTimeout(300);
   const check=await page.evaluate(()=>{
    const selectors=['#menu-play-btn','.sky-missions','.sky-ranking','#treasure-box','#menu-nav'];
    const boxes=selectors.map(selector=>{const r=document.querySelector(selector).getBoundingClientRect();return {selector,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};});
    const problems=[];
    for(let i=0;i<boxes.length;i++){
     const a=boxes[i];if(a.width<44||a.height<44)problems.push('small '+a.selector);
     if(a.x<0||a.right>innerWidth+1||a.y<0||a.bottom>innerHeight+1)problems.push('outside '+a.selector);
     for(let j=i+1;j<boxes.length;j++){const b=boxes[j];if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>1)problems.push(a.selector+' overlaps '+b.selector);}
    }
    return {boxes,problems};
   });
   if(check.problems.length)throw Error(JSON.stringify({width,height,banner,...check}));
   cases.push({width,height,banner});
  }
 }
 await page.setViewportSize({width:393,height:852});
 await page.evaluate(()=>{document.documentElement.style.setProperty('--safe-top','59px');document.documentElement.style.setProperty('--safe-bottom','34px');_setBannerSpacers(50);});
 await page.waitForTimeout(300);
 await page.screenshot({path:'store-assets/raw/menu-layout-qa.png'});
 console.log(JSON.stringify({cases:cases.length,overlaps:0,minTouchSize:44}));
}finally{await browser.close();await new Promise(r=>server.close(r));}
