import { describe, expect, it } from 'vitest';
import { buildGameAnalyticsSummary } from '../src/lib/gameAnalytics';
import { emptyGameLibraryMemory } from '../src/lib/gameLibrary';
import { emptySkillMapMemory, syncSkillMap } from '../src/lib/skillMap';
import { emptyWeaknessMemory } from '../src/lib/weaknessProfile';

describe('v1.1.2 skill map', () => {
  it('creates all eight persistent curriculum skills even before evidence exists', () => {
    const memory = syncSkillMap(
      emptySkillMapMemory(),
      emptyWeaknessMemory(),
      buildGameAnalyticsSummary(emptyGameLibraryMemory(), 10),
      1,
    );
    expect(Object.keys(memory.skills)).toHaveLength(8);
    expect(memory.skills['king-safety'].confidence).toBe('low');
    expect(memory.skills.endgames.trend).toBe('collecting');
  });

  it('maps recurring tactical observations into tactical-vision and calculation evidence', () => {
    const weakness = emptyWeaknessMemory();
    weakness.reviewedMoves = 8;
    weakness.categories['missed-tactics'].occurrences = 5;
    weakness.categories['missed-tactics'].severity = 14;
    weakness.categories['missed-tactics'].totalLossCp = 600;
    const memory = syncSkillMap(emptySkillMapMemory(), weakness, buildGameAnalyticsSummary(emptyGameLibraryMemory(), 10), 1);
    expect(memory.skills['tactical-vision'].evidenceCount).toBe(5);
    expect(memory.skills.calculation.evidenceCount).toBe(5);
    expect(memory.skills['tactical-vision'].confidence).toBe('emerging');
  });
});
