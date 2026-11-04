import { parseBestMove, parseInfoLine } from '../../electron/stockfish/uciParser';

export interface MobileAnalysis {
  bestMove: string;
  depth: number;
  scoreCp: number | null;
  alternatives: { move: string; depth: number; scoreCp: number | null }[];
}

export interface MobileStrength {
  elo: number;
  movetimeMs: number;
}

export class MobileEngine {
  private worker: Worker;
  private ready: Promise<void>;
  private pendingReady: (() => void) | null = null;
  private pendingReadyError: ((error: Error) => void) | null = null;
  private pendingResult: ((result: MobileAnalysis) => void) | null = null;
  private pendingError: ((error: Error) => void) | null = null;
  private latestDepth = 0;
  private latestScore: number | null = null;
  private latestLines = new Map<number, { move: string; depth: number; scoreCp: number | null }>();
  private queue: Promise<unknown> = Promise.resolve();

  constructor() {
    this.worker = new Worker(new URL('engine/stockfish-19-lite-single.js', document.baseURI));
    this.worker.onmessage = (event: MessageEvent<string>) => {
      for (const line of String(event.data).split(/\r?\n/)) this.receive(line.trim());
    };
    this.worker.onerror = (event) => {
      const error = new Error(event.message || 'Stockfish could not start.');
      this.pendingReadyError?.(error);
      this.pendingReadyError = null;
      this.pendingError?.(error);
      this.pendingResult = null;
      this.pendingError = null;
    };
    this.ready = new Promise((resolve, reject) => { this.pendingReady = resolve; this.pendingReadyError = reject; });
    this.worker.postMessage('uci');
  }

  private receive(line: string): void {
    if (line === 'uciok') {
      this.pendingReady?.();
      this.pendingReady = null;
      this.pendingReadyError = null;
      return;
    }
    const info = parseInfoLine(line);
    if (info?.pv?.length) {
      const previous = this.latestLines.get(info.multipv);
      this.latestLines.set(info.multipv, {
        move: info.pv[0],
        depth: info.depth ?? previous?.depth ?? 0,
        scoreCp: info.scoreCp ?? previous?.scoreCp ?? null,
      });
      if (info.multipv === 1) {
        this.latestDepth = info.depth ?? this.latestDepth;
        this.latestScore = info.scoreCp ?? this.latestScore;
      }
    }
    const best = parseBestMove(line);
    if (best && this.pendingResult) {
      const resolve = this.pendingResult;
      this.pendingResult = null;
      this.pendingError = null;
      resolve({
        bestMove: best.bestMove ?? '',
        depth: this.latestDepth,
        scoreCp: this.latestScore,
        alternatives: [...this.latestLines.entries()]
          .filter(([rank]) => rank > 1)
          .sort(([a], [b]) => a - b)
          .map(([, candidate]) => candidate),
      });
    }
  }

  async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  analyse(fen: string, strength: MobileStrength, fullStrength = false, multiPv = 1): Promise<MobileAnalysis> {
    const task = this.queue.then(async () => {
      await this.ready;
      this.latestDepth = 0;
      this.latestScore = null;
      this.latestLines.clear();
      this.worker.postMessage(`setoption name UCI_LimitStrength value ${fullStrength ? 'false' : 'true'}`);
      if (!fullStrength) this.worker.postMessage(`setoption name UCI_Elo value ${strength.elo}`);
      this.worker.postMessage(`setoption name MultiPV value ${Math.max(1, Math.min(3, multiPv))}`);
      this.worker.postMessage(`position fen ${fen}`);
      return new Promise<MobileAnalysis>((resolve, reject) => {
        this.pendingResult = resolve;
        this.pendingError = reject;
        this.worker.postMessage(`go movetime ${strength.movetimeMs}`);
      });
    });
    this.queue = task.catch(() => undefined);
    return task;
  }

  stop(): void {
    this.worker.postMessage('stop');
  }

  dispose(): void {
    this.worker.terminate();
  }
}
