# v1.15.3 — Polished Move Motion

Engine moves now use one short, GPU-friendly animation:

1. a quick lift from the origin;
2. a smooth eased glide;
3. a soft landing on the destination square.

The animation keeps the existing overlay implementation, so the piece never jumps between its source and destination. Very fast remains intentionally brief at 95 ms; Fast is 170 ms and Coach is 250 ms. These are visual transition budgets only and do not change Stockfish search time or the live-play render isolation introduced in v1.15.2.
