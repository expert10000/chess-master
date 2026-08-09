# v0.9.6 — Adaptive Daily Study Planner

v0.9.6 adds a daily-session constructor above the existing Training, weakness, repertoire, and spaced-repetition systems.

## Goal

Instead of asking the user to decide whether to study:

- repertoire;
- weaknesses;
- current-game mistakes;
- or new cards;

the planner builds one mixed session targeted at roughly **15, 20, or 30 minutes**.

The default is 20 minutes.

## Position targets

The first version estimates roughly 90 seconds per position:

| Session | Target positions |
|---|---:|
| 15 min | 10 |
| 20 min | 13 |
| 30 min | 20 |

If the library does not contain enough distinct positions, the planner creates a shorter honest plan rather than duplicating filler.

## Four buckets

### 1. Due repertoire

Highest priority goes to saved repertoire cards that:

- have already been reviewed at least once;
- are currently due or overdue.

Brand-new repertoire cards do **not** count as overdue repertoire. They belong to the New Material bucket.

### 2. Weakest areas

The planner uses the v0.9.3 Weakness Profile priority ordering.

It draws examples round-robin from up to the top three trainable weakness categories, rather than filling the whole session with only one category.

If the weakness example already has a v0.9.4 spaced-repetition card, the planner keeps that card id so the training result updates its schedule.

### 3. Recent mistakes

Current reviewed game mistakes are selected newest-first:

- Inaccuracy;
- Mistake;
- Blunder.

If there are not enough current-game mistakes, recent stored weakness examples can fill the bucket.

### 4. New material

New spaced cards with zero reviews are introduced only in a small amount:

- 15 minutes: up to 1;
- 20 minutes: up to 1;
- 30 minutes: up to 2.

This prevents the scheduler from continually adding novelty while overdue/repeated material is forgotten.

## Default mix

The target mix is:

| Duration | Due repertoire | Weakest | Recent | New |
|---|---:|---:|---:|---:|
| 15 min | 4 | 3 | 2 | 1 |
| 20 min | 5 | 4 | 3 | 1 |
| 30 min | 7 | 6 | 5 | 2 |

These are targets, not hard quotas. If one bucket is undersupplied, the planner fills spare time from due reviews, recurring weaknesses, and recent mistakes. It does not exceed the New Material cap.

## Interleaving

After selection, items are interleaved:

`due → weakness → recent → new → due → weakness ...`

This avoids studying five opening moves in a row followed by five tactical positions in a row.

## Training integration

**Start today’s study** snapshots the generated plan and opens Training mode with source:

`Daily study`

Each exercise shows why it was selected, for example:

- `Daily study · Due repertoire`
- `Daily study · Missed tactics`
- `Daily study · Recent mistake`
- `Daily study · New material`

The underlying Training behavior is unchanged:

- Stockfish evaluates every attempted move;
- repertoire answers still use explicit repertoire/book acceptance rules;
- spaced cards still receive new due dates;
- Training Analytics records the result with source `Daily study`.

## Adaptation

The preview is recomputed from current local data.

Therefore the next plan naturally changes when:

- a due repertoire card is successfully recalled and moves into the future;
- a weakness becomes more/less important;
- a newly reviewed game adds mistakes;
- new repertoire/weakness cards appear.

The session itself is snapshotted on Start so cards do not disappear while the user is working through today's plan.
