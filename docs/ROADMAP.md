# Roadmap

## 0.2 — Move Experience

- [x] Step 1: click-to-move plus native drag-and-drop, legal targets, captures, cancel behavior.
- [x] Step 2: stronger selected/last-move/check/checkmate board-state highlights.
- [x] Step 3: explicit player/engine/review/game-over state machine and stale-search cancellation.
- [x] Step 4: full move-history navigation with start/previous/next/latest controls.
- [ ] Step 5: automatic post-move coaching pipeline.
- [ ] Step 6: game-over dialog plus PGN/FEN import and export.

## 0.4 — Automatic coaching and stronger explanations

- detect hanging pieces and newly created threats;
- compare mobility, king safety and pawn structure before/after a move;
- explain why a tempting capture fails;
- allow questions tied to a selected square or variation.

## 0.5 — Full game review

- PGN import and full-game batch analysis;
- accuracy score and mistake navigation;
- retry-from-position training;
- opening name and opening-tree integration.

## 0.6 — Local conversational coach

- optional local LLM adapter;
- structured grounding from Stockfish MultiPV and board-feature extraction;
- follow-up questions such as “Why not Bxh7+?”;
- explicit uncertainty when the verbal explanation is not fully supported.

## 0.7 — Distribution

- Windows installer and automatic engine placement;
- Linux AppImage and macOS bundle;
- GPL source-offer workflow when Stockfish binaries are distributed together with the application.


## Completed in v0.2.2

- Explicit renderer game-phase state machine.
- Search/session invalidation for stale asynchronous results.
- UCI stop/cancellation bridge and queued-analysis invalidation.
- Safe New Game / side switch / Undo during engine work.

## Completed in v0.3.0 — Interactive move-history navigation

- Start / previous / next / latest controls plus keyboard navigation.
- Exact historical board reconstruction without mutating the live game.
- Automatic coach review for the selected historical ply.
- Read-only History mode with a clear return-to-live action.
- Historical-position analysis uses the viewed FEN, not the live board FEN.
- Rapid navigation invalidates stale review requests.

## Next: v0.4.0 — Automatic post-move coaching

- Persist a compact evaluation/review result per player move.
- Show move classifications directly in history.
- Add next-mistake / previous-mistake navigation.
- Make coaching available immediately after every player move without rerunning unchanged analysis.
