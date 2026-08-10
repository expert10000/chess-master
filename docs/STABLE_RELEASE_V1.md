# Stockfish Coach v1.0.0 — First Stable Release

v1.0.0 is the first stable milestone of the local Stockfish Coach project.

## Product loop

The release now supports one continuous local coaching loop:

1. **Play & Coach**
   - play against native Stockfish;
   - inspect squares, attacks, defenses and ideas;
   - ask deterministic/optional Ollama follow-up questions.

2. **Review**
   - full-game Stockfish review;
   - verdicts, centipawn loss, best move, PV study;
   - evaluation timeline;
   - selected-move dashboard;
   - opening recognition and local explorer;
   - positional before/after comparison.

3. **Personal memory**
   - repertoire choices;
   - opening deviations;
   - weakness aggregation across reviewed games.

4. **Training**
   - mistakes;
   - reviewed moves;
   - opening deviations;
   - targeted weaknesses;
   - due spaced reviews;
   - adaptive Daily Study.

5. **Adaptive planning**
   - spaced repetition;
   - retention estimates;
   - training heatmap and analytics;
   - 15/20/30 minute daily planner;
   - post-session report;
   - tomorrow recommendation;
   - weekly trends;
   - next-week priority multipliers;
   - 4/6/8-week explicit goals.

6. **Integrated dashboard**
   - due load;
   - top weakness;
   - weekly training accuracy/trend;
   - repertoire size/deviations;
   - active-goal progress;
   - last Daily Study result;
   - one-click jumps to the underlying specialist panels.

7. **Backup**
   - explicit local JSON export/import for coach memory.

## Stable-release principles

- Stockfish remains authoritative for move evaluation.
- Optional Ollama may improve wording but does not overwrite engine facts.
- Heuristic concepts, retention estimates, training readiness and goal pace remain clearly labeled as teaching/management estimates.
- Rating goals are preparation goals, not Elo predictions.
- Weekly/goal priorities reorder eligible Daily Study material; they do not rewrite due dates or Stockfish verdicts.
- The app remains local-first.

## Upgrade path

v1.0.0 is designed as a direct overlay from v0.9.9. Existing local-storage keys remain unchanged, with backup support added above them.

## Version history

The release-by-release development history is maintained in [`../VERSIONS.md`](../VERSIONS.md).
