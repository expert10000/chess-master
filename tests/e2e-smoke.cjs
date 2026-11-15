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
    await page.getByRole('button', { name: 'Import PGN / FEN' }).click();
    await page.getByRole('dialog', { name: 'Import PGN or FEN' }).waitFor();
    await page.locator('.import-textarea').fill('[Event "Stockfish Coach mobile"]\n[White "You"]\n[Black "Stockfish"]\n[Result "*"]\n\n1. e4 d5 2. Nc3 d4');
    await page.getByRole('checkbox', { name: 'Analyze the full game immediately' }).uncheck();
    await page.getByRole('button', { name: 'Import game', exact: true }).click();
    await page.getByRole('dialog', { name: 'Import PGN or FEN' }).waitFor({ state: 'hidden' });
    await page.locator('.move-chip[title="View position after d5"]').click();
    await page.getByText('History mode').waitFor();
    await page.getByRole('button', { name: 'Fork & play' }).click();
    await page.locator('.current-line-card').getByText('Variation 1').waitFor();
    await page.getByRole('gridcell', { name: 'g1 white n' }).click();
    await page.getByRole('gridcell', { name: 'f3' }).click();
    await page.getByRole('gridcell', { name: 'f3 white n' }).waitFor();
    await page.waitForFunction(() => {
      const saved = [...document.querySelectorAll('.saved-line-list button')].find(button => button.textContent.includes('Imported game'));
      return saved && !saved.disabled;
    }, null, { timeout: 30000 });
    await page.locator('.saved-line-list button').filter({ hasText: 'Imported game' }).click();
    await page.getByRole('gridcell', { name: 'c3 white n' }).waitFor();
    await page.getByRole('gridcell', { name: 'd4 black p' }).waitFor();
    mkdirSync(join(root, 'artifacts'), { recursive: true });
    await page.screenshot({ path: join(root, 'artifacts', 'playwright-smoke.png'), fullPage: true });
    if (errors.length) throw new Error(`Renderer errors: ${errors.join('; ')}`);
    console.log(JSON.stringify({ pass: true, squares, engine: status, interactions: ['e2-e4', 'Stockfish reply', 'analysis', 'history start/latest', 'new game', 'mobile PGN import', 'variation from historical move', 'return to original game'], screenshot: 'artifacts/playwright-smoke.png' }));
  } finally {
    await electron.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
