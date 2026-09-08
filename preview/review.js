const frame=document.getElementById('game'),hint=document.getElementById('hint'),placeButton=document.getElementById('place');
let scene='home',version='after';placeButton.disabled=true;
const descriptions={home:'Oyna’ya dokun. Sesler ilk etkileşimle açılır.',play:'Gerçek oyun: parçaları sürükle, çevir ve yüksek skorunu yap.',board:'Seçtiğin eski parlak kareler geri geldi. Yerleştirme ve yumuşak giriş hareketini dene.',line:'Alt sıradaki iki boş hücreyi doldur. Çerçeve, temizlenecek hattı gösterir.',combo:'İki sıra birden temizlenecek. Hazır hamleyi yerleştirerek sesi ve ışığı dene.',surge:'Yüksek kombo: hazır hamleyi yerleştir. Dört ışık izi ve çarpan rozeti güçlenir.',bomb:'Normal hamle yok. Kırmızı çekiç butonuna dokun, tahtada hedef seç ve onayla.',settings:'Efekt ve müzik seviyelerini ayrı ayrı ayarla.'};
Object.assign(descriptions,{missions:'Görev kartlarını ve ilerleme çubuklarını incele.',daily:'Günlük ödülün yumuşak hareketini ve gün kartlarını incele.',store:'Çekiç paketleri ve güçlendiriciler. Sekmelerden diğer koleksiyonlara geçebilirsin.',ranking:'Sıralama paneli: bu yerel test gerçek oyuncu verisine bağlanmaz.',profile:'Uçuş profili ve envanterin görünümünü incele.',over:'Örnek uçuş raporu. Ödül ve devam akışı yalnızca yerel test verisini etkiler.'});
Object.assign(descriptions,{rewards:'İki görev ve günlük ödül hazır. Rozetli kartları açıp topladığında sayının azaldığını kontrol et. Bu yalnızca yerel örnek veridir.',friends:'Arkadaş ekleme sıralamanın önünde. Geri ile sıralamaya dön. Bu test gerçek arkadaş isteği göndermez.'});
function run(next){scene=next;frame.contentWindow.tiliqPreview?.run(next);hint.textContent=descriptions[next];placeButton.disabled=!['line','combo','surge'].includes(next);}
document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>run(b.dataset.scene)));
document.querySelectorAll('[data-sound]').forEach(b=>b.addEventListener('click',()=>frame.contentWindow.tiliqPreview?.sound(b.dataset.sound)));
placeButton.addEventListener('click',()=>{frame.contentWindow.tiliqPreview?.place();placeButton.disabled=true;});
for(const id of ['before','after'])document.getElementById(id).addEventListener('click',()=>{
  version=id;for(const other of ['before','after']){const b=document.getElementById(other);b.classList.toggle('selected',other===id);b.setAttribute('aria-pressed',String(other===id));}
  document.getElementById('version').textContent=id==='after'?'GELİŞTİRİLMİŞ SÜRÜM':'ÖNCEKİ SÜRÜM';
  frame.src=`/${id==='after'?'game':'before'}/index.html`;
});
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data?.type==='tiliq-preview-ready')run(scene);});
