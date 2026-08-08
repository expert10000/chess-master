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
