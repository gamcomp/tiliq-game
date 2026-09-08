// Served only by the localhost review server, never included in the mobile app.
if(localStorage.getItem('harbor_review_seed')!=='1'){
  const values={tm_lang:'TR',tm_lang_chosen:'1',tm_tut_done:'1',tm_vibe:'kingdom',tm_coins:'1240',tm_xp:'8640',tiliq_best:'28400',tm_inv_bombs:'3',tm_inv_colorblast:'3',harbor_review_seed:'1'};
  for(const[key,value]of Object.entries(values))localStorage.setItem(key,value);
}
