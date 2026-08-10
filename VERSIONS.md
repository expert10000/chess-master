# Stockfish Coach — Version History

This file tracks the main product milestones. Patch/hotfix releases are listed where they materially changed behavior or UX.

## 1.0.x — Stable line


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
