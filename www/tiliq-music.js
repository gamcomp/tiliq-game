/* Tiliq müzik kütüphanesi (2026-10-14): 20 türde, Web Audio ile anlık sentezlenen parçalar.
   Dinleme sayfasıyla aynı besteler. Oyun, mevcut Sky Harbor müzik altyapısının (aç/kapa,
   seviye, kısma, arka planda durma) içinden attach/setTrack/run ile çağırır. */
'use strict';
const TiliqMusic=(()=>{
let A=null,G=null,cur=null,song=null,step=0,next=0;
const TRACKS=[
 {id:1,group:'calm',name:'Lo-fi Liman',genre:'Lo-fi hip hop',bpm:80,swing:.2,key:0,scale:'major',chords:['Dm9','G13','Cmaj9','Am7'],
  dk:{k:'lofi',s:'lofi'},d:{k:'x.........x..x..',s:'....x.......x...',h:'x.x.xgx.x.x.xgx.'},
  bass:{inst:'sub',pat:'R-----..R--.5-..'},comp:{inst:'ep',pat:'x-------....x---'},lead:{inst:'piano',dens:'sparse',lo:72,hi:86,legato:1.2},fx:['crackle'],wet:.2,seed:7,
  desc:'Tozlu davul, Rhodes akorları, plak cızırtısı. Rahat bir menü havası.'},
 {id:2,group:'calm',name:'Kalimba Ninnisi',genre:'Ambient kalimba',bpm:84,key:3,scale:'major',chords:['Ebmaj7','Cm7','Abmaj7','Bbsus4'],
  dk:{k:'soft'},d:{k:'x...............',sh:'x.x.x.x.x.x.x.x.'},
  bass:{inst:'sub',pat:'R---------------'},pad:{inst:'strings',lvl:.5},arp:{inst:'kalimba',rate:2,mode:'updown',oct:12},lead:{inst:'kalimba',dens:'sparse',lo:76,hi:91,legato:1.5},wet:.32,seed:19,
  desc:'Kalimba arpejleri ve yumuşak fon. En sakin, en dingin parça.'},
 {id:3,group:'calm',name:'Bossa Bulutu',genre:'Bossa nova',bpm:126,key:0,scale:'major',chords:['Dm9','G7','Cmaj7','A7b9'],
  dk:{k:'soft'},d:{k:'x..x....x..x....',cl:'x..x..x...x..x..',sh:'xgxgxgxgxgxgxgxg'},
  bass:{inst:'upright',pat:'R..5....R..5....'},comp:{inst:'nylon',pat:'x..x..x...x..x..',strum:.014},lead:{inst:'flute',dens:'medium',lo:69,hi:86,legato:1.1},wet:.18,seed:31,
  desc:'Naylon gitar, kontrbas, flüt ve clave. Brezilya sahili.'},
 {id:4,group:'calm',name:'Reggae Rüzgârı',genre:'Reggae',bpm:76,swing:.12,key:7,scale:'major',chords:['G','C','D','C'],
  dk:{k:'soft',s:'std'},d:{k:'........x.......',r:'........x.......',h:'x.x.x.x.x.x.x.x.'},
  bass:{inst:'sub',pat:'R-....R.5-..R...'},comp:{inst:'organ',pat:'..x-..x-..x-..x-'},lead:{inst:'flute',dens:'sparse',lo:71,hi:86,legato:1},wet:.16,seed:43,
  desc:'One-drop davul, ters vuruşta org. Ağır ve güneşli.'},
 {id:5,group:'calm',name:'Caz Kulübü',genre:'Swing caz',bpm:138,swing:.33,swing8:true,key:10,scale:'major',chords:['Cm7','F7','Bbmaj7','G7b9'],
  dk:{s:'brush'},d:{rd:'x...x.x.x...x.x.',h:'....x.......x...',s:'......g.......g.'},
  bass:{inst:'upright',pat:'R...3...5...w...'},comp:{inst:'piano',pat:'x.....x.........',lvl:.7},lead:{inst:'piano',dens:'medium',lo:70,hi:86,legato:.9},wet:.15,seed:59,
  desc:'Yürüyen kontrbas, ride zili, piyano. Gece kulübü havası.'},

 {id:6,group:'game',name:'Neon Zeplin',genre:'Synthwave',bpm:100,key:9,scale:'minor',chords:['Am','F','C','G'],
  dk:{k:'rock',s:'gated'},d:{k:'x.......x.......',s:'....x.......x...',h:'..x...x...x...x.'},
  bass:{inst:'saw',pat:'R.R.R.R.R.R.R.R.'},pad:{inst:'strings',lvl:.45},arp:{inst:'pluckbright',rate:1,mode:'up',oct:12,lvl:.45},lead:{inst:'sawlead',dens:'medium',lo:64,hi:84,legato:1},wet:.26,seed:67,
  desc:'80\'ler: synth bas, yankılı trampet, neon lead.'},
 {id:7,group:'game',name:'Tropik Ada',genre:'Tropical house',bpm:106,key:5,scale:'major',chords:['Dm7','Bbmaj7','F','C'],sc:true,
  dk:{k:'house'},d:{k:'x...x...x...x...',c:'....x.......x...',h:'..x...x...x...x.',sh:'xgxgxgxgxgxgxgxg'},
  bass:{inst:'sub',pat:'R.....R...R...5.'},comp:{inst:'piano',pat:'..x...x...x...x.',lvl:.8},lead:{inst:'marimba',dens:'syncop',lo:72,hi:88,legato:.8},wet:.2,seed:71,
  desc:'Marimba melodisi, pompalayan akorlar. Yaz plajı.'},
 {id:8,group:'game',name:'Funky Pervane',genre:'Funk',bpm:110,swing:.08,key:4,scale:'dorian',chords:['Em7','A9','Em7','A9'],
  dk:{k:'house',s:'std'},d:{k:'x.....x...x.....',s:'....x..g....x..g',h:'xxxxxxxxxxxxxxxx'},
  bass:{inst:'slap',pat:'R..r..R.5..rR.7.'},comp:{inst:'pluckbright',pat:'.x.x..x..x.x..x.',len:.5},lead:{inst:'brass',dens:'syncop',lo:64,hi:80,legato:.45},wet:.1,seed:83,
  desc:'Slap bas, funk gitar, brass vuruşları. Zıplatan groove.'},
 {id:9,group:'game',name:'Şehir Işıkları',genre:'City pop',bpm:108,key:0,scale:'major',chords:['Fmaj7','Em7','Dm7','Cmaj7'],
  dk:{k:'house',s:'std'},d:{k:'x...x...x...x...',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.',o:'..x...x...x...x.'},
  bass:{inst:'slap',pat:'R.r.R.r.R.r.R.r.'},comp:{inst:'ep',pat:'x..x..x...x.....'},lead:{inst:'sawlead',dens:'medium',lo:69,hi:86,legato:.9,lvl:.75},wet:.2,seed:97,
  desc:'80\'ler Japon city pop: Rhodes, disko hi-hat, oktav bas.'},
 {id:10,group:'game',name:'Steel Pan Plajı',genre:'Calypso',bpm:116,key:5,scale:'major',chords:['F','Bb','C','F'],
  dk:{k:'soft'},d:{k:'x...x...x...x...',cg:'..x..x.X..x..xX.',sh:'xxxxxxxxxxxxxxxx',cl:'x..x..x...x.x...'},
  bass:{inst:'sub',pat:'R..R..5.R..R..5.'},comp:{inst:'nylon',pat:'..x...x...x...x.',len:.4},lead:{inst:'steel',dens:'busy',lo:70,hi:89,legato:.9},wet:.15,seed:101,
  desc:'Steel pan, conga ve clave. Karayip festivali.'},
 {id:11,group:'game',name:'Reggaeton Ritmi',genre:'Reggaeton',bpm:94,key:2,scale:'major',chords:['Bm','G','D','A'],
  dk:{k:'house',s:'std'},d:{k:'x...x...x...x...',s:'...x..x....x..x.',h:'x.x.x.x.x.x.x.x.'},
  bass:{inst:'sub',pat:'R...R...R...R...'},comp:{inst:'pluckbright',pat:'..x..x..x..x..x.',len:.6},lead:{inst:'sawlead',dens:'syncop',lo:71,hi:86,legato:.8,lvl:.7},wet:.15,seed:113,
  desc:'Dembow ritmi, derin bas, synth pluck.'},
 {id:12,group:'game',name:'Afrobeat Güneşi',genre:'Afrobeats',bpm:104,key:7,scale:'major',chords:['Am7','D','Gmaj7','Em7'],
  dk:{k:'soft',s:'std'},d:{k:'x...x...x...x...',r:'..x..x....x..x..',sh:'x.xxx.xxx.xxx.xx',cg:'.......x..x.X...',s:'....g.......g...'},
  bass:{inst:'log',pat:'R..R..5...R.....'},comp:{inst:'pluckbright',pat:'.x.x.xx..x.x.xx.',len:.4,lvl:.7},lead:{inst:'marimba',dens:'syncop',lo:72,hi:88,legato:.8},wet:.15,seed:127,
  desc:'Log drum bas, shaker, highlife gitar. Sıcak ve dans ettiren.'},
 {id:13,group:'game',name:'Doğu Pop',genre:'Türk pop',bpm:100,key:2,scale:'hicaz',chords:['D','Gm','Cm','D'],
  dk:{k:'house'},d:{k:'x.....x...x.....',c:'....x.......x...',cg:'x.xxX.x.x.xx..X.'},
  bass:{inst:'saw',pat:'R...R.R.R...R.R.'},pad:{inst:'strings',lvl:.45},lead:{inst:'sawlead',dens:'medium',lo:69,hi:86,legato:1,vib:2},wet:.2,seed:131,
  desc:'Hicaz makamında synth melodi, darbuka ritmi. 90\'lar Türk popu.'},

 {id:14,group:'energy',name:'8-Bit Kargo',genre:'Chiptune',bpm:150,key:0,scale:'major',chords:['C','Am','F','G'],
  dk:{k:'chip',s:'chip',h:'chip'},d:{k:'x.......x.......',s:'....x.......x...',h:'x.x.x.x.x.x.x.x.'},
  bass:{inst:'tri',pat:'R.r.R.r.R.r.R.r.'},arp:{inst:'square',rate:1,mode:'up',oct:12,lvl:.35},lead:{inst:'square',dens:'chip',lo:72,hi:88,legato:.85},wet:.05,seed:139,
  desc:'Retro konsol sesi: kare dalga, üçgen bas, gürültü davul.'},
 {id:15,group:'energy',name:'Future Gökyüzü',genre:'Future bass',bpm:150,key:7,scale:'major',chords:['Em7','Cmaj7','G','D'],sc:true,
  dk:{k:'house',s:'std'},d:{k:'x.........x.....',s:'........X.......',h:'x.x.x.x.x.xrx.x.'},
  bass:{inst:'sub',pat:'R---------R-----'},comp:{inst:'supersaw',pat:'x-x-x--x-x-x--x-',lvl:.8},lead:{inst:'square',dens:'syncop',lo:74,hi:90,legato:.5,lvl:.7},wet:.26,seed:149,
  desc:'Pompalayan supersaw akorlar, trap hi-hat. Yükselen enerji.'},
 {id:16,group:'energy',name:'Trap Kulesi',genre:'Trap',bpm:140,key:0,scale:'minor',chords:['Cm','Ab','Eb','Bb'],
  dk:{k:'808',s:'std'},d:{k:'x......x..x.....',s:'........X.......',h:'x.x.x.xrx.x.x.rr'},
  bass:{inst:'808',pat:'R------R--R-----'},pad:{inst:'strings',lvl:.35},lead:{inst:'pluckbright',dens:'syncop',lo:72,hi:87,legato:.7},wet:.2,seed:151,
  desc:'808 bas, hızlı hi-hat ruloları, karanlık melodi.'},
 {id:17,group:'energy',name:'Arcade Turbo',genre:'Eurodance',bpm:130,key:9,scale:'minor',chords:['Am','F','C','G'],sc:true,
  dk:{k:'house',s:'std'},d:{k:'x...x...x...x...',c:'....x.......x...',o:'..x...x...x...x.',cr:'x...............................................................'},
  bass:{inst:'saw',pat:'..R...R...R...R.'},pad:{inst:'supersaw',lvl:.5},lead:{inst:'sawlead',dens:'busy',lo:69,hi:88,legato:.8},wet:.2,seed:157,
  desc:'Dört vuruş kick, supersaw, 90\'lar dans pisti.'},
 {id:18,group:'energy',name:'Liquid Uçuş',genre:'Drum & bass',bpm:172,key:5,scale:'minor',chords:['Fm9','Dbmaj7','Ab','Eb'],
  dk:{k:'house',s:'std'},d:{k:'x.........x.....',s:'....x.......x...',h:'x.xxx.xxx.xxx.x.'},
  bass:{inst:'sub',pat:'R-------R-----5-'},pad:{inst:'strings',lvl:.45},comp:{inst:'ep',pat:'x-------x-------',lvl:.7},lead:{inst:'piano',dens:'sparse',lo:72,hi:89,legato:1.2},wet:.26,seed:163,
  desc:'Hızlı kırık ritim, Rhodes, akışkan fon.'},
 {id:19,group:'energy',name:'Epik Filo',genre:'Orkestral',bpm:96,key:2,scale:'minor',chords:['Dm','Bb','F','C'],
  dk:{s:'std'},d:{t:'X.....x.x.......',s:'....g.......g.gg',cr:'x...............................................................'},
  bass:{inst:'saw',pat:'R-------R-------',lvl:.7},pad:{inst:'strings',lvl:.6},arp:{inst:'strings',rate:1,mode:'pedal',oct:0,lvl:.5},comp:{inst:'brass',pat:'x-------x-----x-',lvl:.6},lead:{inst:'brass',dens:'medium',lo:62,hi:79,legato:1},wet:.3,seed:173,
  desc:'Yaylı ostinato, brass ve timpani. Film müziği gibi.'},
 {id:20,group:'energy',name:'Kelt Rotası',genre:'Kelt jig (6/8)',bpm:116,steps:12,key:2,scale:'mixo',chords:['D','C','G','D'],
  dk:{k:'soft'},d:{t:'X..x..X..x.x',sh:'x.xx.xx.xx.x'},
  bass:{inst:'upright',pat:'R.....5.....'},comp:{inst:'nylon',pat:'x..x..x..x..',strum:.012,len:.8},lead:{inst:'flute',dens:'sixeight',lo:74,hi:91,legato:.95},wet:.2,seed:181,
  desc:'İrlanda flütü, gitar, bodhrán davulu. Hızlı ve neşeli.'}
];
const SC={major:[0,2,4,5,7,9,11],minor:[0,2,3,5,7,8,10],dorian:[0,2,3,5,7,9,10],mixo:[0,2,4,5,7,9,10],hicaz:[0,1,4,5,7,8,10]};
const NOTE={C:0,'C#':1,Db:1,D:2,'D#':3,Eb:3,E:4,F:5,'F#':6,Gb:6,G:7,'G#':8,Ab:8,A:9,'A#':10,Bb:10,B:11};
const QUAL={'':[0,4,7],m:[0,3,7],'7':[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],m9:[0,3,7,10,14],maj9:[0,4,7,11,14],'9':[0,4,7,10,14],'13':[0,4,10,14,21],'7b9':[0,4,7,10,13],sus4:[0,5,7,10]};
function chord(sym){
  const m=sym.match(/^([A-G][#b]?)(.*)$/),pc=NOTE[m[1]],iv=QUAL[m[2]];
  const root=48+pc;let notes=iv.map(i=>root+i);
  notes=notes.map(n=>n>76?n-12:n).sort((a,b)=>a-b).filter((n,i,a)=>a.indexOf(n)===i);
  return{pc,iv,notes,tones:iv.map(i=>(pc+i)%12)};
}
function rng(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const POOLS={
 sparse:['x.......x.......','x.....x.........','x...........x...','x.......x...x...'],
 medium:['x...x...x...x...','x..x..x...x.....','x...x.x...x.....','x.x...x.x.......'],
 busy:['x.x.x.x.x.x.x.x.','x..x..x.x..x..x.','x.x.x.x.x.x.x...','x.x..x.xx.x.x...'],
 syncop:['..x..x..x...x...','x..x..x..x..x...','.x.x..x..x.x....','x..x...x..x.x...'],
 chip:['x.xxx.x.x.xxx.x.','xxx.x.x.xxx.x.x.','x.x.xxx.x.x.xx..','xx.xx.x.xx.x.x..'],
 sixeight:['x.xx.xx.xx.x','x..x..x..x..','x.xx..x.xx..','xxx.x.xxx.x.']};
function build(tr){
  const r=rng(tr.seed),spb=tr.steps||16,ch=tr.chords.map(chord),L=tr.lead;
  const song={spb,ch,bars:8};
  if(!L)return song;
  const scale=SC[tr.scale],lo=L.lo,hi=L.hi,mel=[];
  for(let n=lo-12;n<=hi+12;n++)if(scale.some(s=>(tr.key+s)%12===n%12))mel.push(n);
  const near=p=>{let bi=0;mel.forEach((n,i)=>{if(Math.abs(n-p)<Math.abs(mel[bi]-p))bi=i;});return bi;};
  const tone=(p,bar,rootOnly,dir)=>{const c=ch[bar%ch.length],pcs=rootOnly?[c.pc]:c.tones.slice(0,3);let best=null,any=null;
    for(let n=lo;n<=hi;n++){if(!pcs.includes(n%12))continue;if(any===null||Math.abs(n-p)<Math.abs(any-p))any=n;
      if(dir&&(n-p)*dir>0&&(best===null||Math.abs(n-p)<Math.abs(best-p)))best=n;}return best??any;};
  const pool=POOLS[L.dens];
  const motif=dir=>{const pat=pool[Math.floor(r()*pool.length)];return{pat,dir,deltas:[...pat].map(()=>[1,1,2,2,3,-1,1,2,-1,0][Math.floor(r()*10)]*dir)};};
  const d0=r()<.5?1:-1,A=motif(d0),B=motif(-d0),C=motif(r()<.5?1:-1),D=motif(-d0);
  const plan=[A,B,A,B,C,D,A,null],half=spb/2;
  let p=Math.round((lo+hi)/2);const on=[];
  plan.forEach((m,bar)=>{
    if(!m){p=tone(p,bar,true,0);on.push({step:bar*spb,n:p});return;}
    [...m.pat].forEach((c,s)=>{
      if(c!=='x')return;
      if(s===0||s===half)p=tone(p,bar,false,s===0?m.dir:0);
      else{let i=near(p)+m.deltas[s];if(i<0||mel[i]<lo)i=near(p)+Math.abs(m.deltas[s]);if(i>=mel.length||mel[i]>hi)i=near(p)-Math.abs(m.deltas[s]);p=mel[Math.max(0,Math.min(mel.length-1,i))];}
      on.push({step:bar*spb+s,n:p});
    });
  });
  const total=spb*8;song.melody=new Array(total).fill(null);
  on.forEach((o,i)=>{const nx=i+1<on.length?on[i+1].step:total+on[0].step;song.melody[o.step]={n:o.n,d:Math.max(.8,(nx-o.step)*(L.legato||.9))};});
  return song;
}
// Desen dizisinden olay listesi: her 'x' için süre (arkasındaki '-' sayısı kadar uzar)
function events(pat){const out=[];for(let i=0;i<pat.length;i++){const c=pat[i];if(c==='.'||c==='-')continue;let len=1;while(pat[i+len]==='-')len++;out[i]={c,len};}return out;}
const hz=n=>440*Math.pow(2,(n-69)/12);
// Parça başına ses dengesi (ölçülen RMS seviyelerine göre)
const TRIM={16:.3,2:.7,15:.7,18:.7,1:.8,5:1.45,12:1.45,6:1.35,11:1.25,8:1.2,13:1.2,7:1.15,4:1.1};
function route(node,pan,bus){let n=node;if(pan&&A.createStereoPanner){const p=A.createStereoPanner();p.pan.value=Math.max(-1,Math.min(1,pan));node.connect(p);n=p;}n.connect(bus);}
function osc(type,f,at,end){const o=A.createOscillator();if(typeof type==='string')o.type=type;else o.setPeriodicWave(type);o.frequency.value=f;o.start(at);o.stop(end);return o;}
function gain(v){const g=A.createGain();g.gain.value=v;return g;}
function filt(type,f,q){const b=A.createBiquadFilter();b.type=type;b.frequency.value=f;if(q!==undefined)b.Q.value=q;return b;}
// Sürekli sesler için zarf: atak → sustain → bırakma
function sus(g,at,att,peak,dur,rel,s){g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(peak,at+att);if(s!==undefined&&s<1)g.gain.setTargetAtTime(peak*s,at+att,.25);g.gain.setTargetAtTime(0,at+Math.max(att,dur),rel/3);}
function hit(g,at,peak,dec){g.gain.setValueAtTime(peak,at);g.gain.exponentialRampToValueAtTime(.0001,at+dec);}
function noiseSrc(at,end){const s=A.createBufferSource();s.buffer=G.noise;s.start(at,Math.random()*1.5);s.stop(end);return s;}
function vibrato(o,f,at,depth,delay,end){const l=osc('sine',5.5,at,end),g=A.createGain();g.gain.setValueAtTime(0,at);g.gain.linearRampToValueAtTime(f*depth,at+delay);l.connect(g);g.connect(o.frequency);return l;}

// ── Melodik enstrümanlar (n, at, dur, lvl, pan, bus) ──
const INST={
 ep(n,at,dur,l,pan,bus){const f=hz(n),end=at+dur+.6,c=osc('sine',f,at,end),m=osc('sine',f,at,end),mg=A.createGain(),a=A.createGain(),lp=filt('lowpass',3200),t=osc('sine',f*4,at,at+.3),tg=A.createGain();
   mg.gain.setValueAtTime(f*1.6,at);mg.gain.setTargetAtTime(f*.15,at,.18);m.connect(mg);mg.connect(c.frequency);
   sus(a,at,.006,l,dur,.5,.35);const tr=osc('sine',4.8,at,end),tgn=gain(l*.12);tr.connect(tgn);tgn.connect(a.gain);
   hit(tg,at,l*.1,.22);t.connect(tg);tg.connect(lp);c.connect(a);a.connect(lp);route(lp,pan,bus);},
 piano(n,at,dur,l,pan,bus){const f=hz(n),lp=filt('lowpass',Math.min(7000,1800+n*45)),ring=Math.min(2.6,dur+.5);
   [1,.42,.26,.15,.09,.05].forEach((a,i)=>{const k=i+1,o=osc('sine',f*k*(1+.0004*k*k),at,at+ring+.1),g=A.createGain();hit(g,at,l*a,ring/(1+i*.45));o.connect(g);g.connect(lp);});
   const h=noiseSrc(at,at+.03),hg=A.createGain(),bp=filt('bandpass',2500,1);hit(hg,at,l*.12,.02);h.connect(bp);bp.connect(hg);hg.connect(lp);route(lp,pan,bus);},
 organ(n,at,dur,l,pan,bus){const f=hz(n),end=at+dur+.15,a=A.createGain();sus(a,at,.01,l,dur,.08);
   [[.5,.45],[1,1],[2,.55],[3,.25],[4,.18]].forEach(([k,v])=>{const o=osc('sine',f*k,at,end),g=gain(v*.32);o.connect(g);g.connect(a);});route(a,pan,bus);},
 supersaw(n,at,dur,l,pan,bus){const f=hz(n),end=at+dur+.3,a=A.createGain(),lp=filt('lowpass',3400,.6);sus(a,at,.015,l,dur,.22,.85);
   [-17,-8,0,8,17].forEach(dt=>{const o=osc('sawtooth',f,at,end);o.detune.value=dt;const g=gain(.2);o.connect(g);g.connect(lp);});lp.connect(a);route(a,pan,bus);},
 strings(n,at,dur,l,pan,bus){const f=hz(n),end=at+dur+.6,a=A.createGain(),lp=filt('lowpass',1700,.5);sus(a,at,Math.min(.25,dur*.4),l,dur,.45);
   [-9,0,9].forEach(dt=>{const o=osc('sawtooth',f,at,end);o.detune.value=dt;const g=gain(.3);o.connect(g);g.connect(lp);});lp.connect(a);route(a,pan,bus);},
 brass(n,at,dur,l,pan,bus){const f=hz(n),end=at+dur+.25,a=A.createGain(),lp=filt('lowpass',500,1.5);sus(a,at,.03,l,dur,.14,.8);
   lp.frequency.setValueAtTime(500,at);lp.frequency.linearRampToValueAtTime(2900,at+.06);lp.frequency.setTargetAtTime(1300,at+.06,.18);
   [-5,5].forEach(dt=>{const o=osc('sawtooth',f,at,end);o.detune.value=dt;o.connect(lp);});lp.connect(a);route(a,pan,bus);},
 sawlead(n,at,dur,l,pan,bus,opt){const f=hz(n),end=at+dur+.2,a=A.createGain(),lp=filt('lowpass',3600,.8);sus(a,at,.01,l,dur,.12,.8);
   const vd=.006*((opt&&opt.vib)||1);[-7,7].forEach(dt=>{const o=osc('sawtooth',f,at,end);o.detune.value=dt;vibrato(o,f,at,vd,.22,end);const g=gain(.45);o.connect(g);g.connect(lp);});
   const s=osc('square',f/2,at,end),sg=gain(.12);s.connect(sg);sg.connect(lp);lp.connect(a);route(a,pan,bus);},
 square(n,at,dur,l,pan,bus){const f=hz(n),end=at+dur+.05,a=A.createGain(),o=osc(G.pulse25,f,at,end);vibrato(o,f,at,.009,.18,end);sus(a,at,.003,l*.6,dur,.03);o.connect(a);route(a,pan,bus);},
 marimba(n,at,dur,l,pan,bus){const f=hz(n),a=A.createGain();[[1,1,.5],[4,.35,.07],[9.9,.1,.02]].forEach(([k,v,d])=>{const o=osc('sine',f*k,at,at+d+.05),g=A.createGain();hit(g,at,l*v,d);o.connect(g);g.connect(a);});route(a,pan,bus);},
 steel(n,at,dur,l,pan,bus){const f=hz(n),a=A.createGain();[[1,1,.9],[2,.55,.6],[3,.28,.4],[4.07,.16,.3]].forEach(([k,v,d])=>{const o=osc('sine',f*k*1.012,at,at+d+.05),g=A.createGain();o.frequency.setTargetAtTime(f*k,at,.02);hit(g,at,l*v,d);o.connect(g);g.connect(a);});route(a,pan,bus);},
 kalimba(n,at,dur,l,pan,bus){const f=hz(n),a=A.createGain();[[1,1,1.4],[5.95,.3,.09]].forEach(([k,v,d])=>{const o=osc('sine',f*k,at,at+d+.05),g=A.createGain();hit(g,at,l*v,d);o.connect(g);g.connect(a);});route(a,pan,bus);},
 flute(n,at,dur,l,pan,bus){const f=hz(n),end=at+dur+.2,a=A.createGain(),o=osc('sine',f,at,end),o2=osc('triangle',f*2,at,end),g2=gain(.08),lp=filt('lowpass',3800);
   vibrato(o,f,at,.006,.25,end);sus(a,at,.07,l,dur,.12,.85);o.connect(lp);o2.connect(g2);g2.connect(lp);lp.connect(a);
   const b=noiseSrc(at,end),bp=filt('bandpass',f*2,1.5),bg=A.createGain();sus(bg,at,.04,l*.22,dur,.1,.4);b.connect(bp);bp.connect(bg);bg.connect(a);route(a,pan,bus);},
 pluck(n,at,dur,l,pan,bus,opt){const b=ks(n),s=A.createBufferSource(),lp=filt('lowpass',opt&&opt.bright?6500:3200,opt&&opt.bright?1:.4),g=A.createGain();s.buffer=b;
   hit(g,at,l*1.4,Math.min(b.duration,Math.max(.25,dur)));s.connect(lp);lp.connect(g);route(g,pan,bus);s.start(at);s.stop(at+Math.min(b.duration,dur+.1));},
 pluckbright(n,at,dur,l,pan,bus){INST.pluck(n,at,dur,l,pan,bus,{bright:true});},
 nylon(n,at,dur,l,pan,bus){INST.pluck(n,at,Math.max(dur,.6),l*.9,pan,bus);}
};
function ks(note){
  if(G.ks.has(note))return G.ks.get(note);
  const len=Math.floor(A.sampleRate*2),b=A.createBuffer(1,len,A.sampleRate),d=b.getChannelData(0),dl=Math.max(2,Math.round(A.sampleRate/hz(note)));let sm=0;
  for(let i=0;i<dl&&i<len;i++){sm=sm*.4+(Math.random()*2-1)*.6;d[i]=sm;}
  for(let i=dl;i<len;i++){const pv=i-dl;d[i]=(d[pv]+d[Math.min(pv+1,i-1)])*.497;}
  G.ks.set(note,b);return b;
}
// ── Baslar ──
const BASS={
 sub(n,at,dur,l){const o=osc('sine',hz(n),at,at+dur+.15),a=A.createGain();sus(a,at,.012,l*1.1,dur,.08);o.connect(a);a.connect(G.drum);},
 saw(n,at,dur,l){const f=hz(n),o=osc('sawtooth',f,at,at+dur+.1),lp=filt('lowpass',2200,2),a=A.createGain();lp.frequency.setValueAtTime(2200,at);lp.frequency.setTargetAtTime(500,at,.08);
   sus(a,at,.004,l*.55,dur,.06,.8);const s=osc('sine',f,at,at+dur+.1),sg=gain(.5);s.connect(sg);sg.connect(a);o.connect(lp);lp.connect(a);a.connect(G.drum);},
 slap(n,at,dur,l){const f=hz(n),o=osc('sawtooth',f,at,at+dur+.1),lp=filt('lowpass',3600,3),a=A.createGain();lp.frequency.setValueAtTime(3600,at);lp.frequency.setTargetAtTime(420,at,.05);
   sus(a,at,.002,l*.6,Math.min(dur,.35),.05,.6);const s=osc('sine',f,at,at+dur+.1),sg=gain(.6);s.connect(sg);sg.connect(a);o.connect(lp);lp.connect(a);a.connect(G.drum);},
 tri(n,at,dur,l){const o=osc('triangle',hz(n+12),at,at+dur+.05),a=A.createGain();sus(a,at,.003,l,dur*.9,.02);o.connect(a);a.connect(G.drum);},
 upright(n,at,dur,l){const f=hz(n),b=ks(n+12),s=A.createBufferSource(),lp=filt('lowpass',900),g=A.createGain();s.buffer=b;s.playbackRate.value=.5;hit(g,at,l*1.6,Math.min(1.2,dur+.4));
   s.connect(lp);lp.connect(g);g.connect(G.drum);s.start(at);s.stop(at+1.5);const o=osc('sine',f,at,at+dur+.3),og=A.createGain();hit(og,at,l*.7,dur+.25);o.connect(og);og.connect(G.drum);},
 '808'(n,at,dur,l,next){const f=hz(n),end=at+Math.max(.6,dur)+.1,o=osc('sine',f*1.9,at,end),a=A.createGain();o.frequency.setValueAtTime(f*1.9,at);o.frequency.exponentialRampToValueAtTime(f,at+.04);
   if(next&&next!==n)o.frequency.setTargetAtTime(hz(next),at+Math.max(.05,dur-.12),.04);
   a.gain.setValueAtTime(l*1.3,at);a.gain.setTargetAtTime(0,at+Math.max(.2,dur-.05),.08);o.connect(a);a.connect(G.shaper);},
 log(n,at,dur,l){const f=hz(n+12),o=osc('sine',f*1.7,at,at+.6),a=A.createGain();o.frequency.setValueAtTime(f*1.7,at);o.frequency.exponentialRampToValueAtTime(f,at+.035);hit(a,at,l*1.1,.45);
   const o2=osc('sine',f*2,at,at+.3),a2=A.createGain();hit(a2,at,l*.25,.15);o2.connect(a2);a2.connect(G.drum);o.connect(a);a.connect(G.drum);}
};
// ── Davullar ──
function nz(at,dec,peak,type,f,q,bus,pan){const s=noiseSrc(at,at+dec+.05),bq=filt(type,f,q),g=A.createGain();hit(g,at,peak,dec);s.connect(bq);bq.connect(g);route(g,pan||0,bus||G.drum);}
function tone(at,f0,f1,t,dec,peak,type,bus){const o=osc(type||'sine',f0,at,at+dec+.05),g=A.createGain();o.frequency.setValueAtTime(f0,at);o.frequency.exponentialRampToValueAtTime(f1,at+t);hit(g,at,peak,dec);o.connect(g);g.connect(bus||G.drum);}
const DRUM={
 k(at,v,kind){const K={house:[150,48,.07,.38,1],soft:[110,46,.08,.3,.8],lofi:[95,44,.09,.3,.9],'808':[140,42,.06,.55,1.15],chip:[200,40,.05,.12,.8],rock:[130,50,.06,.32,1]}[kind||'house'];
   tone(at,K[0],K[1],K[2],K[3],.55*K[4]*v);if(kind==='house'||kind==='rock')nz(at,.012,.25*v,'highpass',2000);if(G.sc)pump(at);},
 s(at,v,kind){if(kind==='chip'){nz(at,.08,.3*v,'bandpass',3200,.8);return;}
   if(kind==='brush'){nz(at,.22,.16*v,'lowpass',6000,.5);return;}
   const dec=kind==='gated'?.24:kind==='lofi'?.13:.16,f=kind==='lofi'?3200:9000;
   nz(at,dec,(kind==='gated'?.45:.32)*v,'lowpass',f,.3,kind==='gated'?G.music:G.drum);nz(at,dec*.8,.16*v,'highpass',1500);tone(at,200,170,.05,.08,.22*v,'triangle');},
 c(at,v){for(let k=0;k<3;k++){const t=at+k*.011,last=k===2;nz(t,last?.14:.03,.28*v,'bandpass',1400,.8,G.drum,(k-1)*.15);}},
 h(at,v,kind){nz(at,.035,.13*v,'highpass',kind==='chip'?4500:7800,.5,G.drum,.18);},
 o(at,v){nz(at,.22,.1*v,'highpass',7400,.5,G.drum,-.18);},
 r(at,v){tone(at,1750,1600,.01,.03,.12*v);tone(at,480,460,.01,.04,.1*v,'triangle');},
 cl(at,v){tone(at,2500,2450,.01,.06,.16*v,'sine',G.drum);},
 sh(at,v){nz(at,.06,.07*v,'bandpass',6500,1.5,G.drum,.25);},
 cg(at,v){const hi=v>1.2;tone(at,hi?330:220,hi?310:200,.03,.22,.24*Math.min(v,1.1));},
 t(at,v){tone(at,74,62,.2,1.1,.42*v);nz(at,.3,.12*v,'lowpass',300,.5);},
 rd(at,v){nz(at,.45,.05*v,'highpass',6000,.4,G.drum,.3);tone(at,3150,3100,.1,.45,.03*v);tone(at,4870,4800,.1,.35,.02*v);},
 cr(at,v){nz(at,1.8,.09*v,'highpass',4500,.3,G.music,0);}
};
function pump(at){const g=G.pump.gain,beat=60/cur.bpm;g.cancelScheduledValues(at);g.setValueAtTime(.25,at);g.linearRampToValueAtTime(1,at+beat*.5);}

const LVL={ep:.16,piano:.17,organ:.1,supersaw:.07,strings:.06,brass:.09,sawlead:.08,square:.1,marimba:.2,steel:.16,kalimba:.18,flute:.14,pluck:.11,pluckbright:.11,nylon:.11};
function bassNote(tr,c,ch,bar){const root=36+ch.pc;switch(c){case'r':return root+12;case'5':return root+7;case'3':return root+ch.iv[1];case'7':return root+(ch.iv.find(i=>i===10||i===11)||12);
  case'w':{const nx=36+tr.chords.map(chord)[(bar+1)%tr.chords.length].pc;return nx-1;}default:return root;}}
function stepAt(tr,song,st,at){
  const spb=song.spb,s=st%spb,bar=Math.floor(st/spb),ch=song.ch[bar%song.ch.length],sd=60/tr.bpm/(spb===12?3:4);
  if(tr.swing){if(tr.swing8?s%4===2:s%2===1)at+=tr.swing*(tr.swing8?2:1)*sd;}
  // davul
  for(const[k,pat]of Object.entries(tr.d||{})){
    const c=pat[st%pat.length];if(!c||c==='.')continue;
    const v=c==='X'?1.4:c==='g'?.4:1,kind=(tr.dk||{})[k];
    if(c==='r'){for(let i=0;i<3;i++)DRUM[k](at+i*sd/3,.6,kind);}else DRUM[k](at,v,kind);
  }
  // bas
  if(tr.bass){const e=song.ev.bass[s%tr.bass.pat.length];if(e){const n=bassNote(tr,e.c,ch,bar);let nx=null;
    if(tr.bass.inst==='808'){for(let j=1;j<=spb;j++){const e2=song.ev.bass[(s+j)%tr.bass.pat.length];if(e2){nx=bassNote(tr,e2.c,song.ch[(bar+(s+j>=spb?1:0))%song.ch.length],bar);break;}}}
    BASS[tr.bass.inst](n,at,e.len*sd,(tr.bass.lvl||1)*.32,nx);}}
  // pad
  if(tr.pad&&s===0){ch.notes.forEach((n,i)=>INST[tr.pad.inst](n,at,spb*sd*.98,LVL[tr.pad.inst]*(tr.pad.lvl||1)*.7,(i-1.5)*.25,tr.sc?G.pump:G.music));}
  // akor vuruşları
  if(tr.comp){const e=song.ev.comp[s%tr.comp.pat.length];if(e){const len=e.len*sd*(tr.comp.len||1);
    ch.notes.forEach((n,i)=>INST[tr.comp.inst](n,at+(tr.comp.strum||0)*i,len,LVL[tr.comp.inst]*(tr.comp.lvl||1)*.75,(i-1.5)*.2,tr.sc?G.pump:G.music));}}
  // arpej
  if(tr.arp&&s%tr.arp.rate===0){const ns=ch.notes,k=Math.floor(s/tr.arp.rate);let n;
    if(tr.arp.mode==='updown'){const seq=ns.concat(ns.slice(1,-1).reverse());n=seq[k%seq.length];}
    else if(tr.arp.mode==='pedal'){n=k%2===0?ns[0]:ns[1+((k>>1)%(ns.length-1))];}
    else n=ns[k%ns.length];
    INST[tr.arp.inst](n+tr.arp.oct,at,sd*tr.arp.rate*1.1,LVL[tr.arp.inst]*(tr.arp.lvl||1),k%2?.3:-.3,tr.sc?G.pump:G.music);}
  // melodi
  if(song.melody){const m=song.melody[st%song.melody.length];if(m)INST[tr.lead.inst](m.n,at,m.d*sd,LVL[tr.lead.inst]*(tr.lead.lvl||1),(bar%2?.1:-.1),G.music,tr.lead);}
  // plak cızırtısı
  if(tr.fx&&tr.fx.includes('crackle')){const n=Math.random()<.5?1:Math.random()<.3?2:0;for(let i=0;i<n;i++)nz(at+Math.random()*sd,.003,.05+Math.random()*.05,'highpass',1800,.3,G.drum,Math.random()-.5);}
}
function attach(a,dest){
  if(G&&A===a)return;
  A=a;
  const music=A.createGain(),pump=A.createGain(),drum=A.createGain(),verb=A.createConvolver(),wet=A.createGain(),mix=A.createGain();
  const ir=A.createBuffer(2,Math.floor(A.sampleRate*1.8),A.sampleRate);
  for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,2.8);}
  verb.buffer=ir;
  pump.connect(music);music.connect(mix);music.connect(verb);verb.connect(wet);wet.connect(mix);drum.connect(mix);mix.connect(dest);
  const nb=A.createBuffer(1,A.sampleRate*2,A.sampleRate),nd=nb.getChannelData(0);for(let i=0;i<nd.length;i++)nd[i]=Math.random()*2-1;
  const pw=d=>{const n=48,re=new Float32Array(n),im=new Float32Array(n);for(let i=1;i<n;i++)re[i]=2/(i*Math.PI)*Math.sin(i*Math.PI*d);return A.createPeriodicWave(re,im);};
  const sh=A.createWaveShaper(),curve=new Float32Array(1024);for(let i=0;i<1024;i++){const x=i/511.5-1;curve[i]=Math.tanh(2.2*x);}sh.curve=curve;sh.connect(drum);
  G={music,pump,drum,wet,mix,noise:nb,pulse25:pw(.25),shaper:sh,ks:new Map()};
}
const songs=new Map();
function songOf(tr){if(!songs.has(tr.id)){const s=build(tr);s.ev={};['bass','comp'].forEach(k=>{if(tr[k])s.ev[k]=events(tr[k].pat);});songs.set(tr.id,s);}return songs.get(tr.id);}
// Oyun içi karışım: parça dengesi × genel seviye (eski Bulut Rotası ile aynı algılanan yükseklik)
const GAME_LEVEL=.35;
function setTrack(id){
  cur=TRACKS.find(t=>t.id===+id)||null;song=cur?songOf(cur):null;step=0;
  if(G&&cur){G.wet.gain.value=cur.wet||.15;G.sc=!!cur.sc;G.mix.gain.value=(TRIM[cur.id]||1)*GAME_LEVEL;G.pump.gain.cancelScheduledValues(0);G.pump.gain.value=1;}
}
function reset(t){next=t;}
function run(horizon){
  if(!G||!cur||!song)return;
  const sd=60/cur.bpm/(song.spb===12?3:4),total=song.spb*8;
  if(next<A.currentTime)next=A.currentTime+.04;
  while(next<horizon){stepAt(cur,song,step,next);next+=sd;step=(step+1)%total;}
}
return{TRACKS:TRACKS.map(t=>({id:t.id,name:t.name,genre:t.genre,bpm:t.bpm})),attach,setTrack,reset,run,current:()=>cur&&cur.id};
})();
