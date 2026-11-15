import { describe, expect, it } from 'vitest'; import { emptyOpponentPrepMemory, importOpponentPgns, opponentProfile } from '../src/lib/opponentPreparation';
const PGN='[White "Opponent"]\n[Black "Player"]\n[Result "1-0"]\n\n1. e4 c5 2. Nf3 d6 1-0';
describe('v1.4.0 opponent preparation',()=>{it('imports opponent PGNs and derives opening tendencies',()=>{const memory=importOpponentPgns(emptyOpponentPrepMemory(),'Opponent',PGN,1);const profile=opponentProfile(memory,'Opponent');expect(profile.games).toBe(1);expect(profile.tendencies[0].line).toContain('e4 c5');});});
