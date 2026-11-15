import { useMemo, useState } from 'react';
import type { GameLibraryEntry, GameLibraryMemory } from '../lib/gameLibrary';
import { assessPersonalPreMoveRisk } from '../lib/preMoveRisk';
interface Props { memory: GameLibraryMemory; fen: string | null; ply: number; humanColor: 'w' | 'b'; onOpenMove(entry: GameLibraryEntry, ply: number): void }
export function PreMoveRiskCoachPanel({ memory, fen, ply, humanColor, onOpenMove }: Props) {
  const [showExamples, setShowExamples] = useState(false);
  const risk = useMemo(() => fen ? assessPersonalPreMoveRisk(memory, fen, ply, humanColor) : null, [memory, fen, ply, humanColor]);
  return <section className="panel pre-move-risk-panel" id="coach-pre-move-risk">
    <div className="panel-heading compact"><div><span className="eyebrow">v1.11.0 · Training only</span><h2>Personal risk</h2></div><span className="risk-guard">Fair play protected</span></div>
    {!fen ? <div className="risk-empty"><strong>Disabled outside training.</strong><p>This coach never appears in live rated play. Start a training exercise to check the position against your reviewed history.</p></div> : !risk ? <div className="risk-empty"><strong>No elevated personal pattern yet.</strong><p>At least three comparable reviewed positions and one past issue are required before a risk alert is shown.</p></div> : <>
      <div className="risk-callout"><span>Personal risk · {risk.phase}</span><strong>{risk.mainRisk}</strong><p>This position resembles <b>{risk.comparablePositions}</b> reviewed positions; you made an issue in <b>{risk.mistakes}</b>.</p><div><span>Historical error rate</span><b>{Math.round(risk.errorRate * 100)}%</b></div></div>
      <button type="button" onClick={() => setShowExamples((value) => !value)}>{showExamples ? 'Hide similar positions' : 'Show similar positions'}</button>
      {showExamples && <div className="risk-examples">{risk.examples.map((example) => { const entry = memory.entries.find((item) => item.id === example.gameId); return <article key={`${example.gameId}:${example.ply}`}><div><span>{example.white} · {example.black}</span><strong>{Math.ceil(example.ply / 2)}{example.ply % 2 ? '.' : '…'} {example.san}</strong><small>{example.cpl} cp · {example.label}</small></div>{entry && <button type="button" onClick={() => onOpenMove(entry, example.ply)}>Open move</button>}</article>; })}</div>}
    </>}
    <p className="risk-note">Similarity is a transparent structural heuristic (phase, side to move, material, and kingside-pawn state). It warns only from your own saved review evidence; it does not predict a move or consult an opponent.</p>
  </section>;
}
