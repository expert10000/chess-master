# v1.15.4 — Fast Play Strength Integrity

## Why the old behavior was misleading

The selected opponent used its configured UCI Elo limit, but Very fast and Fast replaced its normal calculation time with 50 ms or 100 ms. That is too little search for a reliable Expert-level move in many tactical positions. Additionally, a temporary engine failure could fall back to a legal capture/check preference, which is not a chess-strength substitute.

## New rapid calculation floors

| Opponent | Very fast | Fast |
| --- | ---: | ---: |
| Beginner | 100 ms | 140 ms |
| Club | 180 ms | 260 ms |
| Expert | 350 ms | 500 ms |
| Master | 550 ms | 750 ms |
| Maximum | 700 ms | 900 ms |

These times protect the selected playing strength. They still use the low-overhead live-play engine configuration and no automatic review. If a higher-level engine response fails, the app reports the engine error instead of pretending a heuristic legal move was a genuine Expert/Master move.
