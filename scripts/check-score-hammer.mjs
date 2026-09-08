import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report={languages:[],score:{}};
await mkdir('preview/artifacts',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://localhost:4179/game/index.html');
  await page.waitForFunction(()=>!!window.tiliqPreview);
  await page.evaluate(()=>tiliqPreview.run('board'));
  report.score=await page.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    _setScoreImmediate(0);setScoreDisplay(1000);
    await wait(180);const first=_scoreDispVal;
    setScoreDisplay(1500);const retarget=_scoreDispVal;
    const samples=[retarget];
    for(let i=0;i<16;i++){await wait(50);samples.push(_scoreDispVal);}
    setScoreDisplay(3000);await wait(90);startNewGame();await wait(800);
    const reset=_scoreDispVal;
    _setScoreImmediate(0);setScoreDisplay(300);punchScore();
    const animation=getComputedStyle(document.getElementById('scoreDisplay')).animationName;
    await wait(800);
    // Sample exact ages to check time-based float lifespan, regardless of frame rate.
    const f={kind:'lineScore',x:200,y:200,a:1,gain:40,combo:1,rows:1};
    floats=[f];drawFloats();f._t0=performance.now()-550;drawFloats();
    const middle={alpha:f.a,travel:200-f.y};
    f._t0=performance.now()-1200;drawFloats();drawFloats();
    return {first,retarget,samples,reset,animation,final:_scoreDispVal,middle,expired:!floats.includes(f)};
  });
  const s=report.score;
  assert(s.first>0&&s.first<1000);assert.equal(s.first,s.retarget);
  assert(s.samples.every((v,i)=>!i||v>=s.samples[i-1]));assert.equal(s.samples.at(-1),1500);
  assert.equal(s.reset,0);assert.equal(s.final,300);assert.equal(s.animation,'harbor-score-soft');
  assert(s.middle.alpha>.9&&s.middle.travel>0&&s.middle.travel<14&&s.expired);
  const codes=await page.evaluate(()=>Object.keys(HAMMER_TEXT));assert.equal(codes.length,14);
  for(const code of codes){
    const item=await page.evaluate(code=>{
      lang=code;applyLang();bombType='normal';bombCount=3;updateBombBar();
      const keys=Object.keys(HAMMER_TEXT.EN);
      const missing=keys.filter(k=>!HAMMER_TEXT[code][k]||t(k)!==HAMMER_TEXT[code][k]);
      const normal=document.getElementById('bomb-type-lbl').textContent;
      bombType='super';updateBombBar();
      const superName=document.getElementById('bomb-type-lbl').textContent;
      bombType='normal';updateBombBar();
      return {code,missing,normal,superName,expected:HAMMER_TEXT[code].bomb,
        aria:document.querySelector('[data-t-aria="hammerCancelTarget"]').getAttribute('aria-label'),
        expectedAria:t('hammerCancelTarget'),overflow:document.documentElement.scrollWidth>innerWidth};
    },code);
    assert.deepEqual(item.missing,[]);assert.equal(item.normal,item.expected);assert.equal(item.aria,item.expectedAria);assert(!item.overflow);
    report.languages.push(item);
    if(['TR','DE','RU','AR','JA'].includes(code))await page.screenshot({path:`preview/artifacts/hammer-${code}.png`});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  const reduced=await page.evaluate(()=>{_setScoreImmediate(0);setScoreDisplay(9876);return {value:_scoreDispVal,raf:_scoreDispRaf};});
  assert.equal(reduced.value,9876);assert.equal(reduced.raf,null);report.reduced=reduced;
  assert.deepEqual(errors,[]);report.errors=errors;
  await writeFile('preview/artifacts/score-hammer-qa.json',JSON.stringify(report,null,2));
  console.log('PASS: smooth score retarget/reset/floats/reduced motion; 14-language hammer labels, hints, tutorials, packs and ARIA.');
}finally{await browser.close();}
