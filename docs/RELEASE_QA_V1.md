# v1.0.0 Release QA

## Automated gate

Run:

```powershell
npm run release:qa
```

The command runs, in order:

1. TypeScript typecheck for renderer + Electron;
2. Vitest suite;
3. production renderer/Electron build;
4. static v1.0.0 release-integrity checks.

The static gate verifies the v1.0.0 package version and required stable-release files/integration markers.

## Manual smoke checklist

### Engine

- `npm run stockfish:check`
- app launches with native Stockfish configured;
- Play & Coach can make and receive legal moves;
- Review All completes on a normal PGN/game.

### Review workspace

- selected historical move updates the visible/sticky board;
- selected move summary and full explanation agree;
- PV transport Start/Previous/Play/Next/End works;
- evaluation timeline navigation works.

### Opening / personal memory

- opening name/taxonomy displays;
- save/forget repertoire move works;
- opening deviation enters personal memory;
- weakness profile updates after reviewed issues.

### Training

- Training sources all open;
- Daily Study snapshots its session;
- spaced card result changes its due schedule;
- post-session report completes;
- Training Analytics updates.

### Weekly / goals

- weekly panel handles sparse data without inventing trends;
- active completed-week priorities can influence Daily Study;
- 4/6/8-week goal creation, pause/resume/complete works;
- rating-preparation wording does not claim actual Elo measurement.

### Backup

- Export backup downloads JSON;
- invalid JSON is rejected;
- valid backup asks for confirmation;
- restore reloads app;
- weakness/repertoire/spaced/analytics/reports/goals survive the round trip.

### Responsive layout

- desktop width ≥1000 px keeps board beside review workflow;
- board remains visible/sticky where designed;
- <1000 px single-column mode remains usable;
- Personal Coach dashboard buttons scroll to the intended panels.
