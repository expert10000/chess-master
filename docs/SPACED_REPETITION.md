# v0.9.4 — Spaced Repetition

v0.9.4 adds a persistent scheduler above the repertoire and personal-weakness systems.

## What becomes a card

Two sources automatically create spaced-repetition cards:

1. **Saved repertoire positions**
   - one card per exact saved repertoire position;
   - target is the user's saved repertoire move;
   - changing the saved move resets that card because the knowledge being memorized changed;
   - forgetting the repertoire choice removes its card.

2. **Weakness examples**
   - stored examples produced by the v0.9.3 weakness profile;
   - card keeps the pre-mistake FEN, original move, Stockfish best move, weakness category, and opening candidates where applicable.

Weakness cards remain self-contained in the scheduler even when they are no longer among the most recent examples in the profile.

## Scheduling rule

The scheduler is intentionally simple and inspectable.

### Correct without hints

- first successful recall: **1 day**
- second successful recall: **3 days**
- later recalls: previous interval × adaptive ease

### Correct with hints

Hints still count as successful recall, but the interval is shorter.

A heavily hinted first success returns after roughly **12 hours** instead of one day.

### Incorrect

An incorrect answer:

- resets the current streak;
- increments lapses;
- slightly lowers ease;
- schedules the card again in **10 minutes**.

This keeps a missed position available for same-session relearning.

## Ease

Each card starts with ease `2.35`.

Clean successful recalls can slowly increase ease. Hint-heavy successes and failures lower it. Ease is bounded so intervals never collapse or explode uncontrollably.

## Due Review

The new panel shows:

- Due now
- Learning
- Mature
- Accuracy
- repertoire/weakness deck size
- next scheduled review
- up to five currently due cards

**Train due now** snapshots up to 20 due cards into Training mode.

The Training source selector also includes:

`Due review`

The session is snapshotted when opened. Scheduling a card into the future does not make the current result disappear from the UI.

## Stockfish remains authoritative

Spaced repetition decides **when** a position returns, not whether the move is objectively correct.

Every attempted move is still analyzed by Stockfish through the existing Training pipeline.

Opening/repertoire cards continue to accept their explicitly stored repertoire move, while also showing Stockfish's independent verdict.

## Persistence

Scheduler state is stored locally under:

`stockfish-coach.spaced-repetition.v1`

It persists across games, PGN imports, FEN imports, and application restarts.
