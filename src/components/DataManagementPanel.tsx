import { useRef } from 'react';

interface DataManagementPanelProps {
  lastBackupAt: number | null;
  status: string | null;
  disabled?: boolean;
  onExport(): void;
  onImport(file: File): void;
}

function stamp(timestamp: number | null): string {
  if (!timestamp) return 'Not exported this session';
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function DataManagementPanel({
  lastBackupAt,
  status,
  disabled = false,
  onExport,
  onImport,
}: DataManagementPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <section className="panel data-management-panel" id="coach-data-backup">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Local data</span>
          <h2>Backup & restore</h2>
        </div>
        <span className="stable-release-badge">v1 stable</span>
      </div>

      <div className="data-backup-summary">
        <div>
          <span>Backup contains</span>
          <strong>Training history + coach memory</strong>
          <small>Weaknesses, repertoire, spaced repetition, analytics, daily/weekly reports, goals and Ollama preferences.</small>
        </div>
        <div>
          <span>Last export</span>
          <strong>{stamp(lastBackupAt)}</strong>
          <small>JSON stays local unless you copy it elsewhere.</small>
        </div>
      </div>

      <div className="data-backup-actions">
        <button type="button" className="primary-button" onClick={onExport} disabled={disabled}>
          Export backup
        </button>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>
          Import backup
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onImport(file);
          }}
        />
      </div>

      {status && <p className="data-backup-status">{status}</p>}

      <p className="data-backup-note">
        Import replaces the backed-up local coach data and reloads the app. The Stockfish executable, current unsaved game, and external Ollama model files are not embedded in the JSON backup.
      </p>
    </section>
  );
}
