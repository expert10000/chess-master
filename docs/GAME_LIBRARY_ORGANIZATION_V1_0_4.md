# v1.0.4 — Saved Game Search / Filters / Tags / Notes / Pinned Games

v1.0.4 turns the persistent game library into an organized long-term study collection.

## User metadata

Each saved game can now carry:

- free-form tags, for example `French`, `tactics`, `endgame`, `study again`;
- a free-form note;
- ★ pinned/favorite status;
- model-game status;
- archive status.

The metadata is stored inside `stockfish-coach.game-library.v1` and therefore travels automatically with the normal v1 JSON backup.

Automatic game autosaves preserve user metadata. A later Stockfish review or additional move cannot erase tags, notes, pin/model status, or archive status.

## Pinned vs model game

These are deliberately separate concepts.

**Pinned** means: important to me / keep easy to find.

**Model game** means: a reference game I want to study or imitate.

Model games are excluded from personal game-performance analytics because a Tal–Botvinnik or other imported reference game should not change the student's CPL, blunders/game, White/Black, or phase statistics.

Archived games are excluded from normal library views and personal analytics as well.

## Advanced filters

The library can filter by:

- your side: White / Black;
- result: Win / Draw / Loss / Unfinished;
- source: Played / Imported;
- review state: Reviewed / Partial / Unreviewed;
- exact opening;
- weakness label;
- minimum CPL;
- maximum CPL;
- date from;
- date to.

Primary quick filters:

- All
- ★ Pinned
- Model
- Issues
- Reviewed
- Archived

Search includes:

- White / Black player names;
- result;
- event/date;
- ECO/opening/variation/family;
- weakness labels;
- user tags;
- user notes;
- model/pinned keywords.

## Sorting

- Newest
- Worst CPL
- Most issues
- Opening A–Z

## Archive and delete

**Archive** is reversible. Archived games remain in local storage and backup but leave normal active views and analytics.

**Delete** permanently removes the saved library entry. The currently active autosaved game cannot be deleted because further moves would immediately recreate it; open another game first or archive the active game.

## Metadata limits

To keep local storage predictable:

- up to 16 normalized tags per game;
- each tag is capped at 32 characters;
- notes are capped at 5,000 characters.

Duplicate tags are removed case-insensitively.
