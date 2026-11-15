# v1.0.8 — Intervention History Analytics

v1.0.8 answers a new question:

> Which kinds of training have actually tended to work best for this player?

It aggregates completed recommendation interventions whose 10-game or 20-game outcome is already measurable.

## Training types

Coach recommendation kinds are grouped into understandable intervention families:

- **Phase training** — phase-gap and phase-decline recommendations
- **Opening repair** — opening-specific recommendations
- **White/Black side training** — color-gap recommendations
- **Blunder drills** — repeated-blunder recommendations
- **Overall performance** — overall-decline recommendations

## Which checkpoint is used?

For each intervention:

1. use the **20-game outcome** if it exists;
2. otherwise use the **10-game checkpoint** if it exists;
3. otherwise the intervention remains Collecting and is not included in the ranking.

This means mature 20-game evidence automatically replaces the earlier 10-game snapshot.

## Ranking

The ranking is deliberately transparent.

Training types are ordered by:

1. average CPL improvement;
2. average blunders/game reduction;
3. percentage of measured interventions marked Improved;
4. sample count.

Improvement is shown with positive numbers:

- `+18 cp` means average CPL fell by 18 cp after training;
- `+0.25/game` means blunders/game fell by 0.25.

No opaque machine-learning score is used.

## Evidence confidence

Because one good intervention is not enough to claim that a training method reliably works:

- 1–2 measured interventions → **Provisional**
- 3–4 → **Developing**
- 5+ → **Established**

These are sample-size labels, not statistical confidence intervals.

## Metrics per training type

The panel reports:

- number of measured interventions;
- 10-game vs 20-game outcomes;
- average CPL improvement;
- average blunder reduction;
- average issue reduction;
- improved-outcome rate;
- average training solve rate;
- Improved / Mixed / Stable / Worse counts.

## History

The expandable history lists each measured intervention with:

- completion date;
- training type;
- title;
- 10-game or 20-game checkpoint used;
- CPL improvement;
- blunder reduction;
- outcome verdict.

## Interpretation

This is personal observational evidence.

A high ranking means that, in this player's recorded history, that intervention type has been followed by stronger measured chess performance more often / by a larger amount.

It does **not** prove that the intervention caused the improvement.
