import {
  dueSpacedItems,
  formatSpacedDue,
  nextSpacedItems,
  spacedStats,
  type SpacedRepetitionMemory,
} from '../lib/spacedRepetition';

interface SpacedRepetitionPanelProps {
  memory: SpacedRepetitionMemory;
  now: number;
  disabled?: boolean;
  onTrainDue?(): void;
}

export function SpacedRepetitionPanel({
  memory,
  now,
  disabled = false,
  onTrainDue,
}: SpacedRepetitionPanelProps) {
  const stats = spacedStats(memory, now);
  const due = dueSpacedItems(memory, now, 5);
  const upcoming = nextSpacedItems(memory, now, 3);
  const nextLabel = stats.due > 0
    ? 'ready now'
    : stats.nextDueAt
      ? formatSpacedDue(stats.nextDueAt, now)
      : 'nothing scheduled';

  return (
    <section className="panel spaced-repetition-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Memory training</span>
          <h2>Spaced repetition</h2>
        </div>
        <span className={`spaced-due-badge ${stats.due ? 'has-due' : ''}`}>{stats.due} due</span>
      </div>

      <div className="spaced-stats">
        <div><span>Due now</span><strong>{stats.due}</strong></div>
        <div><span>Learning</span><strong>{stats.learning}</strong></div>
        <div><span>Mature</span><strong>{stats.mature}</strong></div>
        <div><span>Accuracy</span><strong>{stats.reviews ? `${Math.round(stats.accuracy * 100)}%` : '—'}</strong></div>
      </div>

      <div className="spaced-next-summary">
        <div>
          <span>Next review</span>
          <strong>{nextLabel}</strong>
        </div>
        <div>
          <span>Deck</span>
          <strong>{stats.repertoire} repertoire · {stats.weakness} weakness</strong>
        </div>
      </div>

      {due.length > 0 ? (
        <div className="spaced-due-list">
          {due.map((item) => (
            <div className="spaced-due-row" key={item.id}>
              <span className={`spaced-source ${item.sourceKind}`}>{item.sourceKind === 'repertoire' ? 'R' : 'W'}</span>
              <div>
                <strong>{item.label}</strong>
                <span>{item.detail} · {item.reviews ? `${item.streak} streak` : 'new'}</span>
              </div>
              <small>{formatSpacedDue(item.dueAt, now)}</small>
            </div>
          ))}
        </div>
      ) : upcoming.length > 0 ? (
        <div className="spaced-upcoming">
          <span>Upcoming</span>
          {upcoming.map((item) => (
            <div key={item.id}>
              <strong>{item.label}</strong>
              <small>{formatSpacedDue(item.dueAt, now)}</small>
            </div>
          ))}
        </div>
      ) : (
        <div className="spaced-empty">
          <strong>No cards yet.</strong>
          <p>Save repertoire moves or review games until weakness examples appear. New cards become due immediately.</p>
        </div>
      )}

      <button
        type="button"
        className="primary-button spaced-train-due"
        onClick={onTrainDue}
        disabled={disabled || stats.due === 0}
      >
        Train due now
      </button>

      <div className="spaced-schedule-guide">
        <span><b>Wrong</b> → again in 10m</span>
        <span><b>Correct</b> → 1d → 3d → longer</span>
        <span><b>Hints</b> → shorter interval</span>
      </div>

      <p className="spaced-note">
        The schedule is local and adaptive. Correct recall expands the interval; wrong answers reset the streak and return soon.
      </p>
    </section>
  );
}
