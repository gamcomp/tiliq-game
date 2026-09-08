import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
await mkdir('preview/artifacts',{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const report=[];
try{
  for(const width of [360,390,430,768,1440]){
    const page=await browser.newPage({viewport:{width,height:width===360?640:900}}),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith('http://localhost:4179'))external.push(r.url());});
    await page.goto('http://localhost:4179/game/index.html');await page.waitForFunction(()=>!!window.tiliqPreview);
    const rewards=await page.evaluate(()=>{
      const status=()=>({mission:document.querySelector('.sky-missions>.reward-badge').hidden,
        daily:document.querySelector('#treasure-box>.reward-badge').hidden,
        total:document.querySelector('#menu-nav .reward-badge').textContent});
      localStorage.setItem('tm_treasure_date',todayStr());saveSkyMissionState({date:todayStr(),combos:0,rows:4,score:0,claimed:{}});renderDailyCard();
      const none=status();
      saveSkyMissionState({date:todayStr(),combos:5,rows:5,score:500,claimed:{}});localStorage.removeItem('tm_treasure_date');renderDailyCard();
      const ready=status();
      const coins=Number(localStorage.getItem('tm_coins'));claimSkyMission('combos');claimSkyMission('combos');
      const once=Number(localStorage.getItem('tm_coins'))-coins,afterClaim=status();
      claimSkyMission('rows');claimSkyMission('score');_grantTreasureReward(document.getElementById('treasure-box'));
      const collected=status();
      const s=skyMissionState();s.date='2000-01-01';localStorage.setItem('tm_sky_missions',JSON.stringify(s));localStorage.setItem('tm_treasure_date','2000-01-01');
      document.dispatchEvent(new Event('visibilitychange'));const rollover=status();
      tiliqPreview.run('rewards');return {none,ready,once,afterClaim,collected,rollover};
    });
    assert(rewards.none.mission&&rewards.none.daily);assert.equal(rewards.ready.total,'! 4');
    assert.equal(rewards.once,60);assert.equal(rewards.afterClaim.total,'! 3');
    assert(rewards.collected.mission&&rewards.collected.daily);assert(rewards.rollover.mission&&!rewards.rollover.daily);
    await page.waitForTimeout(550);await page.screenshot({path:`preview/artifacts/rewards-${width}.png`});
    // Local identity fixture only, no backend or account writes. Exercise the real button.
    await page.evaluate(()=>{acct._fbLogged=true;acct.uid='local-ui-test';tiliqPreview.run('ranking');setLBTab('friends');});
    await page.locator('.btn-add-friend').click();await page.waitForTimeout(350);
    const front=await page.evaluate(()=>{
      const modal=document.getElementById('modal-add-friend'),input=document.getElementById('friend-code-input'),r=input.getBoundingClientRect();
      return {hit:modal.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)),inert:document.getElementById('lb-panel').inert,focused:modal.contains(document.activeElement)};
    });
    assert(front.hit&&front.inert&&front.focused);
    await page.locator('#friend-code-input').fill('abc123');assert.equal(await page.locator('#friend-code-input').inputValue(),'ABC123');
    for(let i=0;i<10;i++){await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.getElementById('modal-add-friend').contains(document.activeElement)));}
    await page.screenshot({path:`preview/artifacts/friend-front-${width}.png`});
    await page.keyboard.press('Escape');
    const closed=await page.evaluate(()=>({closed:!document.getElementById('modal-add-friend').classList.contains('active'),inert:document.getElementById('lb-panel').inert,focus:document.activeElement.classList.contains('btn-add-friend'),parent:document.getElementById('lb-panel').classList.contains('open')}));
    assert(closed.closed&&!closed.inert&&closed.focus&&closed.parent);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);report.push({width,rewards,front,closed});await page.close();
  }
  await writeFile('preview/artifacts/rewards-friends-qa.json',JSON.stringify(report,null,2));
  console.log('PASS: earned reward counts, claims/no double claim, day rollover; real Add Friend click, hit testing, typing, focus containment, Escape/return at 5 widths.');
}finally{await browser.close();}
