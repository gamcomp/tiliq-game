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
    const menu=document.getElementById('screen-menu');
    if(menu){const sky=document.createElement('div');sky.className='harbor-atmosphere';sky.setAttribute('aria-hidden','true');menu.prepend(sky);}
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
    if(name==='place') {note('noise',.055,.1,0,'sine',1700);note(620,.13,.12,0,'triangle',360);note(1240,.09,.045,.012);}
    if(name==='tap') {note(540,.055,.055,0,'sine',390);}
    if(name==='clear'||name==='chain') {
      const notes=[587.33,739.99,880,1174.66,1479.98], count=name==='chain'?3:Math.min(5,n+1);
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
    const entry=Math.min(1,age/160),exit=Math.min(1,(1100-age)/240);
    const scale=reduced?1:1-Math.pow(1-entry,3)*.25+Math.sin(entry*Math.PI)*.06;
    const width=Math.min(s*.72,250),height=42,cy=y+s*.17;
    g.save();g.translate(x+s/2,cy-(reduced?0:Math.max(0,age-800)/45));g.scale(scale,scale);
    g.globalAlpha=Math.min(entry,exit);
    // Pilot's ribbon: slim wings and an enamel center, using the existing palette.
    for(const side of [-1,1]){
      g.save();g.scale(side,1);g.strokeStyle='#e3ad53';g.lineWidth=2;
      for(let i=0;i<3;i++){g.beginPath();g.moveTo(width/2-2,-8+i*7);g.lineTo(width/2+19-i*5,-11+i*7);g.stroke();}g.restore();
    }
    const bg=g.createLinearGradient(0,-height/2,0,height/2);bg.addColorStop(0,'#0d4a7b');bg.addColorStop(1,'#08233c');
    g.fillStyle=bg;g.strokeStyle='#f8e2aa';g.lineWidth=2;
    g.beginPath();g.roundRect(-width/2,-height/2,width,height,12);g.fill();g.stroke();
    g.fillStyle='#fff6e5';g.textAlign='center';g.textBaseline='middle';
    g.font='750 17px "Tiliq Sans", sans-serif';
    g.fillText(`${burst.label}  ×${burst.count}`,0,-2,width-24);
    const tier=Math.min(5,burst.count);
    for(let i=0;i<5;i++){g.fillStyle=i<tier?'#70c6e9':'#35546b';g.beginPath();g.arc((i-2)*9,13,1.7,0,tau);g.fill();}
    g.restore();
  }
  return {trigger:(count,label,at)=>{if(count>=2)burst={count,label,at};},clear:()=>{burst=null;},aura,announce};
})();
