import type { GameAnalyticsSummary } from './gameAnalytics';
import { weaknessProfileRows, type WeaknessMemory } from './weaknessProfile';

export const SKILL_MAP_STORAGE_KEY = 'stockfish-coach.skill-map.v1';

export type ChessSkillId =
  | 'opening-development' | 'king-safety' | 'tactical-vision' | 'calculation'
  | 'pawn-structure' | 'piece-activity' | 'endgames' | 'conversion';

export interface SkillAssessment {
  id: ChessSkillId;
  label: string;
  evidence: string;
  evidenceCount: number;
  confidence: 'low' | 'emerging' | 'grounded';
  trend: 'improving' | 'declining' | 'stable' | 'collecting';
  recommendation: string;
  trainingTarget: 'coach-opening-memory' | 'coach-weakness-profile' | 'coach-game-analytics' | 'coach-daily-study';
  priority: number;
}

export interface SkillMapMemory {
  version: 1;
  evidenceSignature: string;
  updatedAt: number;
  skills: Record<ChessSkillId, SkillAssessment>;
}

const DEFINITIONS: Array<Omit<SkillAssessment, 'evidence' | 'evidenceCount' | 'confidence' | 'trend' | 'priority'>> = [
  { id: 'opening-development', label: 'Opening development', recommendation: 'Review due repertoire and train development deviations.', trainingTarget: 'coach-opening-memory' },
  { id: 'king-safety', label: 'King safety', recommendation: 'Train your stored king-safety positions.', trainingTarget: 'coach-weakness-profile' },
  { id: 'tactical-vision', label: 'Tactical vision', recommendation: 'Train missed tactical opportunities from reviewed games.', trainingTarget: 'coach-weakness-profile' },
  { id: 'calculation', label: 'Calculation', recommendation: 'Work through tactical and hanging-piece positions before revealing the answer.', trainingTarget: 'coach-daily-study' },
  { id: 'pawn-structure', label: 'Pawn structure', recommendation: 'Train structural decisions from your reviewed games.', trainingTarget: 'coach-weakness-profile' },
  { id: 'piece-activity', label: 'Piece activity', recommendation: 'Review middlegame evidence and train the next activity-related position.', trainingTarget: 'coach-game-analytics' },
  { id: 'endgames', label: 'Endgames', recommendation: 'Review endgame evidence, then add and train endgame positions.', trainingTarget: 'coach-game-analytics' },
  { id: 'conversion', label: 'Conversion', recommendation: 'Use endgame reviews to practise turning advantages into results.', trainingTarget: 'coach-game-analytics' },
];

function category(memory: WeaknessMemory, id: string) {
  return weaknessProfileRows(memory).find((row) => row.id === id);
}

function confidence(evidenceCount: number): SkillAssessment['confidence'] {
  if (evidenceCount >= 12) return 'grounded';
  if (evidenceCount >= 4) return 'emerging';
  return 'low';
}

function phaseTrend(summary: GameAnalyticsSummary, phase: 'opening' | 'middlegame' | 'endgame'): SkillAssessment['trend'] {
  const trend = summary.current.phases.find((item) => item.phase === phase)?.trend ?? 'n/a';
  return trend === 'n/a' ? 'collecting' : trend;
}

function assessment(
  definition: typeof DEFINITIONS[number],
  weakness: WeaknessMemory,
  games: GameAnalyticsSummary,
): SkillAssessment {
  const development = category(weakness, 'development');
  const opening = category(weakness, 'opening-deviations');
  const king = category(weakness, 'king-safety');
  const tactics = category(weakness, 'missed-tactics');
  const hanging = category(weakness, 'hanging-pieces');
  const pawns = category(weakness, 'pawn-structure');
  let evidenceCount = 0;
  let priority = 0;
  let trend: SkillAssessment['trend'] = 'collecting';
  let evidence = 'No reviewed evidence yet.';

  if (definition.id === 'opening-development') {
    evidenceCount = (development?.occurrences ?? 0) + (opening?.occurrences ?? 0);
    priority = (development?.priority ?? 0) + (opening?.priority ?? 0);
    trend = phaseTrend(games, 'opening');
    evidence = `${evidenceCount} development/opening-deviation observations · ${games.current.games} recent reviewed games`;
  } else if (definition.id === 'king-safety') {
    evidenceCount = king?.occurrences ?? 0; priority = king?.priority ?? 0;
    evidence = `${evidenceCount} king-safety observations`;
  } else if (definition.id === 'tactical-vision') {
    evidenceCount = tactics?.occurrences ?? 0; priority = tactics?.priority ?? 0;
    evidence = `${evidenceCount} missed-tactics observations`;
  } else if (definition.id === 'calculation') {
    evidenceCount = (tactics?.occurrences ?? 0) + (hanging?.occurrences ?? 0);
    priority = (tactics?.priority ?? 0) + (hanging?.priority ?? 0);
    evidence = `${evidenceCount} tactical/loose-piece calculation observations`;
  } else if (definition.id === 'pawn-structure') {
    evidenceCount = pawns?.occurrences ?? 0; priority = pawns?.priority ?? 0;
    evidence = `${evidenceCount} pawn-structure observations`;
  } else if (definition.id === 'piece-activity') {
    evidenceCount = games.current.phases.find((item) => item.phase === 'middlegame')?.reviewedMoves ?? 0;
    priority = games.current.phases.find((item) => item.phase === 'middlegame')?.avgCpl ?? 0;
    trend = phaseTrend(games, 'middlegame');
    evidence = `${evidenceCount} reviewed middlegame moves · ${games.current.phases.find((item) => item.phase === 'middlegame')?.strength ?? 'No data'}`;
  } else {
    evidenceCount = games.current.phases.find((item) => item.phase === 'endgame')?.reviewedMoves ?? 0;
    priority = games.current.phases.find((item) => item.phase === 'endgame')?.avgCpl ?? 0;
    trend = phaseTrend(games, 'endgame');
    evidence = `${evidenceCount} reviewed endgame moves · ${games.current.phases.find((item) => item.phase === 'endgame')?.strength ?? 'No data'}`;
  }
  if (trend === 'collecting' && evidenceCount >= 4) trend = 'stable';
  return { ...definition, evidence, evidenceCount, confidence: confidence(evidenceCount), trend, priority };
}

export function emptySkillMapMemory(): SkillMapMemory {
  const skills = Object.fromEntries(DEFINITIONS.map((definition) => [definition.id, {
    ...definition, evidence: 'No reviewed evidence yet.', evidenceCount: 0, confidence: 'low' as const, trend: 'collecting' as const, priority: 0,
  }])) as Record<ChessSkillId, SkillAssessment>;
  return { version: 1, evidenceSignature: '', updatedAt: 0, skills };
}

export function loadSkillMapMemory(raw: string | null | undefined): SkillMapMemory {
  if (!raw) return emptySkillMapMemory();
  try {
    const parsed = JSON.parse(raw) as Partial<SkillMapMemory>;
    if (parsed.version !== 1 || !parsed.skills) return emptySkillMapMemory();
    return { ...emptySkillMapMemory(), ...parsed, skills: { ...emptySkillMapMemory().skills, ...parsed.skills } };
  } catch { return emptySkillMapMemory(); }
}

export function serializeSkillMapMemory(memory: SkillMapMemory): string { return JSON.stringify(memory); }

export function syncSkillMap(memory: SkillMapMemory, weakness: WeaknessMemory, games: GameAnalyticsSummary, now = Date.now()): SkillMapMemory {
  const signature = `${weakness.reviewedMoves}:${Object.values(weakness.categories).map((item) => `${item.occurrences}/${item.severity}`).join(',')}:${games.availableReviewedGames}:${games.current.reviewedMoves}`;
  if (memory.evidenceSignature === signature) return memory;
  const skills = Object.fromEntries(DEFINITIONS.map((definition) => [definition.id, assessment(definition, weakness, games)])) as Record<ChessSkillId, SkillAssessment>;
  return { version: 1, evidenceSignature: signature, updatedAt: now, skills };
}

export function rankedSkills(memory: SkillMapMemory): SkillAssessment[] {
  return Object.values(memory.skills).slice().sort((a, b) => b.priority - a.priority || a.label.localeCompare(b.label));
}
