# Stockfish Coach 1.0 — Local Data Backup

Stockfish Coach is local-first. v1.0.0 adds explicit JSON backup and restore for the personal-coach data stored in browser/Electron local storage.

## Export

Use:

**Personal Coach → Backup data**

or scroll to:

**Backup & restore → Export backup**

The app downloads a timestamped file such as:

`stockfish-coach-backup-20260810-1835.json`

The file includes recognized Stockfish Coach local-storage entries for:

- personal weakness profile;
- opening repertoire and opening deviations;
- spaced-repetition cards and schedules;
- Training Analytics events;
- daily post-session reports;
- completed weekly coach reports;
- 4–8 week goal plans;
- Ollama enable/model preferences.

The backup deliberately does not include unrelated browser storage.

## Not included

The JSON does **not** embed:

- `resources/stockfish/stockfish.exe`;
- an Ollama model installation;
- the currently open unsaved game / temporary branch state;
- operating-system or Electron installation files.

Stockfish and Ollama remain machine-level dependencies.

## Import

Choose **Import backup** and select a Stockfish Coach JSON backup.

The importer checks:

- backup kind;
- schema version;
- export timestamp;
- app-version field;
- value type for every recognized entry.

Unknown future keys are ignored.

After confirmation, import is a **replacement restore**:

- entries present in the backup are restored;
- known coach-data entries absent from that backup are removed;
- the app reloads so every React state rehydrates from the restored data.

This is preferable to silently merging two histories, which could duplicate weakness observations, spaced cards, or goal/report history.

## Schema

v1.0.0 uses:

- kind: `stockfish-coach-backup`
- schema: `1`

Future incompatible schemas should be migrated explicitly rather than guessed.
