import { promises as fs } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Builds the App Store / Google Play preview video as a Ken Burns slideshow over the
// already-branded, store:validate-passing framed screenshots in
// screenshots/google-play/<locale>/phone/*.jpg (golden frame, TILIQ wordmark, tagline
// headline, corner rivets — same design language as the listing images). We
// deliberately do NOT record the live page for this: an earlier version drove the real
// running game for ~12s and found that the live board auto-plays/resolves on its own
// after a few hundred ms even with no user input, which unpredictably emptied the
// board and kicked back to the menu mid-recording. Static frames sidestep that.

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const storeAssetsDir = path.resolve(toolsDir, '..');
const repoRoot = path.resolve(storeAssetsDir, '..', '..');
const videoDir = path.join(storeAssetsDir, 'video');
const clipsDir = path.join(videoDir, 'clips');

const locale = process.argv.find((arg) => arg.startsWith('--locale='))?.split('=')[1] || 'en-US';
const musicFile = process.argv.find((arg) => arg.startsWith('--music='))?.split('=')[1]
  || path.join(repoRoot, 'music-proposals-2026-09-18', '04_kargo_ekspresi.wav');

function resolveFfmpeg() {
  const candidates = [
    process.env.FFMPEG_PATH,
    'ffmpeg',
    'C:/Users/Besa/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.1-full_build/bin/ffmpeg.exe',
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-version'], { stdio: 'ignore' });
      return candidate;
    } catch {}
  }
  throw new Error('ffmpeg not found. Set FFMPEG_PATH or install it (winget install Gyan.FFmpeg).');
}

const ffmpeg = resolveFfmpeg();
const run = (args) => execFileSync(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] });

await fs.rm(clipsDir, { recursive: true, force: true });
await fs.mkdir(clipsDir, { recursive: true });

// Source the polished, already-branded frames (golden border, TILIQ wordmark, tagline
// headline, corner rivets) instead of the plain raw UI captures — same design the
// store screenshots ship with, so the video and the listing images look like one family.
const framedDir = path.join(storeAssetsDir, 'screenshots', 'google-play', locale, 'phone');
// [shot name, hold seconds, ken-burns direction]
const timeline = [
  ['01-home', 2.0, 'in-center'],
  ['02-gameplay', 2.0, 'in-top'],
  ['03-power-ups', 2.6, 'in-center-strong'],
  ['04-daily-rewards', 2.0, 'in-bottom'],
  ['05-rankings', 2.0, 'in-top'],
  ['06-customize', 2.0, 'in-bottom'],
  ['01-home', 2.4, 'out-center'],
];
const FPS = 30;
const XFADE = 0.6;

function zoompanFilter(direction, frames) {
  const anchors = {
    'in-center': { z: "min(zoom+0.0022,1.10)", y: 'center' },
    'in-center-strong': { z: "min(zoom+0.0032,1.16)", y: 'center' },
    'in-top': { z: "min(zoom+0.0022,1.10)", y: 'top' },
    'in-bottom': { z: "min(zoom+0.0022,1.10)", y: 'bottom' },
    'out-center': { z: "if(eq(on,0),1.12,max(zoom-0.0022,1.0))", y: 'center' },
  };
  const { z, y } = anchors[direction];
  const x = 'iw/2-(iw/zoom/2)';
  const yExpr = y === 'top' ? '(ih-ih/zoom)*0.18' : y === 'bottom' ? '(ih-ih/zoom)*0.82' : 'ih/2-(ih/zoom/2)';
  return `zoompan=z='${z}':x='${x}':y='${yExpr}':d=${frames}:s=1080x1920:fps=${FPS},format=yuv420p`;
}

console.log(`Building ${timeline.length} Ken Burns clips from screenshots/google-play/${locale}/phone...`);
const clipPaths = [];
for (let i = 0; i < timeline.length; i += 1) {
  const [name, dur, direction] = timeline[i];
  const src = path.join(framedDir, `${name}.jpg`);
  const out = path.join(clipsDir, `clip_${String(i).padStart(2, '0')}.mp4`);
  const frames = Math.round(dur * FPS);
  run([
    '-y', '-loop', '1', '-i', src,
    '-vf', zoompanFilter(direction, frames),
    '-t', String(dur), '-an', '-c:v', 'libx264', '-crf', '16', '-preset', 'veryfast', out,
  ]);
  clipPaths.push(out);
}

// Chain xfade transitions across all clips, then fade the whole thing in/out and mix music.
let totalDur = 0;
const offsets = [];
for (const [, dur] of timeline) {
  offsets.push(totalDur);
  totalDur += dur;
}
totalDur -= XFADE * (timeline.length - 1);
const fadeOutStart = Math.max(0, totalDur - 0.6);

const inputs = clipPaths.flatMap((clip) => ['-i', clip]);
let filter = '';
let prevLabel = '0:v';
let runningOffset = timeline[0][1];
for (let i = 1; i < timeline.length; i += 1) {
  const outLabel = i === timeline.length - 1 ? 'vout' : `v${i}`;
  const offset = runningOffset - XFADE;
  filter += `[${prevLabel}][${i}:v]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(2)}[${outLabel}];`;
  prevLabel = outLabel;
  runningOffset += timeline[i][1] - XFADE;
}
filter += `[vout]fade=t=in:st=0:d=0.4,fade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.6,format=yuv420p[vfinal];`;
filter += `[${timeline.length}:a]atrim=0:${totalDur.toFixed(2)},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeOutStart.toFixed(2)}:d=0.6,volume=0.9[afinal]`;

const outFile = path.join(videoDir, `tiliq-preview-${locale}.mp4`);
console.log(`Compositing final video (${totalDur.toFixed(1)}s) -> ${outFile}`);
run([
  '-y', ...inputs, '-i', musicFile,
  '-filter_complex', filter,
  '-map', '[vfinal]', '-map', '[afinal]',
  '-c:v', 'libx264', '-profile:v', 'high', '-level', '4.2', '-crf', '18', '-preset', 'slow',
  '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest',
  outFile,
]);

await fs.rm(clipsDir, { recursive: true, force: true });
console.log(`Done: ${outFile}`);
