import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const root=await readFile('index.html','utf8');
const original=execFileSync('git',['show','HEAD:index.html'],{encoding:'utf8',maxBuffer:8e6});
const tile=s=>s.slice(s.indexOf('function _drawCrownTile('),s.indexOf('function drawCell(')).replace(/\r/g,'').trim();
assert.equal(tile(root),tile(original),'Original tile renderer must be restored exactly');
assert(!root.includes('kingdom-gems')&&!root.includes('id="btn-light"')&&!root.includes('id="btn-dark"'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report=[];await mkdir('preview/artifacts',{recursive:true});
try{
  for(const [width,height]of [[360,640],[390,844],[430,932],[768,1024],[1440,1000]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[],external=[];
    await page.addInitScript(()=>{localStorage.setItem('tm_theme','light');localStorage.setItem('tm_gems','123');});
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith('http://localhost:4179'))external.push(r.url());});
    await page.goto('http://localhost:4179/game/index.html');await page.waitForFunction(()=>!!window.tiliqPreview);
    const screens=[];
    for(const scene of ['home','settings','missions','daily','store','profile','ranking','over','board']){
      await page.evaluate(scene=>tiliqPreview.run(scene),scene);await page.waitForTimeout(scene==='ranking'?1400:450);
      const check=await page.evaluate(()=>{
        const panel=document.querySelector('.modal.active .modal-card,#lb-panel.open #lb-card,#overlay.active');
        const rect=panel?.getBoundingClientRect();
        return {theme:document.body.dataset.theme,gems:localStorage.getItem('tm_gems'),overflow:document.documentElement.scrollWidth>innerWidth,
          panel:rect?{x:rect.x,y:rect.y,right:rect.right,bottom:rect.bottom}:null,
          cloudVisibility:getComputedStyle(document.querySelector('.harbor-atmosphere')).visibility};
      });
      assert.equal(check.theme,'dark');assert.equal(check.gems,'123');assert(!check.overflow,`${scene}/${width} overflow`);
      if(check.panel){assert(check.panel.x>=-1&&check.panel.right<=width+1,`${scene}/${width} panel sides`);assert(check.panel.y>=-1&&check.panel.bottom<=height+1,`${scene}/${width} panel height`);}
      if(width===390||scene==='home')await page.screenshot({path:`preview/artifacts/living-${scene}-${width}.png`});
      screens.push({scene,...check});
    }
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);report.push({width,height,screens,errors,external});await page.close();
  }
  const low=await browser.newPage();
  await low.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{get:()=>2}));
  await low.goto('http://localhost:4179/game/index.html');await low.waitForFunction(()=>!!window.tiliqPreview);
  assert(await low.evaluate(()=>HarborMotion.minimal()&&getComputedStyle(document.querySelector('.harbor-atmosphere')).display==='none'));
  const reduced=await browser.newPage({reducedMotion:'reduce'});
  await reduced.goto('http://localhost:4179/game/index.html');await reduced.waitForFunction(()=>!!window.tiliqPreview);
  assert(await reduced.evaluate(()=>HarborMotion.minimal()&&getComputedStyle(document.querySelector('.harbor-atmosphere')).display==='none'));
  await writeFile('preview/artifacts/living-qa.json',JSON.stringify({originalTiles:true,lowResource:true,reducedMotion:true,report},null,2));
  console.log('PASS: original tiles, no gem wallet or theme selector, legacy light preference ignored; 9 screens × 5 sizes; low/reduced-motion paths.');
}finally{await browser.close();}
