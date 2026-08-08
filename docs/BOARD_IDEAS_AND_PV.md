# Board ideas and principal-variation playback

Stockfish Coach v0.8.3 makes engine evidence visible on the chessboard instead of leaving it only in text.

## Board arrows

The board overlay is read-only and never changes the game. The colors mean:

- green: Stockfish best move;
- orange: the played move when it was an inaccuracy, mistake, or blunder;
- blue dashed: secondary MultiPV candidates;
- red dashed: tactical line motifs such as pins, skewers, discovered attacks, and fork rays.

The **Board ideas** control can hide/show the overlay at any time.

## Highlighted concepts

Detected concepts are mapped to the squares mentioned by the deterministic concept engine. Tactical, positional, pawn-structure, king-safety, and material concepts use distinct ring styles. The overlay is explanatory only; Stockfish remains the source of move evaluation.

## Principal-variation player

Every engine line that has UCI moves can be previewed with **Play line**. The preview:

1. creates a separate chess.js board from the line's starting FEN;
2. animates each UCI move without modifying the live game or history;
3. highlights the last previewed move;
4. shows progress such as `Best line · 4/8`;
5. remains on the final preview position until **Return to position** is pressed.

Available line sources include:

- reviewed move: Stockfish best line;
- reviewed move: continuation after the played move;
- compared alternative: alternative best line;
- position analysis: any MultiPV candidate.

The preview is intentionally capped to a short principal variation so it stays useful as a teaching animation rather than becoming an automated game viewer.
