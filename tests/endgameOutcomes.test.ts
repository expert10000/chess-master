import { describe, expect, it } from 'vitest';
import { emptyGameLibraryMemory } from '../src/lib/gameLibrary';
import { emptyEndgameOutcomeMemory, startEndgameOutcome } from '../src/lib/endgameOutcomes';
describe('v1.3.1 endgame outcomes', () => { it('freezes a module-specific baseline when tracking starts', () => { const result = startEndgameOutcome(emptyEndgameOutcomeMemory(), emptyGameLibraryMemory(), 'rook', 42); expect(result.interventions[0]).toMatchObject({ module: 'rook', startedAt: 42, baselineGameIds: [] }); }); });
