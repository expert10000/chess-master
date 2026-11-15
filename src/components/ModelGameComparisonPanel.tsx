import { useMemo, useState } from 'react';
import type { GameLibraryEntry, GameLibraryMemory } from '../lib/gameLibrary';
import { compareWithModelGames } from '../lib/modelGameComparison';
interface Props { memory: GameLibraryMemory; fen: string | null; ply: number; humanColor: 'w' | 'b'; stockfishMove: string | null; onOpenMove(entry: GameLibraryEntry, ply: number): void }
export function ModelGameComparisonPanel({ memory, fen, ply, humanColor, stockfishMove, onOpenMove }: Props) {
  const [showExamples, setShowExamples] = useState(false); const comparison = useMemo(() => fen ? compareWithModelGames(memory, fen, ply, humanColor) : null, [memory, fen, ply, humanColor]);
  return <section className="panel model-comparison-panel" id="coach-model-comparison"><div className="panel-heading compact"><div><span className="eyebrow">v1.12.0 · Human chess layer</span><h2>Model games / master comparison</h2></div></div>
    {!fen ? <div className="model-empty"><strong>Open a training position to compare it.</strong><p>This panel is intentionally tied to study positions, not live play.</p></div> : <>
      <p className="model-question">What do strong players normally do in this kind of position?</p>
      <div className="model-columns"><article><span>Your games</span><strong>{comparison!.personalPositions} similar positions</strong><small>{comparison!.personalAvgCpl === null ? 'No reviewed CPL yet' : `Average decision loss: ${Math.round(comparison!.personalAvgCpl)} cp`}</small></article><article><span>Strong model games</span><strong>{comparison!.modelPositions} similar positions</strong><small>{comparison!.commonModelMove ? `Most common continuation: ${comparison!.commonModelMove}` : 'Mark imported reference games as Model'}</small></article><article><span>Stockfish</span><strong>{stockfishMove ?? 'Not analysed yet'}</strong><small>Engine reference for this exercise</small></article></div>
      {comparison!.modelPositions > 0 && <><button type="button" onClick={() => setShowExamples((value) => !value)}>{showExamples ? 'Hide model examples' : 'Show model examples'}</button>{showExamples && <div className="model-examples">{comparison!.examples.map((example) => { const entry = memory.entries.find((item) => item.id === example.gameId); return <article key={`${example.gameId}:${example.ply}`}><div><span>{example.white} – {example.black}</span><strong>{Math.ceil(example.ply / 2)}{example.ply % 2 ? '.' : '…'} {example.san}</strong><small>{example.label}</small></div>{entry && <button type="button" onClick={() => onOpenMove(entry, example.ply)}>Open game</button>}</article>; })}</div>}</>}
    </>}
    <p className="model-note">“Strong” means games you explicitly marked as Model in your library. Structural similarity is phase, side to move, and material; it is a study comparison, not a claim that one move is universally best.</p>
  </section>;
}
