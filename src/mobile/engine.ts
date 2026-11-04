import { parseBestMove, parseInfoLine } from '../../electron/stockfish/uciParser';

export interface MobileLine {
  move: string;
  depth: number;
  scoreCp: number | null;
  mate: number | null;
  pv: string[];
}

export interface MobileAnalysis {
  bestMove: string;
  depth: number;
  scoreCp: number | null;
  mate: number | null;
  lines: MobileLine[];
  alternatives: MobileLine[];
  elapsedMs: number;
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
  private latestLines = new Map<number, MobileLine>();
  private searchStartedAt = 0;
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
    if (info?.pv?.length && (info.scoreCp !== undefined || info.mate !== undefined) && !/\b(?:lowerbound|upperbound)\b/.test(line)) {
      const previous = this.latestLines.get(info.multipv);
      const depth = info.depth ?? 0;
      if (depth >= (previous?.depth ?? 0)) {
        this.latestLines.set(info.multipv, {
          move: info.pv[0],
          depth,
          scoreCp: info.scoreCp ?? null,
          mate: info.mate ?? null,
          pv: info.pv,
        });
      }
    }
    const best = parseBestMove(line);
    if (best && this.pendingResult) {
      const resolve = this.pendingResult;
      this.pendingResult = null;
      this.pendingError = null;
      const ranked = [...this.latestLines.entries()].sort(([a], [b]) => a - b);
      const first = this.latestLines.get(1);
      resolve({
        bestMove: best.bestMove ?? '',
        depth: first?.depth ?? 0,
        scoreCp: first?.scoreCp ?? null,
        mate: first?.mate ?? null,
        lines: ranked.map(([, candidate]) => candidate),
        alternatives: ranked.filter(([rank]) => rank > 1).map(([, candidate]) => candidate),
        elapsedMs: Math.max(0, Math.round(performance.now() - this.searchStartedAt)),
      });
    }
  }

  async waitUntilReady(): Promise<void> {
    await this.ready;
  }

  analyse(fen: string, strength: MobileStrength, fullStrength = false, multiPv = 1): Promise<MobileAnalysis> {
    const task = this.queue.then(async () => {
      await this.ready;
      this.latestLines.clear();
      this.worker.postMessage(`setoption name UCI_LimitStrength value ${fullStrength ? 'false' : 'true'}`);
      if (!fullStrength) this.worker.postMessage(`setoption name UCI_Elo value ${strength.elo}`);
      this.worker.postMessage(`setoption name MultiPV value ${Math.max(1, Math.min(3, multiPv))}`);
      this.worker.postMessage(`position fen ${fen}`);
      return new Promise<MobileAnalysis>((resolve, reject) => {
        this.pendingResult = resolve;
        this.pendingError = reject;
        this.searchStartedAt = performance.now();
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
