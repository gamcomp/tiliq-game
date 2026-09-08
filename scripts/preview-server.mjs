import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const port=Number(process.env.TILIQ_PREVIEW_PORT||4179);
const baseline=new Map(['index.html','crown-quest.css'].map(file=>[file,execFileSync('git',['show',`HEAD:${file}`],{cwd:root,maxBuffer:8*1024*1024,encoding:'utf8'})]));
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2','.jpg':'image/jpeg'};
const files=new Set(['index.html','crown-quest.css','harbor-polish.css','harbor-polish.js','hammer-i18n.js']);
function previewHtml(source){
  // Only the in-memory localhost response bypasses boot services; shipped HTML is untouched.
  if(!source.includes('  initFirebaseAuth();')||!source.includes('  initSplash();'))throw new Error('Preview boot anchors changed');
  return source.replace('  initFirebaseAuth();','  // Local preview: no Firebase initialization.')
    .replace('  initSplash();','  // Local preview: bridge chooses the initial screen.')
    .replace('<head>','<head><script src="/preview/seed.js"></script>')
    .replace('</body>','<script src="/preview/bridge.js"></script></body>');
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost'),pathname=decodeURIComponent(url.pathname);
    const host=(req.headers.host||'').split(':')[0];
    if(!['localhost','127.0.0.1','['].includes(host)){res.writeHead(403).end();return;}
    res.setHeader('Cache-Control','no-store');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; media-src 'self' blob:; frame-src 'self'; object-src 'none'; base-uri 'self'");
    let relative=pathname==='/'?'preview/index.html':pathname.replace(/^\//,'');
    let before=false;
    if(relative.startsWith('before/')){before=true;relative=relative.slice(7);}
    else if(relative.startsWith('game/'))relative=relative.slice(5);
    const allowed=files.has(relative)||relative.startsWith('assets/')||relative.startsWith('preview/');
    const full=path.resolve(root,relative);
    if(!allowed||!full.startsWith(root+path.sep)||relative.split(/[\\/]/).some(p=>p.startsWith('.'))||!mime[path.extname(full)]){res.writeHead(404).end();return;}
    let data=before&&baseline.has(relative)?baseline.get(relative):await readFile(full);
    if(relative==='index.html')data=previewHtml(data.toString());
    res.writeHead(200,{'Content-Type':mime[path.extname(full)]});res.end(data);
  }catch(error){res.writeHead(error.code==='ENOENT'?404:500).end('Preview file unavailable');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Tiliq local review: http://localhost:${port} — no deployment`));
