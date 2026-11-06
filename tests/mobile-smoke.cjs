const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const { join } = require('node:path');
const { deepStrictEqual, notDeepStrictEqual } = require('node:assert/strict');

const root = join(__dirname, '..');

(async () => {
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--config', 'vite.mobile.config.ts', '--port', '5174'], { cwd: root, stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch('http://127.0.0.1:5174/')).ok) break; } catch { /* Wait for Vite. */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5174/');
    await page.getByRole('heading', { name: 'Play chess' }).waitFor().catch(async error => {
      throw new Error(`${error.message}\nPage errors: ${errors.join('; ')}\nBody: ${(await page.locator('body').innerText()).slice(0, 500)}`);
    });
    if (await page.getByRole('gridcell').count() !== 64) throw new Error('Board must have 64 squares.');
    await page.getByText('Ready', { exact: true }).waitFor();
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error('Horizontal overflow on phone.');
    mkdirSync(join(root, 'artifacts'), { recursive: true });
    await page.screenshot({ path: join(root, 'artifacts', 'mobile-start.png') });
    await page.locator('.mobile-board .piece-desktop').first().waitFor();
    const startingBoard = await page.locator('.mobile-board .square').evaluateAll(squares => squares.map(square => square.getAttribute('aria-label')));
    for (const [style, id] of [['Staunton', 'illustrated'], ['Classic', 'chessnut'], ['Fantasy', 'fantasy'], ['Modern', 'spatial'], ['Desktop original', 'desktop']]) {
      await page.getByRole('button', { name: 'Choose piece style' }).tap();
      await page.getByRole('dialog', { name: 'Piece style' }).waitFor();
      if (style === 'Classic') await page.screenshot({ path: join(root, 'artifacts', 'mobile-piece-styles.png') });
      await page.locator('.piece-style-list button').filter({ hasText: style }).tap();
      await page.locator(`.mobile-board .${id === 'desktop' ? 'piece-desktop' : id === 'illustrated' ? 'piece-illustrated' : `piece-style-${id}`}`).first().waitFor();
      if (id === 'illustrated') {
        if (!(await page.request.get('http://127.0.0.1:5174/pieces/illustrated-sheet.png')).ok()) throw new Error('Illustrated piece sheet did not load.');
        await page.screenshot({ path: join(root, 'artifacts', 'mobile-illustrated.png') });
      } else if (id !== 'desktop') {
        await page.waitForFunction(() => [...document.querySelectorAll('.mobile-board .chess-piece')].every(image => image.complete && image.naturalWidth > 0));
      }
      deepStrictEqual(await page.locator('.mobile-board .square').evaluateAll(squares => squares.map(square => square.getAttribute('aria-label'))), startingBoard);
    }
    await page.reload();
    await page.locator('.mobile-board .piece-desktop').first().waitFor();
    await page.getByText('Ready', { exact: true }).waitFor();
    await page.getByRole('gridcell', { name: 'e2 white p' }).tap();
    await page.getByRole('gridcell', { name: 'e4' }).tap();
    await page.waitForFunction(() => document.querySelector('.move-preview strong')?.textContent?.includes('·'), null, { timeout: 30000 });
    const boardLabels = () => page.locator('.mobile-board .square').evaluateAll(squares => squares.map(square => square.getAttribute('aria-label')));
    const beforeLevelChange = await boardLabels();
    await page.getByRole('button', { name: 'Change engine level' }).tap();
    await page.getByRole('heading', { name: 'Engine level' }).waitFor();
    await page.screenshot({ path: join(root, 'artifacts', 'mobile-levels.png') });
    await page.locator('.level-sheet .level-list button').filter({ hasText: '2000 Elo' }).tap();
    await page.getByText('Black · ~2000 Elo').waitFor();
    deepStrictEqual(await boardLabels(), beforeLevelChange);
    await page.getByRole('button', { name: 'Hint' }).tap();
    await page.getByText(/Stockfish suggests/).waitFor();
    await page.getByText('Why this move?').waitFor();
    if (await page.locator('.square.hinted').count() !== 2) throw new Error('Hint squares missing.');
    await page.waitForTimeout(700);
    await page.screenshot({ path: join(root, 'artifacts', 'mobile-hint.png') });
    await page.locator('.bottom-nav button').nth(2).tap();
    await page.getByRole('heading', { name: 'Move history' }).waitFor();
    await page.getByText('2 plies played').waitFor();
    await page.locator('.bottom-nav button').nth(0).tap();
    const liveBoard = await boardLabels();
    await page.locator('.bottom-nav button').nth(2).tap();
    await page.getByRole('button', { name: 'View position after e4' }).tap();
    await page.getByText('History · 1/2').waitFor();
    notDeepStrictEqual(await boardLabels(), liveBoard);
    await page.screenshot({ path: join(root, 'artifacts', 'mobile-history.png') });
    await page.getByRole('button', { name: 'Return to live' }).tap();
    deepStrictEqual(await boardLabels(), liveBoard);
    await page.locator('.bottom-nav button').nth(2).tap();
    await page.locator('.history-row').first().tap({ position: { x: 3, y: 3 } });
    await page.getByText('History · 2/2').waitFor();
    await page.getByRole('button', { name: 'Return to live' }).tap();
    await page.getByRole('button', { name: 'Undo' }).tap();
    await page.getByRole('gridcell', { name: 'e2 white p' }).waitFor();
    await page.getByRole('button', { name: 'New game' }).tap();
    for (const level of ['1800 Elo', '2000 Elo', '2100 Elo', 'Max']) {
      await page.locator('.level-list button').filter({ hasText: level }).waitFor();
    }
    await page.locator('.choice-row button').nth(1).tap();
    await page.locator('.level-list button').last().tap();
    await page.getByRole('button', { name: 'Start game' }).tap();
    await page.getByText('White · Max strength').waitFor();
    await page.waitForFunction(() => document.querySelector('.move-preview strong')?.textContent !== 'Your opening starts here', null, { timeout: 30000 });
    await page.evaluate(() => localStorage.setItem('stockfish-coach.mobile.v1', JSON.stringify({ pgn: '1. e4 d5 2. Nc3 d4', side: 'w', difficulty: '1800', flipped: false })));
    await page.reload();
    await page.getByText('Ready', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Hint' }).tap();
    await page.getByText(/Stockfish suggests/).waitFor();
    const retreatPositionTip = await page.locator('.tip-card').innerText();
    if (retreatPositionTip.includes('Stockfish suggests Nb1') && !retreatPositionTip.includes('pawn on d4 attacks your knight on c3')) {
      throw new Error(`Knight retreat lacks its reason: ${retreatPositionTip}`);
    }
    await page.getByRole('button', { name: 'Deep about 9 s' }).tap();
    await page.getByRole('button', { name: 'Hint' }).tap();
    await page.getByRole('button', { name: 'Cancel' }).tap();
    await page.getByText('Analysis cancelled. The board has not changed.').waitFor();
    await page.getByRole('button', { name: 'Hint' }).tap();
    await page.getByText(/Stockfish suggests/).waitFor({ timeout: 30000 });
    await page.locator('.hint-explanation').waitFor();
    await page.evaluate(() => localStorage.setItem('stockfish-coach.mobile.v1', JSON.stringify({ pgn: '', side: 'w', difficulty: '1800', flipped: false })));
    await page.reload();
    await page.getByText('Ready', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Quick about 1 s' }).tap();
    await page.getByRole('button', { name: 'Hint' }).tap();
    await page.getByText(/Book suggestion/).waitFor();
    await page.getByRole('button', { name: 'Verify with Stockfish' }).tap();
    await page.getByText(/Stockfish suggests/).waitFor();
    await page.getByText('Why this move?').waitFor();
    await page.setViewportSize({ width: 915, height: 412 });
    await page.evaluate(() => {
      localStorage.setItem('stockfish-coach.mobile.v1', JSON.stringify({ pgn: '1. e4 d5 2. Nc3 d4', side: 'w', difficulty: '1800', flipped: false }));
      localStorage.setItem('stockfish-coach.mobile.piece-style.v2', 'illustrated');
    });
    await page.reload();
    await page.getByText('Ready', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Explain about 4 s' }).tap();
    await page.getByRole('button', { name: 'Hint' }).tap();
    const scrollBeforeHint = await page.evaluate(() => window.scrollY);
    await page.getByText(/Stockfish suggests/).waitFor();
    await page.getByText('Why this move?').waitFor();
    const landscape = await page.evaluate(() => {
      const board = document.querySelector('.board-wrap').getBoundingClientRect();
      const tip = document.querySelector('.tip-card').getBoundingClientRect();
      const explanation = document.querySelector('.hint-explanation p').getBoundingClientRect();
      const nav = document.querySelector('.bottom-nav').getBoundingClientRect();
      return { board: { left: board.left, right: board.right, top: board.top, bottom: board.bottom }, tip: { left: tip.left, right: tip.right, top: tip.top, bottom: tip.bottom }, explanation: { top: explanation.top, bottom: explanation.bottom }, navTop: nav.top, scrollY: window.scrollY, scrollWidth: document.documentElement.scrollWidth, width: window.innerWidth };
    });
    if (landscape.scrollY !== scrollBeforeHint || landscape.scrollWidth > landscape.width || landscape.board.bottom > landscape.navTop || landscape.tip.bottom > landscape.navTop || landscape.board.right >= landscape.tip.left || landscape.explanation.top >= landscape.navTop) {
      throw new Error(`Landscape board or explanation not visible together, or hint scrolled the page: ${JSON.stringify(landscape)}`);
    }
    await page.screenshot({ path: join(root, 'artifacts', 'mobile-landscape-hint.png') });
    await page.setViewportSize({ width: 412, height: 915 });
    await page.evaluate(() => localStorage.setItem('stockfish-coach.mobile.v1', JSON.stringify({ pgn: '', side: 'w', difficulty: '1800', flipped: false })));
    await page.reload();
    await page.getByText('Ready', { exact: true }).waitFor();
    const dragStart = await page.getByRole('gridcell', { name: 'e2 white p' }).boundingBox();
    const dragEnd = await page.getByRole('gridcell', { name: 'e4' }).boundingBox();
    if (!dragStart || !dragEnd) throw new Error('Could not locate touch drag squares.');
    const touch = await context.newCDPSession(page);
    const start = { x: dragStart.x + dragStart.width / 2, y: dragStart.y + dragStart.height / 2 };
    const end = { x: dragEnd.x + dragEnd.width / 2, y: dragEnd.y + dragEnd.height / 2 };
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [start] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: start.x, y: start.y - 16 }] });
    await page.locator('.drag-piece').waitFor();
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [end] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.locator('.drag-piece').waitFor({ state: 'hidden' });
    await page.getByRole('gridcell', { name: 'e4 white p' }).waitFor();
    if (errors.length) throw new Error(errors.join('; '));
    console.log(JSON.stringify({ pass: true, checks: ['64 squares', 'offline engine ready', 'phone width', 'desktop original default and five persistent piece styles', 'tap and touch drag moves', 'change level without resetting', 'explained hint and legal line', 'deep analysis and cancellation', 'book verification', 'landscape board and explanation without automatic scroll', 'history positions and live return', 'undo', '1800/2000/2100/Max levels', 'play as Black at Max'], screenshots: ['artifacts/mobile-start.png', 'artifacts/mobile-illustrated.png', 'artifacts/mobile-landscape-hint.png', 'artifacts/mobile-piece-styles.png', 'artifacts/mobile-levels.png', 'artifacts/mobile-hint.png', 'artifacts/mobile-history.png'] }));
  } finally {
    await browser?.close();
    server.kill();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
