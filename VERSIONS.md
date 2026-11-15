# Stockfish Coach — Version History

This file tracks the main product milestones. Patch/hotfix releases are listed where they materially changed behavior or UX.

## 1.15.4 — Fast Play Strength Integrity

- Fast paces use strength-aware calculation floors instead of overriding every opponent to 50/100 ms.
- Higher-level opponents no longer silently fall back to a heuristic legal move after a Stockfish recovery.

---

## 1.15.3 — Polished Move Motion

- Engine pieces now lift, glide, and settle with a subtle motion glow.
- Fast modes retain short, responsive transition budgets.

---

## 1.15.2 — Live Play Render Performance

- Defers all detailed coach panels during active play to keep board input and controls responsive.
- The workspace opens on demand and automatically when using a workflow shortcut.

---

## 1.15.1 — Fast End-to-End Recovery

- Caps the entire Fast/Very-fast engine request, not just the calculation phase, at about 1.2 seconds.
- Recovers by restarting Stockfish and making a legal fallback move when necessary.

---

## 1.15.0 — Very Fast Play + Move Motion

- Adds a 50 ms Very fast pace alongside Fast and Coach.
- Gives engine moves a smoother, shorter visual transition.

---

## 1.14.3 — Fast Play Recovery Hotfix

- Detects and recovers from a stuck Fast Stockfish request in about a second instead of waiting through the normal analysis grace period.

---

## 1.14.2 — Fast Play Latency Hotfix

- Removes repeated Stockfish configuration waits from consecutive Fast moves.
- Uses a fixed 100 ms search target and lower-overhead engine resources in Fast pace.

---

## 1.14.1 — Startup Hotfix

- Fixes a v1.14.0 initialization-order crash in the personal strength model.

---

## 1.14.0 — Coach Conversation 2.0

- Natural-language coach understands stored personal trends, intervention evidence, motifs, and the active tournament cycle.
- Whole-profile questions are answered from transparent saved evidence rather than only the board on screen.

---

## 1.13.0 — Season / Tournament Training Cycle

- Persistent preparation, competition, post-event analysis, and consolidation phases.
- Tournament goals track whether planned themes appeared in matched event games.
- Summarizes preparation → execution → result with reviewed CPL where available.

---

## 1.12.0 — Model Games / Master Comparison

- Adds model-game evidence alongside personal decisions and Stockfish in training.
- Uses explicitly marked reference games and links to their exact continuations.

---

## 1.11.0 — Game Prediction / Pre-Move Risk Coach

- Training-only alerts identify elevated personal mistake risk in structurally similar positions.
- Shows exact reviewed examples and a transparent personal error rate.
- Disabled outside training to protect fair rated play.

---

## 1.10.0 — Training Experimentation / A-B Coach

- Adds evidence-led A/B comparisons between competing coaching methods.
- Alternates the next suggested arm toward the less-tested method.
- Uses existing 10/20-game post-intervention outcomes with intentionally conservative evidence labels.

---

## 1.0.x — Stable line

## 1.1.0 — Unified Personal Coach 2.0

- Reframes the top coach view as **Today’s home** with a single clear next action.
- Shows today's plan, strongest measured intervention type, recent 10-game quality, latest outcome checkpoint, top weakness, goal progress and weekly study result together.
- Keeps detailed panels as evidence drill-downs, reducing dashboard scrolling without hiding functionality.

---

## 1.1.1 — Adaptive Session Composer

- Supports 10, 20, 30 and 45-minute study presets.
- Builds the mix from available due review, weaknesses, recent errors and new material, rather than retaining a fixed bucket count.
- Makes each selected exercise’s inclusion reason visible before study begins.

---

## 1.1.2 — Skill Map / Chess Curriculum Graph

- Adds an eight-skill persistent learner model with evidence, confidence, trend, and recommended training per skill.
- Combines repeated concept evidence with opening/middlegame/endgame reviewed-game evidence.
- Persists and backs up the model locally.

---

## 1.2.0 — Repertoire Builder 2.0

- Adds White/Black repertoire trees with linked opening-memory evidence.
- Shows preferred paths, available alternatives, weak/forgotten nodes and transposition markers.
- Adds branch-level repertoire recall training.

---

## 1.3.0 — Endgame Curriculum + Syzygy

- Adds a four-part endgame curriculum and automatic personal endgame mistake exercises.
- Adds exact eligible-position Syzygy WDL/DTZ lookup and only-optimal-move detection.

---


### 1.0.8 — Intervention History Analytics + Fast Play

- Ranks completed training-intervention types by average measured post-training improvement.
- Groups outcomes into Phase training / Opening repair / White-Black side training / Blunder drills / Overall performance.
- Uses 20-game outcome when available, otherwise measured 10-game checkpoint.
- Shows average CPL improvement, blunder reduction, issue reduction, solve rate and outcome mix.
- Marks 1–2 samples Provisional, 3–4 Developing, 5+ Established.
- Adds expandable intervention history.
- Adds **Fast — play first** pace: shorter opponent search/animation and deferred automatic move review.
- Keeps **Coach — auto review** as the full-review workflow.
- Persists play pace and includes it in backup.



### 1.0.7 — Recommendation Outcome Tracking

- Closes the loop from game-history diagnosis → Coach recommendation training → measured future-game outcome.
- Adds explicit **Complete & track outcome** for recommendation training sessions.
- Freezes scoped baseline CPL/blunders/issues at intervention completion.
- Measures the first 10 and first 20 newly reviewed relevant personal games.
- Outcomes: Collecting / Improved / Mixed / Stable / Worse.
- Shows post-training evidence positions with Open move.
- Excludes archived/model games and never counts pre-intervention games as future evidence.
- Persists outcome history locally and includes it in Backup / Restore.


### 1.0.6 — Personal Coach Recommendations from Game History

- Ranked actions derived from persistent game-history diagnostics.
- Detects phase gaps/trends, color gaps, opening problems, blunder rate and overall decline.
- Last 10 / 20 / 50 game windows.
- Why? / Show evidence / Train now workflow.
- Up to seven exact saved positions per recommendation.
- Dedicated Coach recommendation Training source and Training Analytics label.


### 1.0.5 — Analytics → Games Drill-Down + Comparison Explorer

- Makes primary game-analytics numbers clickable.
- Shows exact saved games and reviewed moves responsible for CPL, blunder, issue, color, phase and opening metrics.
- Opens analytics evidence at the exact historical game ply.
- Adds Last N vs previous N, White vs Black, opening-vs-opening, and phase comparison modes.
- Adds “games containing these blunders” evidence grouping.
- Uses existing persistent game-library data; no new storage schema.


### 1.0.4 — Saved Game Search / Filters / Tags / Notes / Pinned Games

- User tags and free-form notes per saved game.
- ★ pinned/favorite games and separate model-game marking.
- Reversible archive and permanent delete.
- Advanced filters: White/Black, result, source, review state, opening, weakness, CPL range and date range.
- Sorting: newest, worst CPL, most issues, opening.
- Search includes tags and notes.
- Model and archived games excluded from personal game-performance analytics.


### 1.0.3.3 — Review Layout Polish

- Board / Balanced / Details workspace presets.
- Pin/unpin board.
- Compact history/inspector review chrome.
- Follow selected move + Focus selected.
- Persistent review-layout preference and backup support.


### 1.0.3.2 — Review Board Fit & Scrolling UX Hotfix

- Makes the desktop review board column internally scrollable when review chrome is taller than the viewport.
- Reduces checkerboard size slightly in review/history/PV mode so the full board fits more reliably.
- Compacts history-mode and board-inspector headers to avoid covering too much vertical space.



### 1.0.3.1 — Game Analytics Null-Window Hotfix

- Fixes a renderer crash when Game-Level Analytics has current reviewed games but no previous 10/20/50-game comparison window.
- Adds regression coverage for sparse game libraries.
- No changes to analytics formulas, board themes, Stockfish review, or training behavior.



### 1.0.3 — Game-Level Analytics + Phase Statistics

- Aggregates the persistent game library over the last 10 / 20 / 50 reviewed games.
- Shows average CPL, blunders/game, issues/game, White/Black split, and opening performance.
- Adds Opening / Middlegame / Endgame strength and trend cards.
- Compares the current window against the previous same-size window.
- Adds Current / Brown / Green checkerboard themes.
- Stores board-theme preference locally and includes it in backup/restore.



### 1.0.2 — Persistent Local Game Library

- Every played/imported game is stored once it has moves and updated as reviews change.
- Search by players, result, event, opening/ECO/variation, and per-game weaknesses.
- Stores result, review status, average CPL, issue count and compact review snapshots.
- Direct Open / Review / Train mistakes actions.
- Deduplicates identical imported games.
- Game library included in local JSON backup.
- Small / Regular / Large text enlarged by ~1.2 pt; board piece sizing unchanged.



### 1.0.1 — Real-Use Stabilization + UX Cleanup

- Persistent Small / Regular / Large interface text sizes.
- Explicit full-game Review All progress with percentage and current SAN.
- Coach / Review / History / Study workflow shortcuts.
- Large-text and narrow-header overflow hardening.
- UI text-size preference included in local backup.
- No changes to Stockfish grading or adaptive-training algorithms.


### 1.0.0 — First Stable Release

- Integrated Personal Chess Coach dashboard.
- Unified the long-term coaching flow across review, memory, training, analytics, and goals.
- Added local JSON backup/export/import for persistent coach data.
- Added stable release documentation and `npm run release:qa`.
- Added release QA checklist and static release-integrity gate.
- Stable architecture documented in `README.md`.

The 1.0.x line is intended primarily for stabilization, usability refinement, bug fixes, packaging, and release hardening.

---

## 0.9.x — Personalization and adaptive learning

### 0.9.9 — Goal-Based Training Plans

- 4-, 6-, and 8-week plans.
- Opening, weakness, and rating-preparation goals.
- Baselines, weekly milestones, measurable targets, and progress pacing.
- Goal priorities influence Adaptive Daily Study without changing Stockfish grading or due dates.

### 0.9.8 — Weekly Coach Report + Trend Detection

- Week-over-week comparison.
- Improving / declining weakness detection.
- Opening/repertoire recall trends.
- Automatic next-week study-priority multipliers.

### 0.9.7 — Post-Session Report + Tomorrow Recommendation

- Clean first-try, recovered, hint-assisted, and unresolved position summaries.
- Spaced-schedule before/after comparison.
- Automatic 15/20/30-minute recommendation for tomorrow.

### 0.9.6 — Adaptive Daily Study Planner

- Automatic 15-, 20-, or 30-minute study sessions.
- Mixes due repertoire, weakest areas, recent mistakes, and limited new material.
- Deduplicates and interleaves training material.

### 0.9.5.1 — Review Workspace UX

- Review-first sidebar ordering.
- Selected move shown directly in the review dashboard.
- Review All auto-reveals the review dashboard.
- Board remains visible beside review on normal desktop widths.

### 0.9.5 — Training Analytics + Heatmap + Retention Forecast

- Persistent Training attempt log.
- Practice heatmap.
- Accuracy by weakness and opening.
- 7/30-day review-load forecast.
- Retention/stability estimates.

### 0.9.4 — Spaced Repetition

- Due dates for repertoire and weakness exercises.
- Correct answers expand intervals.
- Incorrect answers return quickly for relearning.

### 0.9.3 — Personal Weakness Profile + Targeted Training

- Cross-game weakness aggregation.
- Recurring categories such as hanging pieces, missed tactics, king safety, pawn structure, development, and opening deviations.
- Train-my-weakest-area workflow.

### 0.9.2.1 — Opening Taxonomy + Clear Arrow Sources

- Type / Family / Branch / Variation opening taxonomy.
- Separate board semantics for Stockfish, local book, and personal repertoire arrows.

### 0.9.2 — Positional Before/After Comparison

- Deterministic teaching profiles for development, king safety, center control, pawn structure, activity, and tactical pressure.
- Played-move vs best-move positional comparison.

### 0.9.1 — Opening Mistake Coach + Repertoire Memory

- Persistent repertoire choices.
- Opening deviation memory.
- Repeated deviation tracking and recall practice.

### 0.9.0 — Opening Recognition + Local Opening Explorer

- Offline opening recognition and ECO labeling.
- Curated local opening continuations.
- Opening-deviation training.

---

## 0.8.x — Full-game review and board explanation

### 0.8.8 — Compare Two Moves Visually

- Side-by-side played move vs Stockfish best move.
- Centipawn-loss visualization.
- Independent PV study for either line.

### 0.8.7 — Full PV Study Controls

- Start/end/previous/next/play/pause controls.
- 0.5× / 1× / 2× playback.
- Keyboard PV navigation.

### 0.8.6 — Visual Attack/Defense Overlay

- White/black control arrows.
- Legal-destination overlay.
- Visual attack/defense inspection.

### 0.8.5 — Any-Square / Any-Piece Inspection

- Inspect ordinary squares and pieces, not only precomputed ideas.
- Contextual board questions.

### 0.8.4 — Interactive Board Explanations

- Click arrows/highlights for explanations.
- Board idea explanation card and follow-up questions.

### 0.8.3 — Board Ideas + Animated PV

- Best/played/candidate/tactical arrows.
- Concept highlights.
- Animated principal variation player.

### 0.8.2 — Evaluation Timeline

- White-positive/Black-negative evaluation timeline.
- Clickable history navigation.
- Issue markers.

### 0.8.1 — Multi-Game PGN Selection

- Detects and selects games from concatenated PGN collections.

### 0.8.0 — PGN/FEN Import + Full Game Review

- Local PGN import.
- FEN import/copy.
- Full-game Stockfish review and summary.

---

## 0.7.x — Training mode

### 0.7.0 — Training Mode

- Separate Play & Coach and Training modes.
- Mistake-based exercises.
- Hints, grading, retry, explanation, line study, and session score.

---

## 0.6.x — Conversational coaching

### 0.6.2 — Deterministic Concept Engine

- Tactical and positional concept extraction.
- Pins, skewers, forks, hanging pieces, pawn structure, development, center, king safety, and related concepts.

### 0.6.1 — Optional Ollama Integration

- Local Ollama wording/refinement layer.
- Stockfish remains authoritative.

### 0.6.0 — Conversational Coach

- Free-text chess questions.
- Stockfish-grounded answers.
- MultiPV and explicit candidate analysis.

---

## 0.5.x — Interactive trainer

### 0.5.0 — Why? / Why Not? Trainer

- Fixed coaching questions.
- Forced candidate analysis with Stockfish `searchmoves`.

---

## 0.4.x — Persistent coaching

### 0.4.0 — Persistent Coaching Reviews

- Cached move verdicts.
- Persistent issue navigation.
- Review-all workflow.

---

## 0.3.x — History and branching

### 0.3.1 — Play From Here / Create Variation

- Branch from a historical position.
- Maintain multiple lines.

### 0.3.0 — History Navigation

- Exact historical board reconstruction.
- First/previous/next/last navigation.
- Keyboard history controls.

---

## 0.2.x — Robust board interaction

### 0.2.2 — State Machine

- Explicit app/game phases.
- Safer engine-request cancellation and stale-result handling.

### 0.2.1 — Board Feedback

- Last-move, selection, check, thinking, and animation feedback.

### 0.2.0 — Move Input

- Click and drag move entry.
- Legal target indicators.
- Promotion handling.

---

## 0.1.x — Initial application shell

- Electron + React + TypeScript project shell.
- Responsive chessboard/workspace foundation.
- Native Stockfish integration groundwork.

---

## Versioning policy

- **Major (`1.x → 2.x`)**: substantial product/architecture change or compatibility boundary.
- **Minor (`1.0 → 1.1`)**: meaningful new user-facing capability.
- **Patch (`1.0.0 → 1.0.1`)**: stabilization, bug fixes, UI refinement, QA, or small backwards-compatible improvements.
- Hotfix-style versions used during the 0.x development phase (for example `0.9.2.1`) remain documented as historical milestones.
