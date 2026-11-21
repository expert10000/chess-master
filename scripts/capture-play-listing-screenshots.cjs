const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { join } = require('node:path');

const root = join(__dirname, '..');
const out = join(root, 'play-listing');

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--config', 'vite.mobile.config.ts', '--port', '5176'], { cwd: root, stdio: 'ignore' });
  let browser;
  try {
    for (let attempt = 0; attempt < 60; attempt++) {
      try { if ((await fetch('http://127.0.0.1:5176/')).ok) break; } catch { /* Vite starting */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const page = await browser.newPage({ viewport: { width: 412, height: 732 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true });
    page.setDefaultTimeout(30000);
    await page.goto('http://127.0.0.1:5176/');
    await page.getByText('Ready', { exact: true }).waitFor();
    await page.locator('.mobile-board .piece-illustrated').first().waitFor();
    await page.screenshot({ path: join(out, '01-play.png'), animations: 'disabled' });

    await page.evaluate(() => {
      localStorage.setItem('stockfish-coach.mobile.v1', JSON.stringify({ pgn: '1. e4 e5 2. Nf3 Nc6', side: 'w', difficulty: '1800', flipped: false }));
      localStorage.setItem('stockfish-coach.mobile.piece-style.v3', 'illustrated');
    });
    await page.reload();
    await page.getByText('Ready', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Hint' }).click();
    await page.getByText('BEST MOVE · STOCKFISH').waitFor();
    await page.evaluate(() => window.scrollTo(0, 230));
    await page.screenshot({ path: join(out, '02-hint.png'), animations: 'disabled' });

    await page.locator('.bottom-nav button').nth(3).click();
    await page.getByRole('heading', { name: 'Puzzles' }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(out, '03-puzzles.png'), animations: 'disabled' });

    await page.locator('.bottom-nav button').nth(2).click();
    await page.getByRole('heading', { name: 'Move history' }).waitFor();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(out, '04-moves.png'), animations: 'disabled' });
    console.log('Captured four genuine mobile app screenshots in', out);
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
