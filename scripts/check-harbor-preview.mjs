import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const out=path.resolve('preview/artifacts');await mkdir(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true,args:['--autoplay-policy=no-user-gesture-required']});
const results=[];
try{
  for(const [width,height]of [[360,640],[390,844],[430,932],[768,1024],[1440,1000]]){
    const page=await browser.newPage({viewport:{width,height}}),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith('http://localhost:4179'))external.push(r.url());});
    await page.goto('http://localhost:4179/game/index.html');
    await page.waitForFunction(()=>!!window.tiliqPreview);
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:path.join(out,`home-${width}.png`)});
    await page.locator('#screen-menu .btn-play').click();
    await page.locator('#screen-game.active').waitFor({state:'visible'});
    await page.evaluate(()=>tiliqPreview.run('board'));
    await page.waitForTimeout(300);
    await page.screenshot({path:path.join(out,`game-${width}.png`)});
    const layout=await page.evaluate(()=>{
      const canvas=document.getElementById('gameCanvas').getBoundingClientRect();
      return {overflow:document.documentElement.scrollWidth>innerWidth,canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},tileStyle:'original',bomb:document.getElementById('bomb-btn').getBoundingClientRect().toJSON()};
    });
    await page.evaluate(()=>tiliqPreview.run('line'));
    await page.screenshot({path:path.join(out,`hint-${width}.png`)});
    await page.evaluate(()=>tiliqPreview.place());
    await page.waitForTimeout(900);
    const line=await page.evaluate(()=>({cleared:grid[6].every(v=>!v),score,particles:sparks.length+flames.length}));
    if(!line.cleared||line.score<=2480)throw new Error(`Line clear failed ${width}`);
    await page.evaluate(()=>{tiliqPreview.run('surge');tiliqPreview.place();});
    await page.waitForTimeout(210);
    await page.screenshot({path:path.join(out,`combo-${width}.png`)});
    await page.waitForTimeout(700);
    const highCombo=await page.evaluate(()=>({combo,score,cleared:grid[5].every(v=>!v)&&grid[6].every(v=>!v),particles:sparks.length+flames.length}));
    if(highCombo.combo!==10||highCombo.score!==2980||!highCombo.cleared||highCombo.particles>100)throw new Error(`High combo failed: ${JSON.stringify(highCombo)}`);
    await page.evaluate(()=>tiliqPreview.run('bomb'));
    const warning=await page.locator('#bomb-btn').evaluate(el=>el.classList.contains('last-chance'));
    await page.locator('#bomb-btn').click();
    await page.evaluate(()=>{selectBombTarget(3,3);confirmBombTarget();});
    await page.waitForTimeout(1000);
    const bomb=await page.evaluate(()=>({count:bombCount,cleared:grid[3][3]===0,dead}));
    if(!warning||bomb.count!==0||!bomb.cleared)throw new Error(`Bomb failed ${width}: ${JSON.stringify(bomb)}`);
    await page.evaluate(()=>tiliqPreview.run('settings'));
    await page.screenshot({path:path.join(out,`settings-${width}.png`)});
    if(errors.length||external.length||layout.overflow)throw new Error(JSON.stringify({width,errors,external,layout}));
    results.push({width,height,layout,line,highCombo,bomb,warning,errors,externalRequests:external.length});await page.close();
  }
  const page=await browser.newPage({viewport:{width:1440,height:1040}});
  await page.goto('http://localhost:4179');await page.waitForTimeout(900);
  await page.screenshot({path:path.join(out,'review-desktop.png')});
  await page.getByRole('button',{name:'Örnek tahta',exact:true}).click();
  await page.screenshot({path:path.join(out,'review-game.png')});
  await page.getByRole('button',{name:'Önceki',exact:true}).click();await page.waitForTimeout(600);
  const baseline=await page.frameLocator('#game').locator('#gameCanvas').isVisible();
  await page.getByRole('button',{name:'Geliştirilmiş',exact:true}).click();await page.waitForTimeout(600);
  const frame=page.frames().find(f=>f.url().includes('/game/index.html'));
  const audio=await frame.evaluate(async()=>{
    const wait=ms=>new Promise(r=>setTimeout(r,ms));
    _unlockSkyMusic();const a=getAC();await a.resume();
    const analyser=a.createAnalyser();analyser.fftSize=1024;
    HarborSound.monitor(a).connect(analyser);
    const buffer=new Float32Array(analyser.fftSize);
    playBomb();await wait(100);analyser.getFloatTimeDomainData(buffer);
    const peak=Math.max(...buffer.map(Math.abs));
    document.getElementById('snd-toggle').checked=false;updateSound();playBomb();await wait(300);
    analyser.getFloatTimeDomainData(buffer);const mutedPeak=Math.max(...buffer.map(Math.abs));
    await wait(400);
    const mutedVoices=HarborSound.stats().voices;
    document.getElementById('snd-toggle').checked=true;updateSound();
    updateMix('effects',32);updateMix('music',21);
    _stopSkyMusic();const stale=a.currentTime-120;_skyMusic.next=stale;
    _startSkyMusic('game');
    const schedulerCaughtUp=_skyMusic.next>a.currentTime;
    _stopSkyMusic();await wait(150);
    for(let i=0;i<20;i++)playBomb();
    const maxVoices=HarborSound.stats().voices;await wait(800);
    const cleaned=HarborSound.stats().voices;
    return {peak,mutedPeak,mutedVoices,maxVoices,cleaned,schedulerCaughtUp,effects:effectsLevel,music:musicLevel};
  });
  if(!baseline||audio.peak<=0||audio.mutedPeak>.0001||audio.mutedVoices!==0||audio.maxVoices>24||audio.cleaned!==0||!audio.schedulerCaughtUp)throw new Error(JSON.stringify({baseline,audio}));
  await page.close();
  const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce',userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'});
  await reduced.goto('http://localhost:4179/game/index.html');await reduced.waitForFunction(()=>!!window.tiliqPreview);
  await reduced.evaluate(()=>{tiliqPreview.run('surge');tiliqPreview.place();});await reduced.waitForTimeout(160);
  const reducedResult=await reduced.evaluate(()=>{draw();return {low:_LOW_FX,reduced:_reducedMotion.matches,particles:sparks.length+flames.length,numberAnimation:getComputedStyle(document.getElementById('comboDisplay')).animationName};});
  if(!reducedResult.low||!reducedResult.reduced||reducedResult.particles>30||reducedResult.numberAnimation!=='none')throw new Error(JSON.stringify(reducedResult));
  await reduced.screenshot({path:path.join(out,'combo-reduced-motion.png')});await reduced.close();
  const perf=[];
  for(const variant of ['before','game']){
    const p=await browser.newPage({viewport:{width:390,height:844}});
    await p.goto(`http://localhost:4179/${variant}/index.html`);await p.waitForFunction(()=>!!window.tiliqPreview);
    const timing=await p.evaluate(()=>{
      tiliqPreview.run('board');stopLoop();grid=Array.from({length:8},(_,r)=>Array.from({length:8},(_,c)=>(r+c)%6+1));
      for(let i=0;i<10;i++)draw();const measures=[];
      for(let i=0;i<120;i++){const start=performance.now();draw();measures.push(performance.now()-start);}
      measures.sort((a,b)=>a-b);return {medianMs:measures[60],p95Ms:measures[114]};
    });perf.push({variant,...timing});await p.close();
  }
  await writeFile(path.join(out,'qa.json'),JSON.stringify({results,baseline,audio,reducedResult,perf},null,2));
  console.log(JSON.stringify({screens:results.length,baseline,audio,reducedResult,perf,artifacts:out},null,2));
}finally{await browser.close();}
