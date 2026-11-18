const { chromium, _electron } = require('playwright');
const { spawn } = require('node:child_process');
const { join } = require('node:path');
const { mkdirSync, mkdtempSync, rmSync } = require('node:fs');
const puzzles = require('../src/data/puzzles.json');
const root = join(__dirname, '..');
const puzzle = puzzles[0];
async function solve(page, board) {
  for (let i = 1; i < puzzle.moves.length; i += 2) {
    const answer = puzzle.moves[i];
    await board.locator(`[data-square="${answer.slice(0, 2)}"], [aria-label^="${answer.slice(0, 2)}"]`).first().click();
    await board.locator(`[data-square="${answer.slice(2, 4)}"], [aria-label^="${answer.slice(2, 4)}"]`).first().click();
  }
  await page.getByText(/Solved on the first try/).waitFor();
}

(async () => {
  mkdirSync(join(root, 'artifacts'), { recursive: true });
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--config', 'vite.mobile.config.ts', '--port', '5175'], { cwd: root, stdio: 'ignore' });
  const profile = mkdtempSync(join(root, 'artifacts', 'puzzle-profile-'));
  let browser; let electron;
  try {
    for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:5175/')).ok) break; } catch {} await new Promise((resolve) => setTimeout(resolve, 250)); }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const mobile = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
    const page = await mobile.newPage();
    const errors = []; page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:5175/');
    await page.getByRole('button', { name: 'Puzzles' }).click();
    const board = page.locator('.puzzle-mobile-board');
    if (await board.getByRole('gridcell').count() !== 64) throw new Error('Mobile puzzle board is missing.');
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile puzzle overflows horizontally.');
    await page.screenshot({ path: join(root, 'artifacts', 'puzzles-mobile.png') });
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    if (await board.locator('.hinted').count() !== 1) throw new Error('First hint must identify the piece.');
    await page.getByRole('button', { name: /Hint 1\/2/ }).click();
    if (await board.locator('.hinted').count() !== 2) throw new Error('Second hint must identify the destination.');
    await solve(page, board);
    await page.getByRole('button', { name: 'Review moves on board' }).click();
    for (let i = 0; i < puzzle.moves.length - 1; i++) await page.getByRole('button', { name: 'Previous solution move' }).click();
    await page.getByText('Start', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Next solution move' }).click();
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await page.getByRole('button', { name: 'Solution', exact: true }).click();
    await page.getByRole('button', { name: 'Next solution move' }).click();
    await page.getByLabel('Difficulty').selectOption('very-hard');
    await page.getByText('Very hard', { exact: true }).count();
    if (errors.length) throw new Error(`Mobile page errors: ${errors.join('; ')}`);
    await mobile.close();

    const landscape = await browser.newContext({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });
    const landscapePage = await landscape.newPage();
    await landscapePage.goto('http://127.0.0.1:5175/');
    await landscapePage.getByRole('button', { name: 'Puzzles' }).click();
    const placement = await landscapePage.locator('.puzzle-mobile-board').evaluate((element) => { const r = element.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: innerWidth, height: innerHeight }; });
    if (placement.right > placement.width || placement.bottom > placement.height) throw new Error(`Landscape board is clipped: ${JSON.stringify(placement)}`);
    await landscapePage.screenshot({ path: join(root, 'artifacts', 'puzzles-landscape.png') });
    await landscape.close();

    const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
    electron = await _electron.launch({ executablePath: require('electron'), args: ['.', `--user-data-dir=${profile}`], cwd: root, env, timeout: 30000 });
    const desktop = await electron.firstWindow();
    await desktop.getByRole('button', { name: /Puzzles Choose and solve/ }).click();
    const desktopBoard = desktop.locator('.puzzle-board-shell');
    await desktopBoard.getByRole('gridcell').first().waitFor();
    if (await desktopBoard.getByRole('gridcell').count() !== 64) throw new Error('Desktop puzzle board is missing.');
    await desktop.screenshot({ path: join(root, 'artifacts', 'puzzles-desktop.png') });
    const actions = await desktop.locator('.puzzle-actions').evaluate((element) => ({ bottom: element.getBoundingClientRect().bottom, viewport: innerHeight }));
    if (actions.bottom > actions.viewport) throw new Error(`Desktop puzzle actions require scrolling: ${JSON.stringify(actions)}`);
    await solve(desktop, desktopBoard);
    await desktop.getByRole('button', { name: 'Review on board' }).click();
    for (let i = 0; i < puzzle.moves.length - 1; i++) await desktop.getByRole('button', { name: 'Previous solution move' }).click();
    await desktop.getByText('Starting position').waitFor();
    console.log('Puzzle smoke passed: mobile portrait, mobile landscape, desktop, hints, solve, replay.');
  } finally {
    if (electron) await electron.close();
    if (browser) await browser.close();
    server.kill();
    rmSync(profile, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
