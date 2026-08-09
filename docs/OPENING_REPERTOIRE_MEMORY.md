# v0.9.1 — Opening Mistake Coach + Repertoire Memory

v0.9.1 turns the v0.9.0 local opening explorer into a persistent personal opening coach.

## Save a repertoire move

Every local-book alternative now has:

- **☆ Save** — make that move your preferred move for the exact opening position;
- **★ My move** — indicates the current saved choice and lets you remove it.

The key includes board placement, side to move, castling rights, and en-passant state, while ignoring halfmove/fullmove counters.

A repertoire move can also be a personal move outside the bundled local book. When the game first leaves the book, **Keep <move> as repertoire** stores the played move explicitly.

## Repertoire miss vs chess mistake

These are deliberately different concepts.

The Opening Coach can report:

- **Repertoire miss** — you did not play your saved move, but Stockfish may still consider the deviation perfectly playable;
- **Opening mistake** — the first book deviation is also an engine Inaccuracy/Mistake/Blunder;
- **Repertoire miss + engine mistake** — both happened;
- **Book deviation, not an engine mistake** — the game left the bundled book, but Stockfish approves the move;
- **Repertoire move played** — your saved personal choice was remembered.

This prevents “out of book” from being incorrectly treated as “bad move.”

## Persistent deviation memory

The first local-book departure of a live game is recorded automatically. Repeated occurrences accumulate in local storage.

The panel shows:

- total saved repertoire positions;
- White and Black repertoire counts;
- total observed deviations;
- number of deviation positions seen more than once;
- up to three repeated deviations with one-click Training.

The same deviation is counted once per active game/line session, not every time the React UI rerenders.

## Recall training

A saved repertoire choice has **Train**. This creates a one-position recall exercise:

- only the saved repertoire move is the target repertoire answer;
- Stockfish still evaluates the attempted move;
- practice attempts and successes are written back to repertoire memory.

Repeated historical deviations can also be trained directly from the memory panel using the book alternatives captured when the deviation was first seen.

## Persistence and privacy

Repertoire memory is stored under:

`stockfish-coach.opening-repertoire.v1`

in the Electron renderer's local browser storage. It is not uploaded anywhere.

Starting a new game or importing another PGN resets the temporary opening-training selection, but does **not** delete the persistent repertoire memory.
