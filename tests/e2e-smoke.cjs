const { _electron } = require('playwright');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');

const root = join(__dirname, '..');
const electronExe = require('electron');

(async () => {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const electron = await _electron.launch({
    executablePath: electronExe,
    args: ['.'],
    cwd: root,
    env,
    timeout: 30000,
  });
  try {
    const page = await electron.firstWindow();
    page.setDefaultTimeout(15000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.getByRole('heading', { name: 'Stockfish Coach' }).waitFor();
    await page.getByRole('gridcell').first().waitFor();
    const squares = await page.getByRole('gridcell').count();
    const status = await page.locator('.topbar-status strong').innerText();
    if (squares !== 64) throw new Error(`Expected 64 squares, got ${squares}`);
    if (!status.includes('Stockfish')) throw new Error(`Unexpected engine status: ${status}`);

    await page.getByRole('gridcell', { name: 'e2 white p' }).click();
    await page.getByRole('gridcell', { name: 'e4' }).click();
    await page.getByRole('gridcell', { name: 'e4 white p' }).waitFor();
    await page.getByRole('button', { name: 'Undo turn' }).waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelectorAll('[aria-label="Move history"] .move-chip').length >= 2, null, { timeout: 30000 });
    await page.getByRole('button', { name: 'Analyze position' }).click();
    await page.waitForFunction(() => document.querySelector('.topbar-status div span')?.textContent?.includes('Position analyzed'), null, { timeout: 30000 });
    await page.getByRole('button', { name: 'Go to starting position' }).click();
    await page.getByRole('gridcell', { name: 'e2 white p' }).waitFor();
    await page.getByRole('button', { name: 'Go to latest position' }).click();
    await page.getByRole('gridcell', { name: 'e4 white p' }).waitFor();
    await page.getByRole('button', { name: 'New game' }).click();
    await page.getByRole('gridcell', { name: 'e2 white p' }).waitFor();
    mkdirSync(join(root, 'artifacts'), { recursive: true });
    await page.screenshot({ path: join(root, 'artifacts', 'playwright-smoke.png'), fullPage: true });
    if (errors.length) throw new Error(`Renderer errors: ${errors.join('; ')}`);
    console.log(JSON.stringify({ pass: true, squares, engine: status, interactions: ['e2-e4', 'Stockfish reply', 'analysis', 'history start/latest', 'new game'], screenshot: 'artifacts/playwright-smoke.png' }));
  } finally {
    await electron.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
