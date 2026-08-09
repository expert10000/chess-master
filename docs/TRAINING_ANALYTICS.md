# v0.9.5 — Training Analytics + Calendar/Heatmap + Retention Forecast

v0.9.5 adds a persistent analytics layer over Training and the v0.9.4 spaced-repetition scheduler.

## Detailed practice log

Every evaluated Training attempt now records:

- timestamp;
- exercise source;
- accepted / not accepted;
- points;
- hint level;
- Stockfish verdict;
- attempted SAN move;
- weakness label, when present;
- opening/repertoire label, when present;
- spaced-repetition source and card id, when present.

The log is capped at 6,000 recent attempts.

Detailed daily history begins with v0.9.5. Older v0.9.4 cards still contribute to retention and future review load, but the app does not invent historical daily attempts that were never logged.

Storage key:

`stockfish-coach.training-analytics.v1`

## Practice heatmap

The dashboard shows the last 56 local-calendar days as an eight-week heatmap.

Cell intensity is based on attempts relative to the busiest day in the displayed window. High-accuracy active days receive an additional outline.

The top summary reports:

- attempts in the last 7 days;
- 7-day accuracy and active-day count;
- attempts in the last 30 days;
- 30-day accuracy / average points.

## Accuracy by weakness

Training attempts carrying a weakness label are grouped into rows such as:

- Missed tactics;
- Hanging pieces;
- King safety;
- Pawn structure;
- Poor development;
- Opening deviations.

Each row shows correct/attempts and percentage accuracy.

## Accuracy by opening

Opening and repertoire exercises that carry `openingName` are aggregated independently, allowing lines such as:

- Sicilian Defense · Najdorf;
- French Defense · Advance;
- Ruy Lopez · Morphy Defense.

The data is generated from actual Training attempts, not merely from game review classification.

## Review-load forecast

The next 30 local-calendar days are built from the scheduler's **current due timestamps**.

The dashboard reports:

- reviews currently scheduled in the next 7 days;
- reviews currently scheduled in the next 30 days;
- a 14-day bar view split internally by repertoire vs weakness card counts.

This is a snapshot, not a promise of future workload. Solving a card will move its due date and therefore change the forecast.

Overdue cards are counted on today.

## Retention/stability estimate

The dashboard classifies scheduler cards as:

- **New** — not yet recalled;
- **Fragile** — early learning, recent failure, low modeled retention, or excessive lapses;
- **Growing** — at least two successful recalls with a multi-day interval;
- **Stable** — at least a 14-day interval, a streak of at least 3, and adequate scheduler-derived retention.

The displayed percentage is a transparent teaching estimate derived from:

- current interval;
- time since last review;
- streak;
- ease;
- last result.

It is **not** a measured human-memory probability and is explicitly labeled as such.

The “Knowledge becoming stable” list highlights the strongest stable/growing repertoire and weakness cards.

## Why keep analytics separate from Stockfish

Stockfish remains authoritative for the chess position.

Analytics answers different questions:

- What did I practice?
- What do I keep getting wrong?
- What opening do I recall poorly?
- How much review work is currently scheduled?
- Which knowledge is becoming durable?

No analytics score changes Stockfish evaluation or move grading.
