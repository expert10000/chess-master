# Changelog

## 1.0.1 — Real-Use Stabilization + UX Cleanup

### Added

- persistent Small / Regular / Large interface text-size control;
- explicit Review All progress bar, move count, percentage, and current SAN;
- quick Coach / Review / History / Study navigation from Position Tools;
- text-size preference in data backup/export/import.

### Changed

- large-text and narrow-window topbar wrapping is more robust;
- stable-line release remains feature-compatible with v1.0.0 coaching data.

## 1.0.0 — First stable release

### Added

- integrated Personal Chess Coach dashboard near the top of the Play & Coach review sidebar;
- compact overview of due memory, weakest area, weekly training, repertoire, active goal and latest Daily Study;
- one-click dashboard navigation to specialist coach panels;
- local JSON backup/export/import with schema validation and replacement restore;
- stable-release QA command: `npm run release:qa`;
- stable-release, backup and QA documentation.

### Included from the 0.x development line

- native Stockfish gameplay and analysis;
- historical move navigation and branching;
- persistent coaching verdicts;
- conversational Stockfish-grounded coach with optional Ollama wording;
- deterministic tactical/positional concept engine;
- Training mode;
- PGN/FEN import and full-game review;
- evaluation timeline;
- board ideas, PV study and attack/defense inspection;
- visual move comparison;
- opening recognition/explorer and repertoire memory;
- positional before/after comparison;
- personal weakness profile;
- spaced repetition;
- training analytics and retention forecast;
- adaptive daily study;
- post-session/tomorrow recommendation;
- weekly trend detection and adaptive priorities;
- 4–8 week goal-based training plans.
