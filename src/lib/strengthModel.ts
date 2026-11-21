import type { GameAnalyticsSummary } from './gameAnalytics';
import type { GameLibraryMemory } from './gameLibrary';
import type { SkillAssessment, SkillMapMemory } from './skillMap';

export interface StrengthEstimate {
  id: string;
  label: string;
  score: number | null;
  confidence: 'low' | 'emerging' | 'grounded';
  evidence: string;
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function strengthModel(skills: SkillMapMemory, games: GameAnalyticsSummary): StrengthEstimate[] {
  const tactical = skills.skills['tactical-vision'];
  const calculation = skills.skills.calculation;
  const opening = skills.skills['opening-development'];
  const conversion = skills.skills.conversion;
  const phase = (name: 'opening' | 'middlegame' | 'endgame') => games.current.phases.find((p) => p.phase === name);
  const from = (skill: SkillAssessment, label: string, phaseCpl: number | null): StrengthEstimate => ({
    id: skill.id,
    label,
    score: skill.evidenceCount ? clamp(100 - (skill.priority * 3) - (phaseCpl ?? 55) * .35) : null,
    confidence: skill.confidence,
    evidence: skill.evidence,
  });
  const phaseRows = (['opening', 'middlegame', 'endgame'] as const).map((id): StrengthEstimate => {
    const p = phase(id);
    const n = p?.reviewedMoves ?? 0;
    const cpl = p?.avgCpl;
    return {
      id: `phase-${id}`,
      label: `${id[0].toUpperCase() + id.slice(1)} CPL`,
      score: cpl == null ? null : clamp(100 - cpl * .55),
      confidence: n >= 40 ? 'grounded' : n >= 12 ? 'emerging' : 'low',
      evidence: `${n} reviewed ${id} moves · ${cpl == null ? '—' : `${Math.round(cpl)} CPL`}`,
    };
  });
  return [
    from(tactical, 'Tactical consistency', phase('middlegame')?.avgCpl ?? null),
    from(opening, 'Opening stability', phase('opening')?.avgCpl ?? null),
    from(conversion, 'Endgame conversion', phase('endgame')?.avgCpl ?? null),
    from(calculation, 'Calculation quality', phase('middlegame')?.avgCpl ?? null),
    ...phaseRows,
  ];
}

export function monthlyStrengthHistory(memory: GameLibraryMemory) {
  const map = new Map<string, { cpl: number; weighted: number }>();
  for (const game of memory.entries) {
    if (game.archived || game.modelGame || game.averageCpl === null) continue;
    const key = new Date(game.createdAt).toISOString().slice(0, 7);
    const old = map.get(key) ?? { cpl: 0, weighted: 0 };
    old.cpl += game.averageCpl * game.reviewedHumanMoves;
    old.weighted += game.reviewedHumanMoves;
    map.set(key, old);
  }
  return [...map].sort(([a], [b]) => a.localeCompare(b)).slice(-6).map(([month, v]) => ({
    month,
    score: v.weighted ? clamp(100 - v.cpl / v.weighted * .55) : null,
  }));
}
