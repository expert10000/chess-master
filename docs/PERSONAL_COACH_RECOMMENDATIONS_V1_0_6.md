# v1.0.6 — Personal Coach Recommendations from Game History

v1.0.6 turns persistent Game-Level Analytics diagnostics into ranked training actions.

## Ranking inputs

Recommendations are derived only from reviewed, non-model, non-archived games in the local Game Library.

The coach looks for:

- outright blunder rate;
- Opening / Middlegame / Endgame CPL gaps;
- phase deterioration versus the previous same-size window;
- White / Black CPL gaps;
- repeated high-CPL openings;
- overall recent CPL deterioration.

The user chooses the game-history window:

- Last 10
- Last 20
- Last 50

Sparse one-off evidence is deliberately ignored. The coach waits for repeated moves/games before ranking most diagnostic categories.

## Recommendation cards

Each ranked recommendation contains:

- priority rank;
- deterministic High / Medium / Watch priority;
- concise diagnosis;
- explicit recommended action;
- number of trainable positions;
- **Why?**;
- **Show evidence**;
- **Train now**.

Example:

`Middlegame CPL is 28 cp worse than opening across your last 20 reviewed games.`

## Why?

Why expands the exact metrics responsible for the recommendation. It does not ask an LLM to invent an explanation.

## Show evidence

The recommendation uses the same evidence engine as Analytics → Games Drill-Down and shows the highest-cost matching game/move rows with **Open move**.

## Train now

Train now builds up to seven exercises from the recommendation scope.

Priority order:

1. matching Blunder/Mistake/Inaccuracy positions;
2. if fewer than seven exist, high-CPL reviewed positions from the same scope are added;
3. duplicates are removed;
4. positions without a stored Stockfish best move are skipped.

Training uses the existing Stockfish-grounded exercise evaluator. No recommendation can alter the original review verdict or best move.

## Training Analytics

Recommendation exercises use a dedicated `coach` Training source and therefore appear separately in Training Analytics as **Coach recommendation** attempts.

If an exercise also has a known opening name, existing opening-accuracy analytics can still group it by that opening.

## No new persistence layer

Recommendations themselves are computed from Game Library data, so there is no additional recommendation storage key or migration. Game history remains the source of truth.
