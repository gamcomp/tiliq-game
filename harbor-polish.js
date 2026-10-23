/* Sky Harbor: restrained scene motion and bounded, audio-clock scheduled Foley. */
'use strict';
const HarborMotion=(()=>{
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const low=(navigator.deviceMemory||4)<=2||(navigator.hardwareConcurrency||4)<=2;
  const arrivals=new WeakMap();
  const minimal=()=>low||reduced.matches;
  const sync=()=>{
    document.documentElement.classList.toggle('harbor-low-motion',minimal());
    document.documentElement.classList.toggle('harbor-paused',document.hidden);
  };
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  document.addEventListener('DOMContentLoaded',()=>{
    // .harbor-atmosphere bulut katmanı kaldırıldı (2026-10-24): menü görselinin altında kalıp
    // görünmüyordu ama 24 sn'lik sonsuz animasyonu sürekli çalışıp telefonu ısıtıyordu.
    sync();
  },{once:true});
  return {
    minimal,
    // One weak entry per piece: no perpetual emitter or idle animation loop.
    arrival(piece,now){
      if(!arrivals.has(piece))arrivals.set(piece,now);
      if(minimal())return 1;
      const p=Math.min(1,Math.max(0,(now-arrivals.get(piece))/240));
      return 1-Math.pow(1-p,3);
    },
  };
})();

const HarborSound = (() => {
  let graph = null;
  const voices = new Set();
  const MAX_VOICES = 24;
  function ensure(a) {
    if (graph?.a === a) return graph;
    const input = a.createGain(), compressor = a.createDynamicsCompressor(), master = a.createGain();
    compressor.threshold.value = -16; compressor.knee.value = 18; compressor.ratio.value = 4;
    compressor.attack.value = .003; compressor.release.value = .16;
    input.connect(compressor); compressor.connect(master); master.connect(a.destination);
    const noise = a.createBuffer(1, a.sampleRate, a.sampleRate), data = noise.getChannelData(0);
    let last = 0;
    for (let i=0;i<data.length;i++) { last = .35*last + .65*(Math.random()*2-1); data[i] = last; }
    graph = {a, input, master, noise};
    return graph;
  }
  function level(a, amount) {
    const g = ensure(a), now = a.currentTime;
    g.master.gain.cancelScheduledValues(now);
    g.master.gain.setTargetAtTime(Math.max(0, Math.min(1, amount)), now, .012);
  }
  function voice(g, freq, duration, volume, delay=0, type='sine', end=null, pan=0) {
    if (voices.size >= MAX_VOICES || document.hidden || g.a.state !== 'running' || volume<=0) return;
    const a=g.a, at=a.currentTime+.006+delay, source=freq==='noise'?a.createBufferSource():a.createOscillator();
    const env=a.createGain(), filter=a.createBiquadFilter();
    if(freq==='noise') {source.buffer=g.noise;filter.type='bandpass';filter.frequency.value=end||1800;filter.Q.value=.65;}
    else {source.type=type;source.frequency.setValueAtTime(freq,at);if(end)source.frequency.exponentialRampToValueAtTime(end,at+duration);filter.type='lowpass';filter.frequency.value=6500;}
    env.gain.setValueAtTime(0,at);env.gain.linearRampToValueAtTime(volume,at+.005);
    env.gain.exponentialRampToValueAtTime(.0001,at+duration);
    const panner=a.createStereoPanner?.();
    source.connect(filter);filter.connect(env);
    if(panner){panner.pan.value=pan;env.connect(panner);panner.connect(g.input);}else env.connect(g.input);
    voices.add(source);
    source.onended=()=>{voices.delete(source);source.disconnect();filter.disconnect();env.disconnect();panner?.disconnect();};
    source.start(at);source.stop(at+duration+.02);
  }
  function play(name, a, volume, n=1, combo=1) {
    if(!a || document.hidden || volume<=0)return;
    const g=ensure(a), v=Math.min(1,volume);
    const note=(f,d,l,delay=0,type='sine',end=null,pan=0)=>voice(g,f,d,l*v,delay,type,end,pan);
    // place/clear: playable reklamdaki sesler (2026-10-14, kullanıcı isteği) — tok yerleştirme
    // vuruşu ve komboyla yükselen üçgen dalga arpej.
    if(name==='place') {note(320,.08,.18,0,'triangle');note(110,.12,.22,0,'sine');}
    if(name==='tap') {note(540,.055,.055,0,'sine',390);}
    if(name==='clear') {
      const s=[523,659,784,988,1175,1319], up=Math.max(0,Math.min(2,combo-1));
      for(let i=0;i<Math.min(6,3+n);i++)note(s[Math.min(5,i+up)],.45,.09,i*.055,'triangle');
    }
    if(name==='chain') {
      const notes=[587.33,739.99,880,1174.66,1479.98], count=3;
      note('noise',.16,.11,0,'sine',2200);note(125,.2,.15,0,'sine',48);
      for(let i=0;i<count;i++){const f=notes[i]*(combo>=5?1.25:1);note(f,.34,.12,i*.045,'sine',null,(i-count/2)*.12);note(f*2,.16,.025,i*.045);}
    }
    if(name==='bomb') {note(115,.48,.3,0,'sine',34);note('noise',.42,.25,.015,'sine',680);note('noise',.2,.1,.12,'sine',2200);note(440,.24,.075,.04,'triangle',100);}
    if(name==='color') {note(390,.28,.1,0,'sine',1450);[740,988,1175,1480].forEach((f,i)=>note(f,.3,.08,.08+i*.045,'sine',null,(i-1.5)*.23));note('noise',.28,.09,0,'sine',3000);}
    if(name==='perfect') {[587.33,739.99,880,1174.66,1479.98].forEach((f,i)=>{note(f,.5,.13,i*.09);note(f/2,.3,.04,i*.09,'triangle');});note('noise',.35,.1,0,'sine',2400);}
    if(name==='over') {[392,329.63,261.63].forEach((f,i)=>note(f,.5,.1,i*.14,'triangle'));note(98,.6,.13);}
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const source of voices){try{source.stop();}catch{}}});
  return {play,level,synth:(a,f,d,v,type='sine',end=null)=>voice(ensure(a),f,d,v,0,type,end),output:a=>ensure(a).input,
    monitor:a=>ensure(a).master,stats:()=>({voices:voices.size,maxVoices:MAX_VOICES,noiseBytes:graph?.noise.length*4||0})};
})();

const HarborCombo = (() => {
  let burst=null;
  const tau=Math.PI*2;
  function framePoint(distance,x,y,s){
    const t=((distance%4)+4)%4;
    if(t<1)return[x+t*s,y];if(t<2)return[x+s,y+(t-1)*s];
    if(t<3)return[x+(3-t)*s,y+s];return[x,y+(4-t)*s];
  }
  function aura(g,x,y,s,now,count,life,reduced,low){
    if(count<1||life<=0)return;
    const tier=count>=10?4:count>=6?3:count>=3?2:1;
    const power=Math.min(1,life*5),speed=.00012*(1+tier*.18);
    g.save();g.lineCap='round';g.lineJoin='round';
    g.globalAlpha=power*.75;g.strokeStyle='#70c6e9';g.lineWidth=1.5;
    g.beginPath();g.roundRect(x-5,y-5,s+10,s+10,12);g.stroke();
    // Two comet ribbons flow around the outside brass rail. No occupied cells covered.
    if(!reduced){
      const segments=low?9:18;
      for(let k=0;k<(tier>=3?4:2);k++){
        const head=now*speed+k*4/(tier>=3?4:2);
        for(let j=0;j<segments;j++){
          const p=framePoint(head-j*.018,x-5,y-5,s+10),q=framePoint(head-(j+1)*.018,x-5,y-5,s+10);
          g.globalAlpha=power*Math.pow(1-j/segments,1.4);
          g.strokeStyle=k%2?'#f8e2aa':'#70c6e9';g.lineWidth=(2+tier*.6)*(1-j/segments)+.6;
          g.beginPath();g.moveTo(...p);g.lineTo(...q);g.stroke();
        }
        const p=framePoint(head,x-5,y-5,s+10);
        g.globalAlpha=power;g.fillStyle='#fff6e5';g.beginPath();g.arc(p[0],p[1],2+tier*.3,0,tau);g.fill();
      }
    }
    for(const [i,[cx,cy]]of [[x-1,y-1],[x+s+1,y-1],[x+s+1,y+s+1],[x-1,y+s+1]].entries()){
      g.save();g.translate(cx,cy);g.globalAlpha=power;
      g.fillStyle='#0a3157';g.strokeStyle='#e3ad53';g.lineWidth=1.5;
      g.beginPath();g.arc(0,0,4+tier*.65,0,tau);g.fill();g.stroke();
      g.rotate(reduced?Math.PI/4:now*.0015*(i%2?1:-1));
      g.fillStyle=i%2?'#f8e2aa':'#70c6e9';
      g.beginPath();g.moveTo(0,-5);g.lineTo(2,0);g.lineTo(0,5);g.lineTo(-2,0);g.closePath();g.fill();g.restore();
    }
    g.restore();
  }
  function announce(g,x,y,s,now,reduced){
    if(!burst)return;
    const age=now-burst.at;if(age>1100){burst=null;return;}
    // 2026-10-15 (kullanıcı isteği): kombo yazısı "Süper!" övgü yazısıyla aynı stilde —
    // büyük fildişi harf, kalın pirinç kontur, pop ile girer, hafifçe yükselip söner.
    // Tahtanın üst bölümünde durur; ortadaki övgü yazısıyla çakışmaz.
    const k=age/1100,cell=s/8;
    const pop=reduced?1:(k<.15?.6+k/.15*.55:k<.25?1.15-(k-.15):1.05),rise=reduced?0:k*cell*.5;
    const txt=`${burst.label} ×${burst.count}`;
    const face=sz=>`700 ${sz}px "Tiliq Display", "Tiliq Sans", sans-serif`;
    let sz=cell*.9;g.save();g.font=face(sz);
    const w=g.measureText(txt).width,maxW=s*.9;if(w>maxW)sz*=maxW/w;
    sz*=pop;g.font=face(sz);
    g.globalAlpha=k>.75?(1-k)/.25:1;g.textAlign='center';g.textBaseline='middle';g.lineJoin='round';
    const cx=x+s/2,cy=y+s*.17-rise;
    g.lineWidth=sz*.16;g.strokeStyle='#8a5422';g.strokeText(txt,cx,cy);
    g.fillStyle='#fff6e5';g.fillText(txt,cx,cy);
    g.restore();
  }
  return {trigger:(count,label,at)=>{if(count>=2)burst={count,label,at};},clear:()=>{burst=null;},aura,announce};
})();
