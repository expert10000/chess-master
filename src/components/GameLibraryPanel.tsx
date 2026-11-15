import { useMemo, useState } from 'react';
import {
  defaultGameLibrarySearchOptions,
  filterGameLibrary,
  gameLibraryOpeningLabel,
  gameLibraryStats,
  type GameLibraryEntry,
  type GameLibraryFilter,
  type GameLibraryMemory,
  type GameLibrarySearchOptions,
  type GameLibrarySort,
  type GameLibraryUserMetadataPatch,
} from '../lib/gameLibrary';

interface GameLibraryPanelProps {
  memory: GameLibraryMemory;
  currentGameId: string | null;
  disabled?: boolean;
  storageError?: string | null;
  onOpen(entry: GameLibraryEntry): void;
  onReview(entry: GameLibraryEntry): void;
  onTrainMistakes(entry: GameLibraryEntry): void;
  onUpdateMetadata(entryId: string, patch: GameLibraryUserMetadataPatch): void;
  onDelete(entry: GameLibraryEntry): void;
}

function gameDate(entry: GameLibraryEntry): string {
  if (entry.date) return entry.date;
  return new Date(entry.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function cpl(entry: GameLibraryEntry): string {
  return entry.averageCpl === null ? '—' : `${Math.round(entry.averageCpl)} cp`;
}

function parseNumber(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function tagString(entry: GameLibraryEntry): string {
  return (entry.tags ?? []).join(', ');
}

function notePreview(entry: GameLibraryEntry): string {
  const note = (entry.note ?? '').trim();
  return note.length > 320 ? `${note.slice(0, 317)}…` : note;
}

export function GameLibraryPanel({
  memory,
  currentGameId,
  disabled = false,
  storageError = null,
  onOpen,
  onReview,
  onTrainMistakes,
  onUpdateMetadata,
  onDelete,
}: GameLibraryPanelProps) {
  const [filters, setFilters] = useState<GameLibrarySearchOptions>(() => defaultGameLibrarySearchOptions());
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTags, setDraftTags] = useState('');
  const [draftNote, setDraftNote] = useState('');

  const stats = useMemo(() => gameLibraryStats(memory), [memory]);
  const entries = useMemo(() => filterGameLibrary(memory, filters), [memory, filters]);
  const openingOptions = useMemo(() => [...new Set(
    memory.entries.filter((entry) => !entry.archived).map(gameLibraryOpeningLabel)
  )].sort(), [memory]);
  const weaknessOptions = useMemo(() => [...new Set(
    memory.entries.filter((entry) => !entry.archived).flatMap((entry) => entry.weaknesses.map((weakness) => weakness.label))
  )].sort(), [memory]);

  const activeAdvanced = Boolean(
    filters.source !== 'any'
    || filters.side !== 'any'
    || filters.result !== 'any'
    || filters.opening
    || filters.weakness
    || filters.reviewStatus !== 'any'
    || filters.minCpl !== null
    || filters.maxCpl !== null
    || filters.dateFrom
    || filters.dateTo
    || filters.sort !== 'newest'
  );

  function setFilter<K extends keyof GameLibrarySearchOptions>(key: K, value: GameLibrarySearchOptions[K]): void {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function startEdit(entry: GameLibraryEntry): void {
    setEditingId(entry.id);
    setDraftTags(tagString(entry));
    setDraftNote(entry.note ?? '');
  }

  function saveEdit(entry: GameLibraryEntry): void {
    onUpdateMetadata(entry.id, {
      tags: draftTags.split(',').map((tag) => tag.trim()).filter(Boolean),
      note: draftNote,
    });
    setEditingId(null);
  }

  function clearAdvanced(): void {
    setFilters((current) => ({
      ...defaultGameLibrarySearchOptions(),
      query: current.query,
      filter: current.filter,
    }));
  }

  const primaryFilters: Array<[GameLibraryFilter, string]> = [
    ['all', 'All'],
    ['pinned', '★ Pinned'],
    ['model', 'Model'],
    ['issues', 'Issues'],
    ['reviewed', 'Reviewed'],
    ['archived', 'Archived'],
  ];

  return (
    <section className="panel game-library-panel" id="coach-game-library">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Persistent memory</span>
          <h2>Game library</h2>
        </div>
        <span className="game-library-count">{stats.total} active · {stats.archived} archived</span>
      </div>

      <div className="game-library-stats organized">
        <div><span>Reviewed</span><strong>{stats.reviewed}</strong></div>
        <div><span>Issues</span><strong>{stats.withIssues}</strong></div>
        <div><span>Pinned</span><strong>{stats.pinned}</strong></div>
        <div><span>Model</span><strong>{stats.modelGames}</strong></div>
        <div><span>Archived</span><strong>{stats.archived}</strong></div>
      </div>

      <label className="game-library-search">
        <span>Search games</span>
        <input
          value={filters.query}
          onChange={(event) => setFilter('query', event.target.value)}
          placeholder="Player, opening, tag, note, weakness, result, event…"
        />
      </label>

      <div className="game-library-filters organized" aria-label="Game library filter">
        {primaryFilters.map(([id, label]) => (
          <button
            type="button"
            key={id}
            className={filters.filter === id ? 'active' : ''}
            aria-pressed={filters.filter === id}
            onClick={() => setFilter('filter', id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="game-library-filter-toolbar">
        <button
          type="button"
          className={showAdvanced || activeAdvanced ? 'active' : ''}
          onClick={() => setShowAdvanced((value) => !value)}
        >
          Filters {activeAdvanced ? '•' : ''}
        </button>
        <label>
          Sort
          <select value={filters.sort} onChange={(event) => setFilter('sort', event.target.value as GameLibrarySort)}>
            <option value="newest">Newest</option>
            <option value="worst-cpl">Worst CPL</option>
            <option value="most-issues">Most issues</option>
            <option value="opening">Opening A–Z</option>
          </select>
        </label>
        {activeAdvanced && <button type="button" onClick={clearAdvanced}>Clear filters</button>}
        <span>{entries.length} matches</span>
      </div>

      {showAdvanced && (
        <div className="game-library-advanced-filters">
          <label>Your side<select value={filters.side} onChange={(e) => setFilter('side', e.target.value as GameLibrarySearchOptions['side'])}>
            <option value="any">Any</option><option value="w">White</option><option value="b">Black</option>
          </select></label>
          <label>Result<select value={filters.result} onChange={(e) => setFilter('result', e.target.value as GameLibrarySearchOptions['result'])}>
            <option value="any">Any</option><option value="win">Win</option><option value="draw">Draw</option><option value="loss">Loss</option><option value="unfinished">Unfinished</option>
          </select></label>
          <label>Source<select value={filters.source} onChange={(e) => setFilter('source', e.target.value as GameLibrarySearchOptions['source'])}>
            <option value="any">Any</option><option value="played">Played</option><option value="imported">Imported</option>
          </select></label>
          <label>Review<select value={filters.reviewStatus} onChange={(e) => setFilter('reviewStatus', e.target.value as GameLibrarySearchOptions['reviewStatus'])}>
            <option value="any">Any</option><option value="reviewed">Reviewed</option><option value="partial">Partial</option><option value="unreviewed">Unreviewed</option>
          </select></label>
          <label className="wide">Opening<select value={filters.opening} onChange={(e) => setFilter('opening', e.target.value)}>
            <option value="">Any opening</option>{openingOptions.map((opening) => <option key={opening} value={opening}>{opening}</option>)}
          </select></label>
          <label className="wide">Weakness<select value={filters.weakness} onChange={(e) => setFilter('weakness', e.target.value)}>
            <option value="">Any weakness</option>{weaknessOptions.map((weakness) => <option key={weakness} value={weakness}>{weakness}</option>)}
          </select></label>
          <label>Min CPL<input type="number" min="0" value={filters.minCpl ?? ''} onChange={(e) => setFilter('minCpl', parseNumber(e.target.value))} placeholder="0" /></label>
          <label>Max CPL<input type="number" min="0" value={filters.maxCpl ?? ''} onChange={(e) => setFilter('maxCpl', parseNumber(e.target.value))} placeholder="∞" /></label>
          <label>From<input type="date" value={filters.dateFrom} onChange={(e) => setFilter('dateFrom', e.target.value)} /></label>
          <label>To<input type="date" value={filters.dateTo} onChange={(e) => setFilter('dateTo', e.target.value)} /></label>
        </div>
      )}

      {storageError && <p className="game-library-storage-error">{storageError}</p>}

      {entries.length === 0 ? (
        <div className="game-library-empty">
          <strong>{memory.entries.length ? 'No games match these filters.' : 'Your game library will build automatically.'}</strong>
          <p>{memory.entries.length ? 'Clear one or more filters, or open Archived to restore an older game.' : 'Played games and PGN imports are saved once they contain moves.'}</p>
        </div>
      ) : (
        <div className="game-library-list">
          {entries.slice(0, 100).map((entry) => {
            const editing = editingId === entry.id;
            return (
              <article key={entry.id} className={`game-library-card organized ${entry.id === currentGameId ? 'current' : ''} ${entry.archived ? 'archived' : ''}`}>
                <div className="game-library-card-heading">
                  <button
                    type="button"
                    className={`game-pin-button ${entry.pinned ? 'active' : ''}`}
                    title={entry.pinned ? 'Unpin favorite' : 'Pin favorite'}
                    onClick={() => onUpdateMetadata(entry.id, { pinned: !entry.pinned })}
                    disabled={disabled}
                  >{entry.pinned ? '★' : '☆'}</button>
                  <div className="game-library-title-block">
                    <span>{gameDate(entry)} · {entry.source}</span>
                    <strong>{entry.white} – {entry.black}</strong>
                    <small>{gameLibraryOpeningLabel(entry)}</small>
                  </div>
                  <div className="game-library-heading-badges">
                    {entry.modelGame && <span className="model-game-badge">MODEL</span>}
                    {entry.archived && <span className="archived-game-badge">ARCHIVED</span>}
                    {entry.id === currentGameId && <span className="current-game-badge">CURRENT</span>}
                    <b>{entry.result}</b>
                  </div>
                </div>

                <div className="game-library-opening">
                  <span>{entry.opening?.eco ?? '—'}</span>
                  <strong>{entry.opening?.family ?? 'Opening not classified'}</strong>
                </div>

                <div className="game-library-metrics">
                  <div><span>Review</span><strong>{entry.reviewStatus}</strong><small>{entry.reviewedHumanMoves}/{entry.humanMoveCount} your moves</small></div>
                  <div><span>Avg CPL</span><strong>{cpl(entry)}</strong><small>reviewed moves</small></div>
                  <div><span>Issues</span><strong>{entry.issueCount}</strong><small>inaccuracy+</small></div>
                </div>

                {(entry.tags ?? []).length > 0 && (
                  <div className="game-library-user-tags">{(entry.tags ?? []).map((tag) => <span key={tag}>#{tag}</span>)}</div>
                )}

                {(entry.note ?? '').trim() && (
                  <p className="game-library-note-preview"><b>Note:</b> {notePreview(entry)}</p>
                )}

                {entry.weaknesses.length > 0 && (
                  <div className="game-library-weaknesses">
                    {entry.weaknesses.slice(0, 4).map((weakness) => <span key={weakness.label}>{weakness.label} · {weakness.count}</span>)}
                  </div>
                )}

                <div className="game-library-actions organized">
                  <button type="button" onClick={() => onOpen(entry)} disabled={disabled}>Open</button>
                  <button type="button" onClick={() => onReview(entry)} disabled={disabled || Boolean(entry.archived)}>{entry.reviewStatus === 'reviewed' ? 'Review' : 'Review missing'}</button>
                  <button type="button" className="primary-button" onClick={() => onTrainMistakes(entry)} disabled={disabled || entry.issueCount === 0 || Boolean(entry.archived)}>Train mistakes</button>
                  <button type="button" onClick={() => editing ? setEditingId(null) : startEdit(entry)} disabled={disabled}>{editing ? 'Close edit' : 'Edit'}</button>
                </div>

                {editing && (
                  <div className="game-library-editor">
                    <label>Tags <input value={draftTags} onChange={(e) => setDraftTags(e.target.value)} placeholder="French, tactics, endgame, study again" /></label>
                    <label>Note <textarea value={draftNote} onChange={(e) => setDraftNote(e.target.value)} rows={3} placeholder="Study ...e5 break; revisit move 18…" /></label>
                    <div className="game-library-editor-flags">
                      <label><input type="checkbox" checked={Boolean(entry.pinned)} onChange={(e) => onUpdateMetadata(entry.id, { pinned: e.target.checked })} /> Pinned favorite</label>
                      <label><input type="checkbox" checked={Boolean(entry.modelGame)} onChange={(e) => onUpdateMetadata(entry.id, { modelGame: e.target.checked })} /> Model game</label>
                    </div>
                    <div className="game-library-editor-actions">
                      <button type="button" className="primary-button" onClick={() => saveEdit(entry)}>Save tags & note</button>
                      <button type="button" onClick={() => onUpdateMetadata(entry.id, { archived: !entry.archived })}>{entry.archived ? 'Restore from archive' : 'Archive'}</button>
                      <button type="button" className="danger-button" onClick={() => onDelete(entry)} disabled={entry.id === currentGameId} title={entry.id === currentGameId ? 'Open another game before deleting the active game.' : 'Permanently delete this saved game'}>Delete</button>
                    </div>
                    {entry.id === currentGameId && <small className="game-library-delete-help">The active game cannot be deleted because it is still being autosaved. Archive it now, or open another game first.</small>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {entries.length > 100 && <p className="game-library-more">Showing the 100 highest-ranked matches for the current filters.</p>}

      <p className="game-library-note">
        Pinned means important to you. Model game means a reference game to study/imitate; model and archived games are excluded from personal game-performance analytics so they do not distort your statistics.
      </p>
    </section>
  );
}
