import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { compareWithModelGames } from '../src/lib/modelGameComparison';
import type { GameLibraryEntry, GameLibraryMemory } from '../src/lib/gameLibrary';
function game(id: string, modelGame: boolean, move: string, cpl = 20): GameLibraryEntry { return { id, fingerprint:id, source:'imported', createdAt:1, updatedAt:1, startFen:new Chess().fen(), movesUci:[move], pgn:'', white:modelGame?'Master':'You', black:'Opponent', result:'*', humanColor:'w', opening:null, reviewStatus:'reviewed', humanMoveCount:1, reviewedHumanMoves:1, reviewedPlyCount:1, issueCount:0, averageCpl:cpl, weaknesses:[], modelGame, reviewsByPly:{'1':{verdict:'Good',centipawnLoss:cpl,bestMoveUci:'e2e4',bestMoveSan:'e4',title:'Review',summary:'',reasons:[],concepts:[],playedEvaluation:'0',bestEvaluation:'0'}}}; }
describe('v1.12.0 model game comparison', () => {
  it('keeps personal and marked-model evidence separate while surfacing the common model continuation', () => {
    const memory: GameLibraryMemory = {version:1,entries:[game('personal',false,'e2e4',40),game('model-a',true,'d2d4'),game('model-b',true,'d2d4')]};
    const result=compareWithModelGames(memory,new Chess().fen(),1,'w');
    expect(result.personalPositions).toBe(1); expect(result.personalAvgCpl).toBe(40); expect(result.modelPositions).toBe(2); expect(result.commonModelMove).toBe('d4');
  });
});
