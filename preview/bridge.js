/* Actual game functions, deterministic local fixtures. No account/cloud identity. */
(()=>{
  // The production load listener would reopen the sign-in gate after this bridge.
  // Suppress it only inside this isolated preview response.
  window.removeEventListener('load',_updateLoginGate);
  document.getElementById('login-gate').hidden=true;
  acct={name:'Test Pilotu',nickname:'Test Pilotu',mascot:'ruby',country:'🇹🇷',games:12,best:28400,total:42600};
  const piece=(cells,ci)=>({shape:{cells},ci,placed:false,rotFlash:0,rotT:0});
  const hide=()=>{
    if(document.getElementById('modal-add-friend').classList.contains('active'))hideModal('add-friend');
    document.querySelectorAll('.modal').forEach(m=>m.classList.remove('active'));
    document.getElementById('lb-panel').classList.remove('open');
    document.getElementById('login-gate').classList.remove('show');
    document.getElementById('tut-overlay').style.display='none';
    document.getElementById('overlay').classList.remove('active');
  };
  function fixture(kind){
    hide();setInvBombs(3);setColorBlast(3);startNewGame();
    grid=Array.from({length:GRID},()=>Array(GRID).fill(0));
    score=2480;combo=0;
    const sample=[[1,1,0,0,0,0,5,5],[1,0,0,0,0,0,5,0],[0,0,2,2,0,0,0,0],[0,0,2,0,0,6,6,0],[0,0,0,0,0,6,0,0],[3,3,0,0,0,0,0,4],[3,0,0,0,0,0,4,4],[0,0,0,0,0,0,0,0]];
    if(kind==='board')grid=sample;
    if(kind==='line'||kind==='combo'||kind==='surge'){
      grid=sample;
      grid[6]=[1,2,3,4,5,6,0,0];
      if(kind==='combo'||kind==='surge'){grid[5]=[2,3,4,5,6,1,0,0];combo=kind==='surge'?8:3;resetComboTimer();}
    }
    if(kind==='bomb')grid=Array.from({length:GRID},(_,r)=>Array.from({length:GRID},(_,c)=>(r+c)%6+1));
    pieces=[piece((kind==='combo'||kind==='surge')?[[0,0],[0,1],[1,0],[1,1]]:[[0,0],[0,1]],2),piece([[0,0],[1,0],[2,0]],0),piece([[0,0],[1,0],[1,1]],4)];
    bombCount=kind==='bomb'?1:3;_invBombsInPlay=bombCount;
    if(typeof _setScoreImmediate==='function')_setScoreImmediate(score);
    else {_scoreDispVal=score;document.getElementById('scoreDisplay').textContent=score.toLocaleString();}
    document.getElementById('comboDisplay').textContent=String(Math.min(combo+1,5));
    updateBombBar();updateColorBlastBtn();_lastMoveAt=performance.now();
    if(kind==='bomb')checkDead();
    draw();
  }
  let busyUntil=0;
  window.tiliqPreview={
    run(kind){
      if(performance.now()<busyUntil)return;
      _unlockSkyMusic();
      if(kind==='home'){hide();backToMenu();return;}
      if(kind==='settings'){hide();showModal('settings');return;}
      if(kind==='missions'){hide();showMissions();return;}
      if(kind==='daily'){hide();showModal('daily');return;}
      if(kind==='profile'){hide();showModal('account');return;}
      if(kind==='store'){hide();showTmStoreModal();setStoreTab('power');return;}
      if(kind==='ranking'){hide();toggleLB();return;}
      if(kind==='friends'){hide();toggleLB();showModal('add-friend');return;}
      if(kind==='rewards'){
        hide();backToMenu();
        saveSkyMissionState({date:todayStr(),combos:5,rows:5,score:0,claimed:{}});
        localStorage.removeItem('tm_treasure_date');renderDailyCard();return;
      }
      if(kind==='over'){fixture('board');dead=true;showOver();return;}
      if(kind==='play'){hide();setInvBombs(3);setColorBlast(3);startNewGame();return;}
      fixture(kind);
      if(kind==='line'||kind==='combo'||kind==='surge'){
        selPiece=0;hov={row:kind==='line'?6:5,col:6};
        draw();
        // A real pointer gesture can play it; this button also demonstrates the same placement.
      }
    },
    place(){
      _unlockSkyMusic();
      if(selPiece!==null&&hov&&!dead){busyUntil=performance.now()+850;place(selPiece,hov.row,hov.col);}
    },
    sound(name){_unlockSkyMusic();const a=getAC();if(a)a.resume().then(()=>({place:playTick,clear:()=>playPling(2,3),bomb:playBomb,color:playColorBlast,over:playOver}[name]?.()));},
    status:()=>({screen:document.querySelector('.screen.active')?.id,score,bombs:bombCount,combo,dead}),
  };
  applyLang();updateMenuAvatar();refreshKingdomHUD();hide();showScreen('menu');
  if(new URLSearchParams(location.search).get('scene'))window.tiliqPreview.run(new URLSearchParams(location.search).get('scene'));
  window.parent.postMessage({type:'tiliq-preview-ready'},location.origin);
})();
