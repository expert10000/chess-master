# Changelog

## 1.15.4 — Fast Play Strength Integrity

- Replaces the universal 50/100 ms Fast budgets with short, difficulty-specific calculation floors.
- Expert, Master, and Maximum now receive enough calculation to make their advertised strength meaningful, while still using the responsive live-play path.
- Removes the silent legal-move fallback for all but Beginner, so an Expert engine cannot appear to make a weak move after an engine stall.

## 1.15.3 — Polished Move Motion

- Refines engine moves into a readable lift, eased glide, and gentle landing with a subtle travel glow.
- Gives Very fast / Fast / Coach transitions 95 / 170 / 250 ms respectively: smoother without reintroducing the earlier interaction lag.
- Respects reduced-motion system preferences.

## 1.15.2 — Live Play Render Performance

- Keeps the detailed coach workspace unmounted by default during a live game, so board clicks no longer re-render its history, analytics, curriculum, and backup panels.
- Adds an explicit Open workspace control; Coach/Review/History/Games/Study shortcuts open the needed workspace automatically.
- This isolates normal interaction latency from Stockfish analysis latency.

## 1.15.1 — Fast End-to-End Recovery

- Enforces a 1.2-second limit around the entire Fast/Very-fast request, including Stockfish startup and readiness.
- Restarts Stockfish when that limit is exceeded.
- Uses an immediate legal fallback move in Fast/Very-fast modes so a casual game never remains blocked by an engine stall.

## 1.15.0 — Very Fast Play + Move Motion

- Adds a distinct Very fast pace with a 50 ms Stockfish search target and minimal 70 ms engine move transition.
- Keeps Fast at a 100 ms target and Coach at normal thinking plus auto-review.
- Refines engine move motion with a brief lift-in and eased glide, while keeping it short enough not to obscure response speed.

## 1.14.3 — Fast Play Recovery Hotfix

- Fast searches now have a short watchdog instead of the normal 12-second analysis grace period.
- A stuck Fast request stops and restarts Stockfish before the next move.
- Fast mode now displays “Fast Stockfish responding” rather than the selected opponent-strength label.

## 1.14.2 — Fast Play Latency Hotfix

- Fast play now uses a fixed 100 ms search target.
- Stockfish option setup is cached; unchanged thread/hash/strength settings no longer trigger an `isready` wait for every move.
- Fast searches use one thread and a compact 32 MB hash to minimize UI contention and setup time.

## 1.14.1 — Startup Hotfix

- Fixes the startup crash caused by reading the synchronized skill map before it was initialized.

## 1.14.0 — Coach Conversation 2.0

- Coach chat now answers whole-profile questions from saved game, motif, intervention, and season-cycle evidence.
- Adds Black-game improvement explanations and tournament-preparation guidance with confidence notes.
- Whole-profile answers do not require Stockfish; board-specific questions retain engine analysis.

## 1.13.0 — Season / Tournament Training Cycle

- Adds persistent tournament-cycle phases: preparation, competition, post-event analysis, and consolidation.
- Supports tournament-specific goals with keyword evidence for whether the prepared topic appeared in event games.
- Connects preparation goals to matched game count, results, and average reviewed CPL.

## 1.12.0 — Model Games / Master Comparison

- Adds a study-position comparison across personal games, saved model games, and the exercise's Stockfish reference.
- Uses only games explicitly marked Model, keeping human reference material separate from personal analytics.
- Provides exact model-game continuations and direct drill-down to the source game.

## 1.11.0 — Game Prediction / Pre-Move Risk Coach

- Adds a training-only personal risk alert based on structurally similar reviewed positions from the user's own history.
- Shows comparable-position count, historical issue rate, the dominant recurring risk, and drill-down to examples.
- Explicitly disabled outside training so it cannot assist fair rated play.

## 1.10.0 — Training Experimentation / A-B Coach

- Adds focused A/B comparisons for competing training strategies, beginning with tactical calculation drills versus positional decision exercises.
- Alternates the next assignment toward the less-tested arm, then compares measured next-10/20-game CPL outcomes.
- Reports collecting, no-clear-difference, or evidence-favors states with conservative evidence labels; it never claims statistical certainty.

## 1.9.0 — Adaptive Training Optimizer

- Adds minute-based adaptive blocks to every 10/20/30/45/60-minute session.
- Protects due repertoire while allocating the remainder across recurring patterns, recent calculation evidence, and experimental material.
- Shows the measured intervention evidence behind a boosted block when available.

## 1.8.0 — Personalized Chess Curriculum / Skill Graph

- Explicit prerequisite graph across calculation, tactics, positional play, and endgames.
- Every node reports strength, confidence, trend, evidence, mastery, prerequisite, and next target.
- Strength-model and motif-memory evidence are mapped into the graph.
- Prerequisite-first coaching guidance, including rook activity before conversion where evidence supports it.

## 1.7.0 — Cross-Game Pattern Mining + Motif Memory

- Mines repeatable concrete motifs from reviewed moves and position context.
- Shows frequency, last-20-game count, average CPL, trend, and representative examples.
- Adds focused motif training from the exact contributing positions.

## 1.6.0 — Personal Rating / Strength Model

- Transparent evidence-based estimates for tactical consistency, opening stability, endgame conversion, calculation quality, and phase CPL.
- Low / emerging / grounded confidence follows available reviewed evidence.
- Monthly overall evidence trajectory from saved reviewed games.
- Explicitly not an Elo prediction.

## 1.5.0 — Time-Control Awareness

- Classifies imported PGNs into bullet, blitz, rapid, classical, or unknown from TimeControl headers.
- Separate CPL, blunder-rate, and opening/middlegame/endgame profiles for each context.
- Context-aware recommendation logic; unknown controls are excluded rather than mixed.

## 1.4.0 — Opponent / Tournament Preparation

- Separate opponent-PGN import and preparation workspace.
- Opening tendency and likely-repertoire summaries from imported games.
- Model-game marking and a practical pre-game checklist.
- Opponent data stays separate from personal performance evidence; saved games against that opponent provide the basis for post-event comparison.

## 1.3.1 — Endgame Outcome Tracking

- Starts module-specific closed-loop tracking for king+pawn, rook, queen, and minor-piece endings.
- Freezes endgame CPL and conversion-quality baselines, then measures the first five newly reviewed relevant games.
- Reports CPL and conversion deltas with Collecting / Improved / Stable / Worse outcomes.

## 1.3.0 — Endgame Curriculum + Syzygy

- Four-module endgame curriculum: king+pawn, rook, queen, and minor-piece endings.
- Automatic exercises from reviewed personal endgame inaccuracies, mistakes, and blunders.
- Exact 3–7 piece Syzygy tablebase lookup with WDL, DTZ, and a unique-optimal-move indication when applicable.
- Transparent eligibility and offline/error states; tablebase results are never guessed.

## 1.2.1 — Opening Preparation Mode

- Compact prep packs for Black against the Sicilian and Black versus 1.d4.
- Packs combine matching saved repertoire nodes with actual opening-deviation evidence.
- Highlights matching repertoire lines never trained and deviation frequency from played games.

## 1.2.0 — Repertoire Builder 2.0

### Added

- White and Black repertoire tree views from saved opening choices.
- Preferred moves, remembered alternatives, weak nodes, forgotten recall nodes, and transposition markers.
- Node-level played-deviation/performance evidence directly alongside the relevant opening move.
- **Train branch** to practise a saved continuation in sequence.

## 1.1.2 — Skill Map / Chess Curriculum Graph

### Added

- Persistent eight-skill learner model: opening development, king safety, tactical vision, calculation, pawn structure, piece activity, endgames, and conversion.
- For each skill: current evidence, evidence confidence, trend, and a direct recommended next training path.
- Local backup/restore coverage for the skill-map state.

### Notes

- Evidence is transparent: weakness observations feed concept skills, while reviewed opening/middlegame/endgame performance feeds phase skills. Confidence and trend remain conservative when data is sparse.

## 1.1.1 — Adaptive Session Composer

### Added

- 10-, 20-, 30-, and 45-minute session presets.
- Dynamic allocation of positions across due review, recurring weaknesses, recent errors, and limited new material according to which evidence is actually available.
- A visible “Why each exercise is here” list for the exact generated session.

### Changed

- Replaces the fixed Daily Study bucket recipe with a capped, evidence-led composer. Due review remains ahead of new material, while goal, weekly, and intervention priorities continue to influence ordering.

## 1.1.0 — Unified Personal Coach 2.0

### Added

- A single action-oriented **Today’s home** at the top of the coach workspace.
- Immediate view of today’s plan, top recurring weakness, best measured training method, recent game quality, latest intervention outcome, goal progress, and weekly training.
- One clear primary action: start today’s plan; supporting cards jump directly to their underlying evidence.

### Changed

- The dashboard now consolidates the most important daily coaching signals before the detailed specialist panels, reducing navigation and scrolling without removing any evidence or controls.

## 1.0.9 — Intervention-Aware Adaptive Planning

### Added

- Daily Planner uses measured intervention history as a personal allocation signal.
- Repeated material CPL gains from Phase training or Opening repair reallocate about 20% of eligible daily positions toward that method.
- A 20% exploration reserve protects under-tested methods; overdue repertoire remains authoritative.

### Notes

- This activates only after two measured interventions and a mean CPL improvement of 10 cp or more; it is an observational heuristic, not a causal claim.

## 1.0.8 — Intervention History Analytics + Fast Play

### Added

- intervention-history ranking by measured CPL/blunder improvement;
- intervention family aggregation and sample-confidence labels;
- expandable per-intervention measured history;
- Play pace selector with Fast and Coach modes.

### Changed

- Fast pace uses shorter opponent search and animation and defers automatic move review.
- Coach pace retains normal think time and automatic review.

## 1.0.7 — Recommendation Outcome Tracking

### Added

- explicit completion of Coach recommendation training interventions;
- stored intervention baselines and training completion counts;
- automatic 10-game preliminary and 20-game outcome measurement;
- scoped future-game tracking for phases, colors, openings and overall recommendations;
- deterministic Improved / Mixed / Stable / Worse outcome labels;
- post-training issue evidence with direct Open move actions;
- persistent recommendation-outcome history in backup/restore.

### Notes

- Outcome tracking is observational and does not claim causal proof.

## 1.0.6 — Personal Coach Recommendations from Game History

### Added

- ranked Personal Coach actions from persistent game-history analytics;
- phase-gap, phase-decline, White/Black, opening, blunder-rate, and overall-trend recommendations;
- Why? and exact evidence expansion;
- Train now with up to seven exact diagnostic positions;
- dedicated Coach recommendation Training source.

## 1.0.5 — Analytics → Games Drill-Down + Comparison Explorer

### Added

- clickable game-level analytics metrics;
- exact contributing game/move evidence;
- Open move navigation to a stored historical ply;
- games-containing-evidence grouping;
- Last N vs previous N comparison;
- White vs Black comparison;
- opening-vs-opening comparison;
- Opening / Middlegame / Endgame comparison.

## 1.0.4 — Saved Game Organization

### Added

- tags and notes for saved games;
- ★ pinned favorites and model-game marking;
- archive/restore and permanent delete;
- White/Black, result, source, review-state, opening, weakness, CPL and date filters;
- newest / worst-CPL / most-issues / opening sorting;
- search across user tags and notes.

### Changed

- automatic game-library updates preserve user metadata;
- archived and model games no longer contribute to personal Game-Level Analytics.

## 1.0.3.3 — Review Layout Polish

### Added

- Board / Balanced / Details review layout presets;
- pin/unpin board control;
- compact review headers;
- follow-selection and manual Focus selected controls;
- persistent review-layout preference included in backup/restore.

## 1.0.3.2 — Review Board Fit & Scrolling UX Hotfix

### Improved

- Review/history mode now keeps the left board column internally scrollable on desktop so you no longer need to scroll the entire page just to reveal the lower part of the board.
- The review board automatically shrinks a bit more when history/PV headers are visible, so the checkerboard stays fully visible more often.
- History and board-inspector headers use a denser layout in review mode to reduce vertical space.

## 1.0.3.1 — Game Analytics Null-Window Hotfix

### Fixed

- Game-Level Analytics no longer crashes when fewer than two full comparison windows of reviewed games exist.
- Previous-window CPL/blunder deltas now remain `null` until a previous window is actually available.

## 1.0.3 — Game-Level Analytics + Phase Statistics

### Added

- game-level analytics panel over the last 10 / 20 / 50 reviewed games;
- White vs Black split and opening-performance summaries;
- Opening / Middlegame / Endgame strength and trend cards;
- Current / Brown / Green checkerboard themes;
- local board-theme preference included in backup/restore.

### Changed

- Personal Coach dashboard adds direct jumps to Game analytics and Training analytics.

## 1.0.2 — Persistent Local Game Library

### Added

- searchable persistent local game library;
- automatic saving/updating of played, imported, and reviewed games;
- PGN/result/opening/ECO/review-status/CPL/issues/weakness metadata;
- Open / Review missing / Train mistakes actions;
- game-library inclusion in backup/restore.

### Changed

- all Small / Regular / Large interface text is approximately 1.2 pt larger;
- chess-piece sizing remains unchanged.

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
