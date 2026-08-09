# v0.9.7 — Post-Session Report + Tomorrow Recommendation

v0.9.7 closes the daily-study loop introduced in v0.9.6.

## Session lifecycle

When **Start today's study** is pressed, the app stores a session-start snapshot:

- selected daily positions;
- 15/20/30-minute target;
- daily source bucket for every position;
- current spaced-repetition interval, due time, streak, and lapse count for every scheduled card.

Every Daily Study attempt is then attached to this active session.

The Training panel shows:

`Today's session progress: X / N positions attempted`

and offers:

- **Finish & view report** after every planned position has been attempted;
- **End session & report** when the user intentionally stops early.

Ending early is explicitly shown in the report. Unattempted positions are not silently counted as chess failures.

## What improved

The report distinguishes:

- **clean first-try solves** — accepted immediately without hints;
- **recovered positions** — first attempt failed, later attempt was solved;
- **hint-assisted solves**;
- areas that were solved perfectly when at least two positions from that area were trained.

This is session evidence, not a claim that long-term chess strength has already improved.

## What failed

A position is listed as failed only if it was attempted but never accepted during the session.

The failure entry keeps the best available focus label:

- weakness category;
- opening/repertoire name;
- or planner source.

These failed labels feed tomorrow's recommended focus.

## Schedule changes

For every Daily Study exercise linked to a v0.9.4 spaced card, the report compares the card at session start with the final scheduler state:

- interval before → after;
- streak before → after;
- new due timestamp;
- classification:
  - **expanded**
  - **shortened**
  - **relearning**
  - unchanged where relevant

This allows a user to see the concrete memory consequence of today's result.

## Tomorrow recommendation

The report automatically recommends **15, 20, or 30 minutes** for tomorrow.

### 30 minutes

Recommended when review pressure or failure load is high, for example:

- 12+ cards due by tomorrow night;
- 4+ unsolved positions today;
- or <70% solved after a meaningful session.

### 15 minutes

Recommended as a lighter consolidation day when:

- today's session was strong;
- no positions remained unsolved;
- and at most five cards are due by tomorrow night.

### 20 minutes

The normal default for intermediate load.

The recommendation also includes:

- approximate target positions;
- cards due by tomorrow night;
- today's failed positions that should carry over;
- top failed weakness/opening labels;
- recommended new-material budget.

If failures or review pressure are high, new material can be recommended as **zero** so consolidation wins over novelty.

## Persistence

Completed reports are stored locally under:

`stockfish-coach.daily-session-reports.v1`

The latest 60 reports are retained.

The most recent report appears:

- below the Training panel after finishing Daily Study;
- in compact form beside the Play & Coach daily planner after returning from Training;
- as a concise “Tomorrow” recommendation directly in Today's Study.

## Important interpretation

“Improved” means improved **within this training session** (clean solve, recovery, stronger result), not statistically proven long-term playing improvement.

Tomorrow's recommendation uses today's result plus the scheduler's current due dates. Later practice can change those due dates, so it is a recommendation rather than a fixed calendar promise.
