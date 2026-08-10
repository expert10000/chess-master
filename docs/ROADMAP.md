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


## v0.9.0 — Opening recognition + local explorer ✅

- offline curated ECO book
- opening and variation recognition
- exact local-book deviation detection (“Theory ended here”)
- up to six common local continuations with relative local share
- one-click local-line study using the PV player
- direct Training-mode exercise from an opening deviation
- book alternatives accepted as opening-training solutions, with Stockfish still grading the move

Next candidate: v0.9.1 — opening mistake coach and repertoire memory.


## v0.9.1 — Opening mistake coach + repertoire memory ✅

- persistent local repertoire choices per exact opening position
- save/replace/forget a preferred move
- personal out-of-book repertoire moves
- distinguish repertoire miss from Stockfish mistake
- repeated opening-deviation memory across games
- White/Black repertoire counts and repeated-miss summary
- one-click recall training for a saved repertoire move
- one-click training for repeated remembered deviations
- repertoire recall success/attempt counters

Next candidate: v0.9.2 — before/after positional comparison and opening-plan explanations.


## v0.9.2 — Positional before / after comparison ✅

- six transparent 0–10 teaching dimensions
- development before/after
- king safety before/after
- central control before/after
- pawn structure before/after
- piece activity before/after
- tactical pressure before/after
- switch between played move and Stockfish best move
- expandable concrete “Why?” evidence for every metric
- improvement/decline summary
- direct bridge into conversational coaching
- explicit separation between heuristic profile and Stockfish evaluation

Next candidate: v0.9.3 — personal weakness profile and targeted training.


## v0.9.2.1 — Opening taxonomy + arrow-source clarity ✅

- opening Type / Family / Branch / Variation shown explicitly
- French/Sicilian/Caro-Kann etc. labeled as semi-open games
- Ruy/Italian/Scotch etc. labeled as open games
- Queen's Pawn systems labeled as closed games
- major Indian systems labeled separately
- English/Réti labeled as flank openings
- solid green arrow explicitly means Stockfish best
- dashed blue arrow means local opening-book continuation
- dashed gold arrow means saved repertoire move
- overlapping book/repertoire arrows receive small opposite offsets
- book arrows are only drawn on the exact local-book position


## v0.9.3 — Personal weakness profile + targeted training ✅

- persistent cross-game weakness memory
- hanging-piece aggregation
- missed-tactics aggregation
- king-safety aggregation
- pawn-structure aggregation
- poor-development aggregation
- opening-deviation aggregation
- priority score blending frequency, verdict severity, and centipawn loss
- local profile panel with weakest-area summary
- Train my weakest area
- per-category Train actions
- up to 12 recent stored positions per targeted session
- training still rechecks every answer with Stockfish

Next candidate: v0.9.4 — spaced repetition scheduler for repertoire and weakness exercises.


## v0.9.4 — Spaced repetition ✅

- persistent scheduler for repertoire cards and weakness examples
- new cards due immediately
- correct recall: 1 day → 3 days → adaptive longer intervals
- hint-sensitive shorter intervals
- incorrect answer: streak reset + 10-minute relearning delay
- per-card ease, streak, lapses, review count, accuracy, due timestamp
- changing a repertoire move resets that card
- forgetting a repertoire move removes its card
- Spaced Repetition dashboard
- Train due now
- Due review source in Training mode
- due-session snapshot prevents completed results from disappearing mid-session
- every answer remains Stockfish-checked

Next candidate: v0.9.5 — training analytics, calendar/heatmap, and retention forecast.


## v0.9.5 — Training analytics + heatmap + retention forecast ✅

- persistent log of every evaluated Training attempt
- 8-week daily practice heatmap
- 7-day and 30-day attempts / accuracy summaries
- accuracy by weakness category
- accuracy by opening/repertoire line
- next-7-day and next-30-day scheduled review load
- 14-day review-load bar chart
- retention estimate from interval, streak, ease, age, and result
- New / Fragile / Growing / Stable knowledge states
- “Knowledge becoming stable” list
- explicit distinction between current due-date forecast and future rescheduling
- detailed analytics starts with v0.9.5; no fabricated historical attempts

Next candidate: v0.9.6 — adaptive training planner / daily study session.


## v0.9.5.1 — Review workspace UX ✅

- review results moved directly below Position Tools
- Review All auto-reveals the Full Game Review dashboard
- selected historical move shown directly in the review dashboard
- compact selected-move status also shown above the move list
- one-click jump to full selected-move explanation
- two-column board/review layout retained down to 1000 px
- viewport-aware board sizing
- sticky board on normal desktop-height windows
- opening/repertoire/weakness/analytics dashboards moved below the core game-review workflow


## v0.9.6 — Adaptive Daily Study Planner ✅

- 15 / 20 / 30 minute study targets
- automatic daily session preview
- due reviewed repertoire prioritized first
- top weakness categories sampled round-robin
- recent reviewed mistakes added newest-first
- small capped amount of new material
- duplicate position/answer elimination across buckets
- spare time filled from due/weakness/recent material, never extra novelty
- mixed source interleaving
- Start today’s study
- Daily study Training source
- per-exercise “why selected” banner
- spaced-repetition schedule updates preserved
- Training Analytics logs Daily study attempts
- shorter honest plan when insufficient material exists

Next candidate: v0.9.7 — post-session report + automatic tomorrow recommendation.


## v0.9.7 — Post-session report + tomorrow recommendation ✅

- active Daily Study session tracking
- unique positions attempted / planned progress
- explicit Finish & view report
- clean first-try / recovered / hint-assisted / unsolved breakdown
- performance split by daily source bucket
- “What improved” and “What failed”
- session-start vs final spaced-schedule comparison
- interval, streak, due-date change list
- automatic 15/20/30-minute tomorrow recommendation
- tomorrow due-load count
- carryover failed-focus labels
- novelty budget can drop to zero after weak/heavy sessions
- early session termination reported honestly
- latest 60 reports persisted locally
- latest report visible in Training and Play & Coach

Next candidate: v0.9.8 — weekly coach report + trend detection and study-goal adjustment.


## v0.9.8 — Weekly coach report + trend detection ✅

- week-to-date vs same elapsed portion of last week
- overall weekly attempts / accuracy / active-day comparison
- Improving / Declining / Steady / Insufficient weekly status
- per-weakness trend detection
- per-opening/repertoire trend detection
- explicit accuracy percentage-point deltas
- Increase / Maintain / Reduce next-week priority recommendations
- transparent planner multipliers
- completed-week reports frozen at local Monday rollover
- 52 completed weekly reports retained locally
- completed report automatically controls the following week's Daily Study ordering
- due repertoire reordered within eligible due cards
- weakness priorities multiplied before top-three selection
- new material reordered only inside the existing small novelty cap
- no changes to Stockfish grading, due timestamps, or new-material quota

Next candidate: v0.9.9 — goal-based training plans (opening target, tactical target, rating target) with 4–8 week progress tracking.


## v0.9.9 — Goal-based training plans ✅

- explicit Opening / Weakness / Rating-preparation goal types
- 4 / 6 / 8 week plans
- one primary active goal, paused/completed history retained
- frozen pre-goal baseline
- explicit measurable end targets
- weekly Baseline / Focus / Application / Consolidation milestones
- goal progress from accuracy/readiness + volume + active days + retention
- Ahead / On track / Behind / Insufficient pacing
- rating target explicitly treated as training-preparation goal, not Elo prediction
- active opening/weakness goal ×1.70 Daily Study focus
- rating preparation boosts top recurring weaknesses
- weekly-trend and goal multipliers combine with safety cap
- overdue severity remains above trend/goal reordering
- no changes to Stockfish grading, due dates, or novelty quota
- local persistent goal history

Next candidate: v1.0.0 — integrated Personal Chess Coach dashboard, data export/import, release QA and first stable release.


## v1.0.0 — First stable release ✅

- integrated Personal Chess Coach dashboard near top of core Play & Coach workflow
- dashboard: due memory / weakest area / weekly trend / repertoire / goal / last session
- one-click navigation from dashboard to specialist panels
- local JSON backup/export/import
- schema-validation and replacement restore semantics
- backup covers weakness/repertoire/spaced/analytics/daily/weekly/goals/Ollama preferences
- explicit exclusions for Stockfish executable, Ollama model binaries and unsaved game state
- v1 stable release badge
- `npm run release:qa`
- stable-release documentation
- backup documentation
- changelog
- first stable 1.0.0 package version

Post-1.0 candidates: installer/packaging, optional persistent game library, cloud-sync bridge, and richer longitudinal reports.


## v1.0.1 — Real-use stabilization + UX cleanup ✅

- persistent Small / Regular / Large text sizing
- review-all progress visibility
- quick core-workflow jumps
- large-text/narrow-header overflow hardening
- text-size preference included in backup
- no changes to engine/training/scheduler algorithms

Next substantial feature candidate: v1.0.2 — persistent local game library.
