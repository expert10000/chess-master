export interface ParsedInfoLine {
  depth?: number;
  multipv: number;
  scoreCp?: number;
  mate?: number;
  pv?: string[];
}

export function parseInfoLine(line: string): ParsedInfoLine | null {
  if (!line.startsWith('info ')) return null;

  const depthMatch = line.match(/\bdepth\s+(\d+)/);
  const multipvMatch = line.match(/\bmultipv\s+(\d+)/);
  const scoreMatch = line.match(/\bscore\s+(cp|mate)\s+(-?\d+)/);
  const pvMatch = line.match(/\bpv\s+(.+)$/);

  if (!scoreMatch && !pvMatch) return null;

  const parsed: ParsedInfoLine = {
    multipv: multipvMatch ? Number(multipvMatch[1]) : 1,
  };

  if (depthMatch) parsed.depth = Number(depthMatch[1]);
  if (scoreMatch?.[1] === 'cp') parsed.scoreCp = Number(scoreMatch[2]);
  if (scoreMatch?.[1] === 'mate') parsed.mate = Number(scoreMatch[2]);
  if (pvMatch) parsed.pv = pvMatch[1].trim().split(/\s+/);

  return parsed;
}

export function parseBestMove(line: string): { bestMove: string | null; ponder: string | null } | null {
  const match = line.match(/^bestmove\s+(\S+)(?:\s+ponder\s+(\S+))?/);
  if (!match) return null;
  return {
    bestMove: match[1] === '(none)' ? null : match[1],
    ponder: match[2] ?? null,
  };
}
