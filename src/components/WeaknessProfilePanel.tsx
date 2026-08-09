import {
  weaknessProfileRows,
  weakestCategory,
  type WeaknessCategoryId,
  type WeaknessMemory,
} from '../lib/weaknessProfile';

interface WeaknessProfilePanelProps {
  memory: WeaknessMemory;
  disabled?: boolean;
  onTrainWeakest?(): void;
  onTrainCategory?(category: WeaknessCategoryId): void;
}

export function WeaknessProfilePanel({
  memory,
  disabled = false,
  onTrainWeakest,
  onTrainCategory,
}: WeaknessProfilePanelProps) {
  const rows = weaknessProfileRows(memory);
  const weakest = weakestCategory(memory);
  const topPriority = Math.max(1, ...rows.map((row) => row.priority));
  const observedWeaknesses = rows.reduce((sum, row) => sum + row.occurrences, 0);

  return (
    <section className="panel weakness-profile-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Personal coach</span>
          <h2>Weakness profile</h2>
        </div>
        <span className="weakness-reviewed-count">{memory.reviewedMoves} reviewed</span>
      </div>

      {!weakest ? (
        <div className="weakness-empty">
          <strong>No recurring weakness yet.</strong>
          <p>Review your games with Stockfish. Inaccuracies, mistakes, blunders, and opening deviations will gradually build a local profile.</p>
        </div>
      ) : (
        <>
          <div className="weakest-area-card">
            <span>Current weakest area</span>
            <strong>{weakest.label}</strong>
            <p>{weakest.description}</p>
            <div>
              <span>{weakest.occurrences} occurrence{weakest.occurrences === 1 ? '' : 's'}</span>
              <span>{(weakest.averageLossCp / 100).toFixed(2)} avg pawn loss</span>
            </div>
            <button
              type="button"
              className="primary-button"
              onClick={onTrainWeakest}
              disabled={disabled || weakest.examples === 0}
            >
              Train my weakest area
            </button>
          </div>

          <div className="weakness-list">
            {rows.map((row) => {
              const width = row.priority > 0 ? Math.max(5, Math.round(row.priority / topPriority * 100)) : 0;
              return (
                <div className={`weakness-row ${row.id === weakest.id ? 'top' : ''}`} key={row.id}>
                  <div className="weakness-row-heading">
                    <div>
                      <strong>{row.label}</strong>
                      <span>{row.occurrences}× · {(row.averageLossCp / 100).toFixed(2)} avg</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onTrainCategory?.(row.id)}
                      disabled={disabled || row.examples === 0}
                    >
                      Train
                    </button>
                  </div>
                  <div className="weakness-priority-track" aria-label={`${row.label} priority`}>
                    <span style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="weakness-profile-summary">
            <span>{observedWeaknesses} categorized observations</span>
            <span>{rows.filter((row) => row.occurrences > 1).length} recurring areas</span>
          </div>
        </>
      )}

      <p className="weakness-profile-note">
        Priority blends frequency, Stockfish verdict severity, and centipawn loss. Categories are deterministic teaching heuristics and are stored locally on this device.
      </p>
    </section>
  );
}
