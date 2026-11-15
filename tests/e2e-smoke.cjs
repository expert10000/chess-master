const { _electron } = require('playwright');
const { mkdirSync, mkdtempSync, rmSync } = require('node:fs');
const { join, resolve, sep } = require('node:path');
const { Chess } = require('chess.js');

const root = join(__dirname, '..');
const electronExe = require('electron');
const artifactsDir = join(root, 'artifacts');

(async () => {
  mkdirSync(artifactsDir, { recursive: true });
  const userDataDir = mkdtempSync(join(artifactsDir, 'e2e-profile-'));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const electron = await _electron.launch({
    executablePath: electronExe,
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: root,
    env,
    timeout: 30000,
  });
  try {
    const actualUserData = await electron.evaluate(({ app }) => app.getPath('userData'));
    if (resolve(actualUserData).toLowerCase() !== resolve(userDataDir).toLowerCase()) {
      throw new Error(`End-to-end test did not isolate app data: ${actualUserData}`);
    }
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
    await page.getByRole('button', { name: 'Open workspace' }).click();

    await page.getByRole('gridcell', { name: 'e2 white p' }).click();
    await page.getByRole('gridcell', { name: 'e4' }).click();
    await page.getByRole('gridcell', { name: 'e4 white p' }).waitFor();
    await page.getByRole('button', { name: 'Undo turn' }).waitFor({ state: 'visible' });
    try {
      await page.waitForFunction(() => document.querySelectorAll('[aria-label="Move history"] .move-chip').length >= 2, null, { timeout: 30000 });
    } catch (error) {
      console.error('Engine reply diagnostics:', await page.evaluate(async () => ({
        status: document.querySelector('.topbar-status')?.textContent,
        hint: document.querySelector('.board-hint-card')?.textContent,
        moves: document.querySelectorAll('[aria-label="Move history"] .move-chip').length,
        moveCount: document.querySelector('.move-count')?.textContent,
        moveList: document.querySelector('[aria-label="Move history"]')?.textContent,
        boardE2: document.querySelector('[aria-label="e2"]')?.getAttribute('aria-label'),
        boardE4: document.querySelector('[aria-label^="e4"]')?.getAttribute('aria-label'),
        engine: await window.chessTrainer.getEngineStatus(),
      })));
      console.error('Renderer errors:', errors);
      throw error;
    }
    await page.locator('#move-history-panel').scrollIntoViewIfNeeded();
    const hintVisibility = await page.locator('.board-hint-card').evaluate((card) => {
      const rect = card.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, viewport: window.innerHeight };
    });
    if (hintVisibility.top < 0 || hintVisibility.bottom > hintVisibility.viewport) throw new Error(`Hint action not visible beside the board: ${JSON.stringify(hintVisibility)}`);
    await page.getByRole('button', { name: 'Show hint' }).click();
    await page.waitForFunction(() => document.querySelector('.topbar-status div span')?.textContent?.includes('Position analyzed'), null, { timeout: 30000 });
    await page.locator('.board-hint-copy').getByText(/Best move:/).waitFor();
    await page.screenshot({ path: join(root, 'artifacts', 'desktop-hint.png') });
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
    await page.getByRole('button', { name: 'Replay moves (4)' }).waitFor();
    const boardGeometry = () => page.evaluate(() => {
      const column = document.querySelector('.board-column').getBoundingClientRect();
      const board = document.querySelector('.chessboard').getBoundingClientRect();
      const strip = document.querySelector('.opponent-strip').getBoundingClientRect();
      const hint = document.querySelector('.board-hint-card').getBoundingClientRect();
      const inspector = document.querySelector('.board-ideas-toolbar').getBoundingClientRect();
      const actions = document.querySelector('.history-opponent-actions')?.getBoundingClientRect();
      return { offset: board.top - column.top, width: board.width, strip: strip.height, hint: hint.height, inspector: inspector.height, actionsFit: !actions || actions.right <= strip.right + 1 };
    });
    const liveBoard = await boardGeometry();
    await page.locator('.move-chip[title="View position after e4"]').click();
    await page.getByRole('gridcell', { name: 'd7 black p' }).waitFor();
    const historyBoard = await boardGeometry();
    if (Math.abs(historyBoard.offset - liveBoard.offset) > 2 || Math.abs(historyBoard.width - liveBoard.width) > 1 || !historyBoard.actionsFit) {
      throw new Error(`Entering replay shifted or resized the board: ${JSON.stringify({ liveBoard, historyBoard })}`);
    }
    await page.screenshot({ path: join(root, 'artifacts', 'desktop-replay-stable.png') });
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Next move' }).click();
    await page.getByRole('gridcell', { name: 'd5 black p' }).waitFor();
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Previous move' }).click();
    await page.getByRole('gridcell', { name: 'd7 black p' }).waitFor();
    const steppedBoard = await boardGeometry();
    if (Math.abs(steppedBoard.offset - liveBoard.offset) > 2 || Math.abs(steppedBoard.width - liveBoard.width) > 1) {
      throw new Error(`Stepping backward shifted or resized the board: ${JSON.stringify({ liveBoard, steppedBoard })}`);
    }
    await page.locator('.history-speed-control').getByRole('button', { name: '2×' }).click();
    if (await page.locator('.history-speed-control').getByRole('button', { name: '2×' }).getAttribute('aria-pressed') !== 'true') {
      throw new Error('Replay speed did not switch to 2×');
    }
    await page.locator('.history-replay-options').getByRole('button', { name: 'Focus replay' }).click();
    await page.locator('.app-shell[data-replay-focus="true"] .history-panel').waitFor();
    if (await page.locator('.side-column > :visible').count() !== 1 || await page.locator('#coach-game-library').count() !== 0) {
      throw new Error('Focused replay did not hide coach and library panels');
    }
    await page.screenshot({ path: join(root, 'artifacts', 'desktop-replay-focus.png') });
    await page.locator('.history-replay-options').getByRole('button', { name: 'Exit focus' }).click();
    await page.locator('#coach-game-library').waitFor();
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Play moves' }).click();
    await page.getByRole('gridcell', { name: 'd5 black p' }).waitFor();
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Pause replay' }).click();
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Replay from start' }).click();
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Pause replay' }).click();
    await page.locator('.move-chip[title="View position after d5"]').click();
    await page.getByText('History mode').waitFor();
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Fork & play' }).click();
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
    await page.setViewportSize({ width: 1500, height: 760 });
    const compactBoard = await page.evaluate(() => {
      const square = document.querySelector('.board-square');
      const piece = square.querySelector('.piece');
      const controls = document.querySelector('.history-playback-actions');
      const previous = controls.querySelector('.history-step-button');
      return {
        pieceRatio: parseFloat(getComputedStyle(piece).fontSize) / square.getBoundingClientRect().width,
        stepWidth: previous.getBoundingClientRect().width,
        controlsWidth: controls.getBoundingClientRect().width,
      };
    });
    if (compactBoard.pieceRatio > 0.77 || compactBoard.stepWidth < 110 || compactBoard.stepWidth > compactBoard.controlsWidth) {
      throw new Error(`Compact desktop board or replay controls are mis-sized: ${JSON.stringify(compactBoard)}`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: join(root, 'artifacts', 'desktop-review-1500.png') });
    for (const width of [1100, 900]) {
      await page.setViewportSize({ width, height: 760 });
      const layout = await page.evaluate(() => {
        const board = document.querySelector('.board-column').getBoundingClientRect();
        const side = document.querySelector('.side-column').getBoundingClientRect();
        const frame = document.querySelector('.board-frame').getBoundingClientRect();
        const square = document.querySelector('.board-square');
        const piece = square.querySelector('.piece');
        const pieceRatio = parseFloat(getComputedStyle(piece).fontSize) / square.getBoundingClientRect().width;
        return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, boardBottom: board.bottom, sideTop: side.top, frameWidth: frame.width, pieceRatio };
      });
      if (layout.scrollWidth > layout.viewport + 1 || layout.sideTop < layout.boardBottom - 1 || layout.frameWidth < 400 || layout.pieceRatio > 0.77) {
        throw new Error(`Resized review layout is broken at ${width}px: ${JSON.stringify(layout)}`);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: join(root, 'artifacts', `desktop-review-${width}.png`) });
    }
    await page.setViewportSize({ width: 1100, height: 760 });
    await page.getByRole('button', { name: 'New game' }).click();
    const newGameLayout = await page.evaluate(() => {
      const board = document.querySelector('.board-column');
      const side = document.querySelector('.side-column');
      return { position: getComputedStyle(board).position, boardBottom: board.getBoundingClientRect().bottom, sideTop: side.getBoundingClientRect().top };
    });
    if (newGameLayout.position !== 'static' || newGameLayout.sideTop < newGameLayout.boardBottom - 1) {
      throw new Error(`New-game board overlaps panels in resized window: ${JSON.stringify(newGameLayout)}`);
    }
    await page.getByRole('button', { name: 'Open workspace' }).waitFor();
    await page.setViewportSize({ width: 1780, height: 1074 });
    const newGameDesktop = await page.evaluate(() => {
      const board = document.querySelector('.chessboard').getBoundingClientRect();
      return { width: board.width, bottom: board.bottom, viewportHeight: innerHeight, scrollY };
    });
    if (newGameDesktop.width > newGameDesktop.viewportHeight - 460 || newGameDesktop.bottom > newGameDesktop.viewportHeight + 5) {
      throw new Error(`New-game board is too large for the desktop window: ${JSON.stringify(newGameDesktop)}`);
    }
    await page.screenshot({ path: join(root, 'artifacts', 'desktop-new-game.png') });
    await page.setViewportSize({ width: 1300, height: 980 });
    const boardBeforeMove = await page.locator('.chessboard').evaluate((board) => board.getBoundingClientRect().width);
    await page.getByRole('gridcell', { name: 'e2 white p' }).click();
    await page.getByRole('gridcell', { name: 'e4' }).click();
    await page.locator('.board-column.review-board-column').waitFor();
    const boardAfterMove = await page.locator('.chessboard').evaluate((board) => board.getBoundingClientRect().width);
    if (Math.abs(boardAfterMove - boardBeforeMove) > 2) {
      throw new Error(`First move resized the board at 1300px: ${JSON.stringify({ boardBeforeMove, boardAfterMove })}`);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    const firstMoveBounds = await page.locator('.chessboard').evaluate((board) => ({ bottom: board.getBoundingClientRect().bottom, viewportHeight: innerHeight }));
    if (firstMoveBounds.bottom > firstMoveBounds.viewportHeight + 5) {
      throw new Error(`First-move board is clipped at 1300px: ${JSON.stringify(firstMoveBounds)}`);
    }
    await page.screenshot({ path: join(root, 'artifacts', 'desktop-first-move-1300.png') });
    await page.getByRole('button', { name: 'New game' }).click();
    await page.setViewportSize({ width: 1100, height: 760 });
    await page.getByRole('button', { name: 'Open saved games' }).click();
    const importedCard = page.locator('#coach-game-library .game-library-card').filter({ hasText: 'You – Stockfish' }).first();
    await importedCard.getByRole('button', { name: 'Open', exact: true }).click();
    await page.locator('#move-history-panel .move-count').getByText('4 plies').waitFor();
    await page.screenshot({ path: join(root, 'artifacts', 'playwright-smoke.png'), fullPage: true });
    await page.getByRole('button', { name: 'Import PGN / FEN' }).click();
    await page.locator('.import-textarea').fill('[Event "Stockfish Coach mobile"]\n[White "You"]\n[Black "Stockfish"]\n[Result "*"]\n\n1. e4 d5 2. Nc3 d4');
    await page.getByRole('checkbox', { name: 'Analyze the full game immediately' }).check();
    await page.getByRole('button', { name: 'Import & review' }).click();
    await page.locator('.review-batch-progress').waitFor({ state: 'visible' });
    await page.locator('.move-chip[title="View position after e4"]').click();
    await page.getByRole('gridcell', { name: 'd7 black p' }).waitFor();
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Play moves' }).click();
    await page.getByRole('gridcell', { name: 'd5 black p' }).waitFor();
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Pause replay' }).click();
    await page.locator('.review-batch-progress').waitFor({ state: 'hidden', timeout: 30000 });
    await page.locator('.move-chip[title="View position after e4"]').click();
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Fork & play' }).click();
    await page.locator('.current-line-card').getByText('Variation 1').waitFor();
    const longGame = new Chess();
    for (let index = 0; index < 15; index += 1) {
      for (const san of ['Nf3', 'Nf6', 'Ng1', 'Ng8']) longGame.move(san);
    }
    await page.getByRole('button', { name: 'Import PGN / FEN' }).click();
    await page.locator('.import-textarea').fill(longGame.pgn());
    await page.getByRole('button', { name: 'Import game', exact: true }).click();
    await page.locator('#move-history-panel .move-count').getByText('60 plies').waitFor();
    await page.locator('.move-list').evaluate((list) => { list.scrollTop = 0; });
    await page.locator('.history-playback-actions').getByRole('button', { name: 'Previous move' }).click();
    const followedMove = await page.locator('.move-list').evaluate((list) => {
      const selected = list.querySelector('.move-chip.viewed');
      const listBounds = list.getBoundingClientRect();
      const selectedBounds = selected.getBoundingClientRect();
      return { scrollTop: list.scrollTop, scrollHeight: list.scrollHeight, clientHeight: list.clientHeight, ply: selected.dataset.ply, top: selectedBounds.top - listBounds.top, bottom: selectedBounds.bottom - listBounds.top, listHeight: listBounds.height, visible: selectedBounds.top >= listBounds.top && selectedBounds.bottom <= listBounds.bottom };
    });
    if (followedMove.ply !== '59' || !followedMove.visible || followedMove.scrollTop <= 0) {
      throw new Error(`Move list did not auto-follow selected ply: ${JSON.stringify(followedMove)}`);
    }
    if (errors.length) throw new Error(`Renderer errors: ${errors.join('; ')}`);
    console.log(JSON.stringify({ pass: true, squares, engine: status, interactions: ['e2-e4', 'Stockfish reply', 'visible board hint and analysis', 'history start/latest', 'new game', 'mobile PGN import', 'move playback', 'navigation during full-game review', 'variation from historical move', 'return to original game'], screenshots: ['artifacts/desktop-hint.png', 'artifacts/playwright-smoke.png'] }));
  } finally {
    await electron.close();
    if (resolve(userDataDir).startsWith(resolve(artifactsDir) + sep)) {
      rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
