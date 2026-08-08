import { app } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { access, readdir } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { SettingsStore } from '../settings.js';
import { parseBestMove, parseInfoLine } from './uciParser.js';

export interface EngineStrength {
  limit: boolean;
  elo?: number;
}

export interface AnalyseRequest {
  fen: string;
  movetimeMs: number;
  multiPv: number;
  strength?: EngineStrength;
  searchMoves?: string[];
}

export interface EngineLine {
  multipv: number;
  depth: number;
  scoreCp: number | null;
  mate: number | null;
  pv: string[];
}

export interface AnalyseResult {
  bestMove: string | null;
  ponder: string | null;
  lines: EngineLine[];
  elapsedMs: number;
  engineName: string | null;
}

export interface EngineStatus {
  configured: boolean;
  running: boolean;
  path: string | null;
  engineName: string | null;
  error: string | null;
}

type LineListener = (line: string) => void;

export class StockfishService {
  private process: ChildProcessWithoutNullStreams | null = null;
  private listeners = new Set<LineListener>();
  private startPromise: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private analysisGeneration = 0;
  private configuredPath: string | null = null;
  private engineName: string | null = null;
  private lastError: string | null = null;
  private stdoutBuffer = '';

  constructor(private readonly settings: SettingsStore) {}

  async initialize(): Promise<void> {
    this.configuredPath = await this.resolveEnginePath();
  }

  getStatus(): EngineStatus {
    return {
      configured: Boolean(this.configuredPath),
      running: Boolean(this.process && !this.process.killed),
      path: this.configuredPath,
      engineName: this.engineName,
      error: this.lastError,
    };
  }

  async setExecutable(executablePath: string): Promise<void> {
    await access(executablePath);
    await this.stop();
    this.configuredPath = executablePath;
    this.lastError = null;
    await this.settings.setStockfishPath(executablePath);
    await this.start();
  }

  async analyse(request: AnalyseRequest): Promise<AnalyseResult> {
    const generation = this.analysisGeneration;
    return this.enqueue(async () => {
      if (generation !== this.analysisGeneration) throw new Error('Stockfish analysis cancelled.');
      await this.start();
      if (generation !== this.analysisGeneration) throw new Error('Stockfish analysis cancelled.');
      const result = await this.runSearch(request);
      if (generation !== this.analysisGeneration) throw new Error('Stockfish analysis cancelled.');
      return result;
    });
  }

  cancelAnalysis(): void {
    this.analysisGeneration += 1;
    try {
      if (this.process?.stdin.writable) this.write('stop');
    } catch {
      // The engine may already have completed or exited.
    }
  }

  async stop(): Promise<void> {
    this.analysisGeneration += 1;
    if (!this.process) return;
    try {
      this.write('quit');
    } catch {
      // Process may already be gone.
    }
    this.process.kill();
    this.process = null;
    this.startPromise = null;
    this.engineName = null;
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async start(): Promise<void> {
    if (this.process && !this.process.killed) return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null;
    });
    return this.startPromise;
  }

  private async startInternal(): Promise<void> {
    if (!this.configuredPath) {
      this.configuredPath = await this.resolveEnginePath();
    }
    if (!this.configuredPath) {
      throw new Error('Stockfish is not configured. Choose the Stockfish executable first.');
    }

    this.lastError = null;
    this.stdoutBuffer = '';

    const child = spawn(this.configuredPath, [], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this.process = child;
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => this.consumeStdout(chunk));
    child.stderr.on('data', (chunk: string) => {
      const message = chunk.trim();
      if (message) this.lastError = message;
    });
    child.on('error', (error) => {
      this.lastError = error.message;
      this.process = null;
    });
    child.on('exit', (code, signal) => {
      if (code !== 0 && signal !== 'SIGTERM') {
        this.lastError = `Stockfish exited with code ${String(code)} (${String(signal)}).`;
      }
      this.process = null;
      this.startPromise = null;
    });

    const uciReady = this.waitForLine((line) => line === 'uciok', 8_000);
    this.write('uci');
    await uciReady;

    const ready = this.waitForLine((line) => line === 'readyok', 8_000);
    this.write('isready');
    await ready;
  }

  private async runSearch(request: AnalyseRequest): Promise<AnalyseResult> {
    const started = Date.now();
    const sideToMove = request.fen.split(/\s+/)[1] === 'b' ? -1 : 1;
    const latest = new Map<number, EngineLine>();

    this.write('setoption name Threads value 2');
    this.write('setoption name Hash value 128');
    this.write(`setoption name MultiPV value ${request.multiPv}`);

    if (request.strength?.limit) {
      this.write('setoption name UCI_LimitStrength value true');
      this.write(`setoption name UCI_Elo value ${request.strength.elo ?? 1800}`);
    } else {
      this.write('setoption name UCI_LimitStrength value false');
      this.write('setoption name Skill Level value 20');
    }

    const ready = this.waitForLine((line) => line === 'readyok', 8_000);
    this.write('isready');
    await ready;

    this.write(`position fen ${request.fen}`);

    const result = await new Promise<AnalyseResult>((resolvePromise, rejectPromise) => {
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.listeners.delete(onLine);
        this.write('stop');
        rejectPromise(new Error('Stockfish analysis timed out.'));
      }, request.movetimeMs + 12_000);

      const finish = (bestMove: string | null, ponder: string | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        this.listeners.delete(onLine);
        resolvePromise({
          bestMove,
          ponder,
          lines: [...latest.values()].sort((a, b) => a.multipv - b.multipv),
          elapsedMs: Date.now() - started,
          engineName: this.engineName,
        });
      };

      const onLine: LineListener = (line) => {
        if (line.startsWith('id name ')) {
          this.engineName = line.slice('id name '.length).trim();
        }

        const info = parseInfoLine(line);
        if (info) {
          const previous = latest.get(info.multipv);
          latest.set(info.multipv, {
            multipv: info.multipv,
            depth: info.depth ?? previous?.depth ?? 0,
            scoreCp:
              info.scoreCp === undefined
                ? previous?.scoreCp ?? null
                : info.scoreCp * sideToMove,
            mate:
              info.mate === undefined
                ? previous?.mate ?? null
                : info.mate * sideToMove,
            pv: info.pv ?? previous?.pv ?? [],
          });
        }

        const best = parseBestMove(line);
        if (best) finish(best.bestMove, best.ponder);
      };

      this.listeners.add(onLine);

      const searchMoves = request.searchMoves?.length
        ? ` searchmoves ${request.searchMoves.join(' ')}`
        : '';
      this.write(`go movetime ${request.movetimeMs}${searchMoves}`);
    });

    return result;
  }

  private consumeStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop() ?? '';

    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith('id name ')) this.engineName = line.slice(8).trim();
      for (const listener of [...this.listeners]) listener(line);
    }
  }

  private waitForLine(predicate: (line: string) => boolean, timeoutMs: number): Promise<string> {
    return new Promise((resolvePromise, rejectPromise) => {
      const timer = setTimeout(() => {
        this.listeners.delete(listener);
        rejectPromise(new Error('Timed out while waiting for Stockfish.'));
      }, timeoutMs);

      const listener: LineListener = (line) => {
        if (!predicate(line)) return;
        clearTimeout(timer);
        this.listeners.delete(listener);
        resolvePromise(line);
      };
      this.listeners.add(listener);
    });
  }

  private write(command: string): void {
    if (!this.process?.stdin.writable) {
      throw new Error('Stockfish process is not running.');
    }
    this.process.stdin.write(`${command}\n`);
  }

  private async resolveEnginePath(): Promise<string | null> {
    const stored = await this.settings.read();
    const candidates = [
      process.env.STOCKFISH_PATH,
      stored.stockfishPath,
      join(app.getAppPath(), 'resources', 'stockfish', process.platform === 'win32' ? 'stockfish.exe' : 'stockfish'),
      join(process.resourcesPath, 'stockfish', process.platform === 'win32' ? 'stockfish.exe' : 'stockfish'),
    ].filter((candidate): candidate is string => Boolean(candidate));

    for (const candidate of candidates) {
      try {
        await access(candidate);
        return resolve(candidate);
      } catch {
        // Try the next candidate.
      }
    }

    const folders = [
      join(app.getAppPath(), 'resources', 'stockfish'),
      join(process.resourcesPath, 'stockfish'),
    ];

    for (const folder of folders) {
      try {
        const files = await readdir(folder);
        const match = files.find((file) => {
          const lower = basename(file).toLowerCase();
          return lower.startsWith('stockfish') && (process.platform !== 'win32' || lower.endsWith('.exe'));
        });
        if (match) return join(folder, match);
      } catch {
        // Folder is optional.
      }
    }

    return null;
  }
}
