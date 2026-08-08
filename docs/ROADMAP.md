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

## v0.8.0 — PGN/FEN import + full game review

Implemented:

- load `.pgn` files or paste PGN text;
- paste custom FEN positions;
- select student color for imported games;
- optional immediate full-game Stockfish review;
- review summary with verdict counts, average CPL, and issue navigation;
- imported games integrate with history, variations, conversational coach, Ollama, and Training mode;
- custom FEN is preserved as the replay base for history/Undo/variations.

## Completed in v0.8.3 — Board ideas + PV player

- Best-move, played-issue, and MultiPV candidate arrows on the chessboard.
- Deterministic tactical/positional concept highlights mapped to concrete squares.
- Fork rays plus pin/skewer/discovered-line arrows.
- One-click board-idea visibility toggle.
- Read-only animated principal-variation preview using UCI lines already calculated by Stockfish.
- Play buttons for best line, played line, compared alternative, and MultiPV candidates.
- Preview never mutates the live game, history, imported PGN, or variation tree.

- v0.8.4 — clickable board ideas and contextual board explanations.

- **v0.8.5 — Inspect any square/piece:** complete. Ordinary squares now expose direct board facts and contextual Stockfish-grounded questions.


## v0.8.6 — Visual attack / defense overlay ✅

- direct attacker and defender arrows for any inspected square/piece
- White/Black direct-control counts
- isolate attackers, defenders, or all direct control
- legal-move overlay for the inspected side-to-move piece
- clickable control arrows reuse the board-explanation system

Next: v0.8.7 — full principal-variation study controls (pause, previous, next, restart, speed).


## v0.8.7 — Full PV study controls ✅

- play / pause
- previous / next ply
- jump to start / end
- restart
- 0.5× / 1× / 2× playback speed
- keyboard study shortcuts
- deterministic rebuilding of the temporary PV board
- no mutation of live game/history/variations

Next candidate: v0.8.8 — compare two moves visually, with side-by-side evaluation and independent PV playback.


## v0.8.8 — Compare two moves visually ✅

- side-by-side played move vs Stockfish best move
- separate evaluations and exact centipawn loss
- visual 0-to-3+ pawn loss scale
- unique concept comparison
- board focus: both arrows / your move / best move
- independent PV study launch for each continuation

Next candidate: v0.9.0 — opening recognition and local opening explorer.
