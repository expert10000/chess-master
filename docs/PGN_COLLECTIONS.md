# PGN collections

`chess.js` parses one PGN game at a time. Player/tournament downloads commonly concatenate many games into one `.pgn` file.

Stockfish Coach v0.8.1 detects game boundaries after movetext result tokens (`1-0`, `0-1`, `1/2-1/2`, `*`) followed by the next tag block. The import dialog exposes a game selector and passes only the selected game to the normal parser/review pipeline.

This preserves the existing single-game import behavior and supports typical Chess.com, Lichess, PGN Mentor, player, and tournament collections.
