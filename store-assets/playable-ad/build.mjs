// Tiliq playable ad: görselleri base64 olarak gömüp tek HTML dosyası üretir (Unity Ads tek dosya ister).
// Kullanım: node store-assets/playable-ad/build.mjs
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const dataUri = (path, mime) => `data:${mime};base64,${readFileSync(join(root, path)).toString('base64')}`;

const html = readFileSync(join(here, 'src', 'playable.src.html'), 'utf8')
  .replace('{{BG}}', dataUri('assets/sky-harbor/game-clouds.webp', 'image/webp'))
  .replace('{{ICON}}', dataUri('store-assets/graphics/google-play/icon.png', 'image/png'));

const out = join(here, 'dist', 'tiliq-playable.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
const kb = statSync(out).size / 1024;
console.log(`${out} — ${kb.toFixed(0)} KB${kb > 5 * 1024 ? '  !! 5 MB sınırını aşıyor' : ''}`);
