import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const storeAssetsDir = path.resolve(toolsDir, '..');
const deployDir = path.resolve(storeAssetsDir, '..');
const metadata = JSON.parse(await fs.readFile(path.join(storeAssetsDir, 'store-metadata.json'), 'utf8'));
const requestedLocale = process.argv.find((arg) => arg.startsWith('--locale='))?.split('=')[1];
const skipRaw = process.argv.includes('--skip-raw');
const localeEntries = Object.entries(metadata.locales).filter(([locale]) => !requestedLocale || locale === requestedLocale);

if (!localeEntries.length) {
  throw new Error(`Unknown locale: ${requestedLocale}`);
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://127.0.0.1');
    const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
    const requestedPath = path.resolve(deployDir, relative);
    if (requestedPath !== deployDir && !requestedPath.startsWith(`${deployDir}${path.sep}`)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const data = await fs.readFile(requestedPath);
    response.writeHead(200, { 'Content-Type': mimeTypes[path.extname(requestedPath).toLowerCase()] || 'application/octet-stream' });
    response.end(data);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500).end(error.code === 'ENOENT' ? 'Not found' : 'Server error');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;

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
if (!executablePath) throw new Error('Chrome or Edge was not found. Set CHROME_PATH and try again.');

const browser = await chromium.launch({
  executablePath,
  headless: true,
  args: ['--hide-scrollbars', '--mute-audio', '--disable-features=Translate'],
});

const shotNames = ['home', 'gameplay', 'power-ups', 'daily-rewards', 'rankings', 'customize'];
const today = new Date().toISOString().slice(0, 10);

const waitForVisuals = async (page) => {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter((image) => image.src).map((image) => {
      if (image.complete) return Promise.resolve();
      return new Promise((resolve) => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    }));
  });
  await page.waitForTimeout(350);
};

const prepareBase = async (page, gameCode) => {
  await page.evaluate(({ code }) => {
    lang = code;
    localStorage.setItem('tm_lang', code);
    localStorage.setItem('tm_lang_chosen', '1');
    applyLang();
    applyVibe();
    document.querySelectorAll('.screen').forEach((screen) => screen.classList.remove('active'));
    document.querySelectorAll('.modal').forEach((modal) => modal.classList.remove('active'));
    document.getElementById('lb-panel')?.classList.remove('open');
    document.getElementById('login-gate')?.classList.remove('show');
    document.getElementById('play-transition')?.classList.remove('active');
    document.getElementById('ad-loading-overlay')?.classList.remove('active');
    document.body.style.overflow = 'hidden';
    acct.nickname = 'Sky Pilot';
    acct.country = '🌐';
    acct.best = 28400;
    acct.games = 86;
    acct.total = 142600;
    localStorage.setItem('tm_coins', '1240');
    localStorage.setItem('tm_gems', '75');
    localStorage.setItem('tm_xp', '8640');
    localStorage.setItem('tiliq_best', '28400');
    localStorage.setItem('tm_streak', JSON.stringify({ date: new Date().toISOString().slice(0, 10), count: 6 }));
    localStorage.setItem('tm_treasure_date', '2000-01-01');
    localStorage.setItem('tm_inv_bombs', '2');
    localStorage.setItem('tm_inv_colorblast', '1');
    showScreen('menu');
    refreshKingdomHUD(calcLevel(getXP()));
    renderDailyCard();
    updateMenuAvatar();
    updateMissionCardStatus();
  }, { code: gameCode });
};

const captureRawLocale = async (locale, entry) => {
  const context = await browser.newContext({
    viewport: { width: 500, height: 932 },
    deviceScaleFactor: 1,
    locale,
    colorScheme: 'light',
  });
  await context.addInitScript(({ code, date }) => {
    localStorage.setItem('tm_lang', code);
    localStorage.setItem('tm_lang_chosen', '1');
    localStorage.setItem('tm_vibe', 'kingdom');
    localStorage.setItem('tm_coins', '1240');
    localStorage.setItem('tm_gems', '75');
    localStorage.setItem('tm_xp', '8640');
    localStorage.setItem('tiliq_best', '28400');
    localStorage.setItem('tm_streak', JSON.stringify({ date, count: 6 }));
    localStorage.setItem('tm_treasure_date', '2000-01-01');
    localStorage.setItem('tm_inv_bombs', '2');
    localStorage.setItem('tm_inv_colorblast', '1');
  }, { code: entry.gameCode, date: today });
  const page = await context.newPage();
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof applyLang === 'function' && typeof showScreen === 'function');
  await prepareBase(page, entry.gameCode);

  const rawDir = path.join(storeAssetsDir, 'raw', locale);
  await fs.mkdir(rawDir, { recursive: true });
  const take = async (number) => {
    await waitForVisuals(page);
    // Authentication initializes asynchronously on the first fresh browser context.
    // Keep store captures on the seeded gameplay UI instead of allowing the login
    // gate to race back over the requested screen just before the screenshot.
    await page.evaluate(() => document.getElementById('login-gate')?.classList.remove('show'));
    await page.screenshot({
      path: path.join(rawDir, `${String(number).padStart(2, '0')}-${shotNames[number - 1]}.png`),
      type: 'png',
      animations: 'disabled',
    });
  };

  // 1 — Current Sky Harbor home screen.
  await prepareBase(page, entry.gameCode);
  await take(1);

  // 2 — Active game with a believable, seeded board state.
  await prepareBase(page, entry.gameCode);
  await page.evaluate(() => {
    showScreen('game');
    startGame();
    const sample = [
      [1, 2, 0, 0, 5, 5, 0, 0],
      [1, 2, 2, 0, 5, 0, 0, 3],
      [0, 0, 2, 0, 0, 0, 3, 3],
      [4, 4, 0, 6, 6, 0, 3, 0],
      [4, 0, 0, 6, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 2, 2],
      [5, 5, 5, 0, 4, 0, 2, 0],
      [0, 6, 0, 0, 4, 4, 0, 0],
    ];
    for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) grid[row][col] = sample[row][col];
    score = 2840;
    combo = 4;
    resetComboTimer();
    best = 28400;
    bombCount = 2;
    bombXP = BOMB_THRESHOLD * 0.72;
    colorBlastXP = COLOR_BLAST_THRESHOLD;
    setColorBlast(1);
    setScoreDisplay(score);
    document.getElementById('scoreDisplay').textContent = score.toLocaleString();
    document.getElementById('bestDisplay').textContent = best.toLocaleString();
    document.getElementById('comboDisplay').textContent = String(combo);
    updateBombBar();
    updateColorBlastBtn();
    resizeCanvas();
  });
  await take(2);

  // 3 — High-combo power-up moment with the real board renderer and controls.
  await page.evaluate(() => {
    score = 6840;
    combo = 7;
    resetComboTimer();
    bombCount = 2;
    bombXP = BOMB_THRESHOLD;
    colorBlastXP = COLOR_BLAST_THRESHOLD;
    setColorBlast(1);
    document.getElementById('scoreDisplay').textContent = score.toLocaleString();
    document.getElementById('comboDisplay').textContent = String(combo);
    const comboChip = document.getElementById('combo-chip');
    comboChip?.classList.add('c-inferno', 'pop');
    document.getElementById('bomb-btn')?.classList.add('ready', 'lit-super');
    document.getElementById('colorblast-btn')?.classList.add('ready', 'lit-color');
    updateBombBar();
    updateColorBlastBtn();
    const centerX = GOX() + CELL * GRID / 2;
    const centerY = GOY + CELL * GRID * 0.43;
    spawnExplosion(centerX, centerY, '#f4d58e', true);
    spawnFlame(centerX, centerY, combo);
    showCelebration(`${t('combo')} ×${combo}`, '#f4d58e');
  });
  await page.waitForTimeout(110);
  await take(3);

  // 4 — Localized seven-day reward track.
  await prepareBase(page, entry.gameCode);
  await page.evaluate(() => {
    showModal('daily');
    renderDailyModal();
  });
  await take(4);

  // 5 — Localized ranking shell populated with anonymous demo call signs.
  await prepareBase(page, entry.gameCode);
  await page.evaluate(() => {
    const panel = document.getElementById('lb-panel');
    panel.classList.add('open');
    document.getElementById('my-rank').textContent = '#4';
    document.getElementById('my-score-lb').textContent = (28400).toLocaleString();
    const rows = [
      ['🇯🇵 Nova', 71840, 72],
      ['🇩🇪 CloudAce', 52960, 61],
      ['🇧🇷 SkyFox', 41320, 54],
      ['🌐 Sky Pilot', 28400, 45],
      ['🇫🇷 BlueWing', 22680, 39],
      ['🇰🇷 StarRoute', 19440, 35],
      ['🇹🇷 Airship', 16820, 31],
    ];
    document.getElementById('lb-list').innerHTML = rows.map((row, index) => _lbRow(index, row[0], row[1], index === 3, row[2])).join('');
  });
  await take(5);

  // 6 — Current customization store with cargo palettes and combo effects.
  await prepareBase(page, entry.gameCode);
  await page.evaluate(() => {
    showTmStoreModal();
    const body = document.getElementById('store-body');
    if (body) body.scrollTop = 0;
  });
  await take(6);

  await context.close();
};

const captureFramedLocale = async (locale, entry) => {
  const targets = [
    { platform: 'google-play', width: 1080, height: 1920, folderLocale: locale, deviceFolder: 'phone' },
    { platform: 'app-store', width: 1260, height: 2736, folderLocale: entry.appStoreLocale, deviceFolder: 'iphone-6.9' },
  ];
  for (const target of targets) {
    const context = await browser.newContext({
      viewport: { width: target.width, height: target.height },
      deviceScaleFactor: 1,
      locale,
      colorScheme: 'light',
    });
    const page = await context.newPage();
    for (let number = 1; number <= 6; number += 1) {
      const url = `${baseUrl}/store-assets/screenshot-frame.html?locale=${encodeURIComponent(locale)}&shot=${number}&platform=${target.platform}`;
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.dataset.ready === '1');
      const outputDir = path.join(storeAssetsDir, 'screenshots', target.platform, target.folderLocale, target.deviceFolder);
      await fs.mkdir(outputDir, { recursive: true });
      await page.screenshot({
        path: path.join(outputDir, `${String(number).padStart(2, '0')}-${shotNames[number - 1]}.jpg`),
        type: 'jpeg',
        quality: 95,
        animations: 'disabled',
      });
    }
    await context.close();
  }
};

try {
  for (const [locale, entry] of localeEntries) {
    console.log(`[${locale}] capturing current UI`);
    if (!skipRaw) await captureRawLocale(locale, entry);
    console.log(`[${locale}] rendering Google Play and App Store sets`);
    await captureFramedLocale(locale, entry);
  }
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(`Generated ${localeEntries.length * 12} final screenshots for ${localeEntries.length} locale(s).`);
