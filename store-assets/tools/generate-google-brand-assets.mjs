import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const storeAssetsDir = path.resolve(toolsDir, '..');
const deployDir = path.resolve(storeAssetsDir, '..');
const outputDir = path.join(storeAssetsDir, 'graphics', 'google-play');
const featureSource = path.join(storeAssetsDir, 'graphics', 'feature-graphic.html');
const iconSource = path.join(deployDir, 'assets', 'sky-harbor', 'tiliq-app-icon.png');
const featureOutput = path.join(outputDir, 'feature-graphic.png');
const iconOutput = path.join(outputDir, 'icon.png');

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

await fs.mkdir(outputDir, { recursive: true });
await fs.copyFile(iconSource, iconOutput);

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--hide-scrollbars', '--allow-file-access-from-files'],
});
try {
  const context = await browser.newContext({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.goto(pathToFileURL(featureSource).href, { waitUntil: 'load' });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map((image) => image.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
          image.addEventListener('load', resolve, { once: true });
          image.addEventListener('error', resolve, { once: true });
        })));
  });
  await page.screenshot({ path: featureOutput, type: 'png', animations: 'disabled' });
  await context.close();
} finally {
  await browser.close();
}

console.log(`Google Play icon: ${iconOutput}`);
console.log(`Feature graphic: ${featureOutput}`);
