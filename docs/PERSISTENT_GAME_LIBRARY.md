# v1.0.2 — Persistent Local Game Library

v1.0.2 turns played, imported and reviewed games into durable local coach objects.

## Automatic persistence

A game is added once it contains at least one move.

The same live game is updated in place as:

- additional moves are played;
- moves are undone/branched in the current line;
- Stockfish reviews are added;
- review verdicts and CPL become available.

Re-importing the same completed move sequence is deduplicated using a deterministic fingerprint of:

`starting FEN + complete UCI move sequence`

A progressive live game uses a stable session id so every new move updates the existing object instead of creating one object per position.

## Stored fields

Each game stores:

- compact PGN;
- starting FEN;
- UCI move sequence;
- White / Black;
- result;
- event/date when available;
- whether the source was Played or Imported;
- which color belongs to the student/review side;
- ECO/opening/variation/family;
- review status: Unreviewed / Partial / Reviewed;
- reviewed human moves / total human moves;
- average human-move centipawn loss;
- issue count (Inaccuracy/Mistake/Blunder);
- per-game weakness labels and counts;
- compact move-review snapshots needed to reopen/train the reviewed game.

Review snapshots keep the important review fields and short PV data while avoiding unnecessary storage duplication.

## Search

The Game Library search matches:

- White;
- Black;
- result;
- event/date;
- ECO;
- opening / variation / family;
- per-game weakness labels.

Filters:

- All
- Reviewed
- Issues
- Played
- Imported

## Direct actions

### Open

Reconstructs the exact stored game locally and restores saved review verdicts/CPL/best moves.

### Review / Review missing

Opens the game.

If human moves are missing reviews, Stockfish reviews those missing moves.

If the game is already fully reviewed, the existing saved review opens immediately without re-running expensive full-game analysis.

### Train mistakes

Reconstructs the reviewed game and opens Training source **My mistakes**.

Only reviewed human Inaccuracy/Mistake/Blunder positions become exercises.

## Storage and backup

Library key:

`stockfish-coach.game-library.v1`

The library is included in v1.0 JSON Backup & Restore.

The implementation stores a compact representation rather than duplicating full live React/engine state. If browser/Electron local-storage quota is reached, the Game Library panel reports the persistence error instead of silently pretending the game was safely stored.

## Font refinement

Small / Regular / Large remain relative 90% / 100% / 112% modes, but all normal UI text receives an additional **1.6 px ≈ 1.2 pt** in v1.0.2.

Chess-piece geometry and piece glyph sizing are unchanged.
