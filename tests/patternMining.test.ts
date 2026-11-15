import { describe, expect, it } from 'vitest'; import { mineRecurringPatterns } from '../src/lib/patternMining'; import { emptyGameLibraryMemory } from '../src/lib/gameLibrary';
describe('v1.7.0 pattern mining',()=>{it('requires repeated evidence before declaring a recurring motif',()=>{expect(mineRecurringPatterns(emptyGameLibraryMemory())).toEqual([])});});
