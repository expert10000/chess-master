# Training Mode

`v0.7.0` adds Training as a separate application mode. It intentionally does not replace or mutate Play & Coach.

## Exercise sources

- **My mistakes** — reviewed student plies classified as Inaccuracy, Mistake, or Blunder.
- **All reviewed moves** — every reviewed student ply with a known Stockfish best move.

An exercise stores the position *before* the original move, the original SAN/verdict/loss, and the cached Stockfish best move. The answer is hidden in the UI until needed.

## Attempt evaluation

When the student plays a legal move, Stockfish runs two searches from the exercise FEN:

1. unrestricted MultiPV best-play analysis;
2. `searchmoves` restricted to the student's candidate.

The normal `createMoveReview` pipeline then grades the attempt. Best and Excellent count as solved.

## Scoring

Base scores are 100 / 88 / 65 / 35 / 15 / 0 for Best through Blunder. Progressive hints apply a multiplier, with a floor so revealed-answer attempts can still receive partial credit. The session keeps only the best score earned for each exercise, preventing score inflation from repeated retries.

## Hints

1. named tactical/positional idea when a deterministic concept is available;
2. the piece and origin square;
3. the destination square;
4. exact SAN/UCI answer.

## Isolation

Training uses a separate `Chess` instance (`trainingGameRef`). Switching into Training cancels stale engine work and switching back restores the unchanged live `gameRef`. No training move is appended to PGN, move history, or a saved variation.
