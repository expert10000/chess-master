# v0.9.8 — Weekly Coach Report + Trend Detection

v0.9.8 adds a weekly layer above Training Analytics and the Adaptive Daily Study Planner.

## Live week-over-week comparison

The Weekly Coach dashboard compares:

- **this week to date**
- against the **same elapsed part of last week**

Using the same elapsed window avoids comparing, for example, Monday morning against an entire seven-day previous week.

The top summary includes:

- attempts;
- training accuracy;
- accuracy percentage-point change;
- active training days;
- overall Improving / Declining / Steady / Insufficient status.

At least three attempts in both windows are required for a reliable overall status.

## Weakness trends

Training attempts with a `weaknessLabel` are compared by category:

- Missed tactics
- Hanging pieces
- King safety
- Pawn structure
- Development
- Opening deviations
- or any later category carried by Training exercises.

A category requires at least two attempts this week to establish a useful current signal.

Trend states:

- **Improving** — ≥ +12 percentage points vs last week;
- **Declining** — ≤ −12 percentage points;
- **Stable** — inside that range;
- **New** — enough current attempts, but too little prior-week data;
- **Insufficient** — fewer than two current attempts.

## Opening trends

The same logic is applied to actual opening/repertoire Training attempts using their stored `openingName`.

This supports exact trained lines such as:

- French Defense · Advance
- Sicilian Defense · Najdorf
- Ruy Lopez · Morphy Defense

The app does not infer opening proficiency merely from having an opening in the repertoire; it uses actual training recall results.

## Next-week priority preview

Each trainable trend receives an explicit multiplier.

Examples:

- declining area: **×1.55**
- very low current accuracy: **×1.45**
- below 75% consolidation: about **×1.20–1.30**
- normal/establishing area: around **×1.00–1.05**
- stable/improving ≥88–90%: **×0.80–0.85**

A reduction never deletes material and never changes Stockfish grading. It only makes stronger areas less likely to consume limited planner slots.

## Weekly rollover

Live week-to-date trends are a **preview**.

At the first app run after a calendar week closes (local Monday boundary), v0.9.8 freezes the completed prior week into local weekly memory:

`stockfish-coach.weekly-coach.v1`

The latest 52 completed reports are retained.

That completed report's priorities become active for the following calendar week.

This avoids a moving target: Tuesday's Daily Study should not radically reorder itself just because two more attempts were logged Tuesday afternoon.

## Daily Study integration

The active completed-week priority profile is passed into v0.9.6's Daily Study Planner.

It affects ordering in three places:

1. **due repertoire**
   - due cards still remain due;
   - overdue severity is grouped first (very overdue cards cannot be displaced by a trend boost);
   - inside the same overdue-urgency band, openings needing more work rise earlier.

2. **weakest-area examples**
   - v0.9.3 weakness priority is multiplied by the weekly trend multiplier;
   - this can promote a declining category into the top-three sampled weakness set.

3. **new material**
   - within the already-small v0.9.6 novelty cap, material related to an active priority can be selected first.

The planner displays **Weekly coach adjustment applied** when selected positions are actually affected.

## Safety / interpretation

Weekly multipliers never:

- overwrite Stockfish analysis;
- change due timestamps;
- make an incorrect move correct;
- add extra new-material slots;
- erase strong areas from training.

They only allocate scarce Daily Study positions more intelligently.

Weekly trend labels describe observed **training performance**, not guaranteed changes in over-the-board chess strength.
