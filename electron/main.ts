import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { join } from 'node:path';
import { SettingsStore } from './settings.js';
import { OllamaService, type OllamaGenerateRequest } from './ollama/OllamaService.js';
import {
  StockfishService,
  type AnalyseRequest,
  type EngineStrength,
} from './stockfish/StockfishService.js';

const projectRoot = join(__dirname, '..');
const settings = new SettingsStore();
const stockfish = new StockfishService(settings);
const ollama = new OllamaService();

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function validateStrength(input: unknown): EngineStrength | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const value = input as Record<string, unknown>;
  const limit = value.limit === true;
  if (!limit) return { limit: false };
  const elo = clamp(Number(value.elo ?? 1800), 1320, 3190);
  return { limit: true, elo };
}

function validateAnalyseRequest(input: unknown): AnalyseRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid analysis request.');
  const value = input as Record<string, unknown>;
  if (typeof value.fen !== 'string' || value.fen.length < 10 || value.fen.length > 200) {
    throw new Error('Invalid FEN.');
  }

  const searchMoves = Array.isArray(value.searchMoves)
    ? value.searchMoves
        .filter((move): move is string => typeof move === 'string' && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move))
        .slice(0, 10)
    : undefined;

  return {
    fen: value.fen,
    movetimeMs: clamp(Number(value.movetimeMs ?? 750), 50, 10_000),
    multiPv: clamp(Number(value.multiPv ?? 1), 1, 5),
    strength: validateStrength(value.strength),
    searchMoves,
  };
}


function validateOllamaGenerateRequest(input: unknown): OllamaGenerateRequest {
  if (!input || typeof input !== 'object') throw new Error('Invalid Ollama request.');
  const value = input as Record<string, unknown>;
  const model = typeof value.model === 'string' ? value.model.trim() : '';
  const system = typeof value.system === 'string' ? value.system.trim() : '';
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : '';

  if (!model || model.length > 160 || !/^[A-Za-z0-9_.:/-]+$/.test(model)) {
    throw new Error('Invalid Ollama model name.');
  }
  if (!system || system.length > 12_000) throw new Error('Invalid Ollama system prompt.');
  if (!prompt || prompt.length > 24_000) throw new Error('Invalid Ollama prompt.');
  return { model, system, prompt };
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1050,
    minHeight: 720,
    backgroundColor: '#10141c',
    title: 'Stockfish Coach',
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.once('ready-to-show', () => window.show());

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    void window.loadURL(devServer);
    window.webContents.openDevTools({ mode: 'detach' });
  } else {
    void window.loadFile(join(projectRoot, 'dist', 'index.html'));
  }

  return window;
}

ipcMain.handle('engine:status', () => stockfish.getStatus());


ipcMain.handle('ollama:status', () => ollama.getStatus());

ipcMain.handle('ollama:generate', async (_event, input: unknown) => {
  const request = validateOllamaGenerateRequest(input);
  return ollama.generate(request);
});


ipcMain.handle('engine:select', async () => {
  const result = await dialog.showOpenDialog({
    title: 'Choose Stockfish executable',
    properties: ['openFile'],
    filters:
      process.platform === 'win32'
        ? [{ name: 'Executables', extensions: ['exe'] }, { name: 'All files', extensions: ['*'] }]
        : [{ name: 'All files', extensions: ['*'] }],
  });

  if (!result.canceled && result.filePaths[0]) {
    await stockfish.setExecutable(result.filePaths[0]);
  }
  return stockfish.getStatus();
});

ipcMain.handle('engine:analyse', async (_event, input: unknown) => {
  const request = validateAnalyseRequest(input);
  return stockfish.analyse(request);
});

ipcMain.handle('engine:cancel', () => {
  stockfish.cancelAnalysis();
});

app.whenReady().then(async () => {
  await stockfish.initialize();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void stockfish.stop();
});
