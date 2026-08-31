import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const deployDir = path.resolve(toolsDir, '..', '..');
const sourceUrl = pathToFileURL(path.join(deployDir, 'assets', 'sky-harbor', 'splash-brand.html')).href;

const targets = [
  ['android/app/src/main/res/drawable/splash.png', 480, 320],
  ['android/app/src/main/res/drawable-land-mdpi/splash.png', 480, 320],
  ['android/app/src/main/res/drawable-land-hdpi/splash.png', 800, 480],
  ['android/app/src/main/res/drawable-land-xhdpi/splash.png', 1280, 720],
  ['android/app/src/main/res/drawable-land-xxhdpi/splash.png', 1600, 960],
  ['android/app/src/main/res/drawable-land-xxxhdpi/splash.png', 1920, 1280],
  ['android/app/src/main/res/drawable-port-mdpi/splash.png', 320, 480],
  ['android/app/src/main/res/drawable-port-hdpi/splash.png', 480, 800],
  ['android/app/src/main/res/drawable-port-xhdpi/splash.png', 720, 1280],
  ['android/app/src/main/res/drawable-port-xxhdpi/splash.png', 960, 1600],
  ['android/app/src/main/res/drawable-port-xxxhdpi/splash.png', 1280, 1920],
  ['ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png', 2732, 2732],
  ['ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-1.png', 2732, 2732],
  ['ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732-2.png', 2732, 2732],
];

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
let executablePath;
for (const candidate of chromeCandidates) {
  try {
    await fs.access(candidate);
    executablePath = candidate;
    break;
  } catch {}
}
if (!executablePath) throw new Error('Chrome or Edge was not found.');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--hide-scrollbars', '--allow-file-access-from-files'],
});
try {
  for (const [relativePath, width, height] of targets) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(sourceUrl, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener('load', resolve, { once: true });
            image.addEventListener('error', resolve, { once: true });
          })));
    });
    const outputPath = path.join(deployDir, relativePath);
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await page.screenshot({ path: outputPath, type: 'png', animations: 'disabled' });
    await context.close();
    console.log(`${relativePath}: ${width}x${height}`);
  }
} finally {
  await browser.close();
}
