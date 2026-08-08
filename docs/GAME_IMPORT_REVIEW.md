# PGN/FEN Import and Full Game Review — v0.8.0

## PGN

Use **Import PGN / FEN** in Play & Coach. Paste PGN text or load a local `.pgn` file exported by Chess.com, Lichess, or another standard PGN source. Select whether the student is White or Black.

When **Analyze the full game immediately** is enabled, Stockfish reviews every ply and stores the existing `MoveReview` result on each move. The summary card filters those reviews to the selected student color.

Imported moves participate in the same features as played games: history browsing, mistake navigation, Create variation, Play from here, conversational coaching, concept detection, Ollama wording, and Training mode.

## FEN

Paste a legal FEN to create a standalone position. The side to move becomes the student side. The FEN is retained as the base position, so later history navigation, Undo, and variations replay from the correct custom starting position rather than the normal chess initial position.

## Review summary

The full-game review card reports verdict counts, reviewed/student move progress, average centipawn loss, and total issues (Inaccuracy + Mistake + Blunder). **First issue** jumps to the earliest detected problem.

## Notes

- Stockfish remains local and authoritative.
- Long games can take time to review because each move is evaluated twice (best play and the played move).
- The app does not claim Chess.com-style proprietary accuracy percentages; it reports transparent Stockfish-based centipawn loss and verdicts instead.
