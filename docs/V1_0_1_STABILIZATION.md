# v1.0.1 — Real-Use Stabilization + UX Cleanup

v1.0.1 is intentionally a stabilization release rather than another large coaching subsystem.

## Three persistent text sizes

The top bar now provides:

- **Small** — 90% text scale;
- **Regular** — 100%, default;
- **Large** — 112% text scale.

The choice is stored locally:

`stockfish-coach.ui-font-size.v1`

The setting changes interface text without changing the chess-piece sizing rules on the board. Existing click targets and board geometry remain unchanged.

The preference is included in v1.0 backup/export/import.

## Full-game review progress

Review All now exposes explicit progress inside Position Tools:

- current move / total;
- percentage;
- current SAN move;
- progress bar.

The progress state is cleared after completion, cancellation/session replacement, new game, PGN import, or FEN import.

This makes long reviews visibly active instead of relying only on the tiny top status line.

## Quick workflow navigation

Position Tools now includes a compact four-button workflow strip:

- Coach
- Review
- History
- Study

The buttons smoothly jump to the relevant section and avoid unnecessary long sidebar scrolling.

## Large-text overflow hardening

Topbar/status controls can wrap in Large mode and at narrower widths.

The release preserves the v1.0 review-first ordering and sticky-board behavior introduced during the 0.9.5.1 stabilization work.

## Scope discipline

v1.0.1 does not change:

- Stockfish evaluation rules;
- training grading;
- spaced-repetition scheduling;
- weekly trend algorithms;
- long-term goal algorithms;
- backup schema version.

This keeps the patch appropriate for the first stable 1.0.x line.
