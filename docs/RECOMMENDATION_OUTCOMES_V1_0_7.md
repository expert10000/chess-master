# v1.0.7 — Recommendation Outcome Tracking

v1.0.7 closes the coaching loop:

`diagnosis → targeted intervention → future games → measured outcome`

## Starting an intervention

A Game-history coach recommendation still begins with **Train now**.

The resulting Training source is **Coach recommendation** and uses the exact reviewed Stockfish-grounded positions selected by the recommendation engine.

At the end of the targeted set, Training now shows:

**Complete & track outcome**

The intervention is recorded only when the user explicitly completes the recommendation session. Simply opening a recommendation does not create an outcome record.

The record stores:

- recommendation kind/title/scope;
- the original 10/20/50-game diagnostic window;
- baseline scoped metrics;
- planned positions;
- distinct attempted positions;
- solved positions;
- the set of personal games already present at completion time.

## What gets measured

After completion, the coach watches newly added **reviewed personal games** that are relevant to the recommendation scope.

Examples:

- Middlegame recommendation → games containing reviewed middlegame moves;
- As Black recommendation → reviewed games played as Black;
- French Defense recommendation → reviewed French games;
- Overall blunder recommendation → all newly reviewed personal games.

Archived games and Model games remain excluded.

Games already present before the intervention are never counted as post-training evidence, even if their metadata is updated later.

## Checkpoints

### First 10 relevant reviewed games

This is an **early checkpoint**.

The coach compares:

- average CPL;
- blunders/game;
- issues/game.

### First 20 relevant reviewed games

This is the more stable **20-game outcome**.

The first 20 games are frozen conceptually as the intervention's measurement window; later games do not silently rewrite that outcome.

## Outcome labels

The deterministic outcome labels are:

- **Improved**
- **Mixed**
- **Stable**
- **Worse**
- **Collecting**

Practical change thresholds:

- CPL improvement/worsening: at least 8 cp;
- blunder-rate improvement/worsening: at least 0.15 blunders/game.

If CPL and blunder rate move meaningfully in opposite directions, the result is **Mixed**.

These thresholds are coaching heuristics, not statistical significance tests.

## Evidence

Each outcome can be expanded to show post-training issue positions from the measured games.

**Open move** reconstructs the saved game and jumps to the exact historical reviewed ply.

## Important interpretation

Outcome tracking is observational.

If middlegame CPL improves after a middlegame intervention, the app can correctly say:

> the measured result improved after the intervention.

It cannot scientifically prove that the training caused the improvement. Opponent strength, opening mix, time controls, game count and ordinary variance can also affect the result.

This distinction is shown in the interface.

## Storage

Local key:

`stockfish-coach.recommendation-outcomes.v1`

The outcome history is included in JSON Backup / Restore.

Up to 40 intervention records are retained.
