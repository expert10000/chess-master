import { useMemo, useRef, useState } from 'react';

import { splitPgnCollection } from '../lib/gameImport';

export type ImportKind = 'pgn' | 'fen';

interface ImportGameDialogProps {
  busy: boolean;
  onClose(): void;
  onImportPgn(pgn: string, reviewAs: 'w' | 'b', analyze: boolean): Promise<void> | void;
  onImportFen(fen: string): Promise<void> | void;
}

export function ImportGameDialog({ busy, onClose, onImportPgn, onImportFen }: ImportGameDialogProps) {
  const [kind, setKind] = useState<ImportKind>('pgn');
  const [value, setValue] = useState('');
  const [reviewAs, setReviewAs] = useState<'w' | 'b'>('w');
  const [analyze, setAnalyze] = useState(true);
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const detectedGames = useMemo(
    () => kind === 'pgn' ? splitPgnCollection(value) : [],
    [kind, value],
  );
  const safeSelectedGameIndex = Math.min(selectedGameIndex, Math.max(0, detectedGames.length - 1));

  async function readPgnFile(file: File | undefined): Promise<void> {
    if (!file) return;
    try {
      const text = await file.text();
      setKind('pgn');
      setValue(text);
      setSelectedGameIndex(0);
      setLocalError(null);
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }

  async function submit(): Promise<void> {
    const trimmed = value.trim();
    if (!trimmed) {
      setLocalError(kind === 'pgn' ? 'Paste or load a PGN first.' : 'Paste a FEN first.');
      return;
    }
    setLocalError(null);
    try {
      if (kind === 'pgn') {
        const games = splitPgnCollection(trimmed);
        const selectedPgn = games.length > 0 ? games[safeSelectedGameIndex]?.pgn : trimmed;
        if (!selectedPgn) throw new Error('No PGN game could be detected.');
        await onImportPgn(selectedPgn, reviewAs, analyze);
      } else {
        await onImportFen(trimmed);
      }
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="import-dialog" role="dialog" aria-modal="true" aria-labelledby="import-title">
        <div className="import-dialog-heading">
          <div>
            <span className="eyebrow">Game review</span>
            <h2 id="import-title">Import PGN or FEN</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} disabled={busy} aria-label="Close import dialog">×</button>
        </div>

        <div className="import-tabs" role="tablist" aria-label="Import format">
          <button type="button" className={kind === 'pgn' ? 'active' : ''} onClick={() => setKind('pgn')} disabled={busy}>PGN game</button>
          <button type="button" className={kind === 'fen' ? 'active' : ''} onClick={() => setKind('fen')} disabled={busy}>FEN position</button>
        </div>

        {kind === 'pgn' ? (
          <>
            <div className="import-file-row">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}>Load .pgn file</button>
              <span>Chess.com and Lichess exports work as normal PGN text.</span>
              <input
                ref={fileRef}
                type="file"
                accept=".pgn,text/plain,application/x-chess-pgn"
                hidden
                onChange={(event) => void readPgnFile(event.target.files?.[0])}
              />
            </div>
            <textarea
              className="import-textarea"
              value={value}
              onChange={(event) => { setValue(event.target.value); setSelectedGameIndex(0); }}
              disabled={busy}
              placeholder={'[Event "..."]\n[White "..."]\n[Black "..."]\n\n1. e4 e5 2. Nf3 Nc6 ...'}
              spellCheck={false}
            />
            {detectedGames.length > 1 && (
              <div className="pgn-collection-box">
                <div>
                  <strong>{detectedGames.length} games detected</strong>
                  <span>This file is a PGN collection. Choose the game to import and review.</span>
                </div>
                <select
                  value={safeSelectedGameIndex}
                  onChange={(event) => setSelectedGameIndex(Number(event.target.value))}
                  disabled={busy}
                  aria-label="Choose game from PGN collection"
                >
                  {detectedGames.map((game) => (
                    <option key={game.index} value={game.index}>{game.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="import-options">
              <label>
                Review me as
                <select value={reviewAs} onChange={(event) => setReviewAs(event.target.value as 'w' | 'b')} disabled={busy}>
                  <option value="w">White</option>
                  <option value="b">Black</option>
                </select>
              </label>
              <label className="checkbox-row">
                <input type="checkbox" checked={analyze} onChange={(event) => setAnalyze(event.target.checked)} disabled={busy} />
                <span>Analyze the full game immediately</span>
              </label>
            </div>
          </>
        ) : (
          <>
            <textarea
              className="import-textarea fen-textarea"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={busy}
              placeholder="r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3"
              spellCheck={false}
            />
            <p className="import-note">A FEN starts a new local position. The side to move becomes your side, so you can analyze it or continue playing from there.</p>
          </>
        )}

        {localError && <div className="import-error">{localError}</div>}

        <div className="import-dialog-actions">
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="primary-button" onClick={() => void submit()} disabled={busy}>
            {busy ? 'Importing…' : kind === 'pgn' ? (analyze ? 'Import & review' : 'Import game') : 'Import position'}
          </button>
        </div>
      </section>
    </div>
  );
}
