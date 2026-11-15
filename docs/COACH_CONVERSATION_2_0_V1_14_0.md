# v1.14.0 — Coach Conversation 2.0

The conversation coach now recognizes whole-profile questions before asking Stockfish to analyse the current board.

- “Why has my Black score improved?” compares earlier and later saved Black-game blocks, including CPL and blunders per game.
- “What should I work on before my tournament?” uses the active season cycle, unappeared tournament goals, recurring patterns, and measured intervention history.
- General training-priority questions use motif frequency, average loss, trend, and the best observed intervention method.

Answers keep their evidence and uncertainty visible. Position-specific questions still use the current board and Stockfish; whole-profile questions can answer without an engine connection.
