# v1.0.8 — Fast Play Pace

Before v1.0.8 there was no separate Fast mode.

Normal play felt slow because one human turn could include:

1. Stockfish opponent thinking time;
2. 220 ms move animation;
3. automatic review of the human move;
4. two additional 700 ms Stockfish review searches (best MultiPV + forced played move).

The review work was usually the largest source of delay.

## Pace control

The Play toolbar now offers:

- **Fast — play first**
- **Coach — auto review**

### Fast

Fast mode:

- uses about 35% of the configured opponent think time, with a 90 ms minimum;
- shortens the engine move animation to about 105 ms;
- does **not** automatically review the just-played human move;
- returns control to the player immediately after the engine move;
- leaves the move available for **Review all moves** later.

The opponent's configured Elo/strength setting is still sent to Stockfish, but shorter search time can make high-strength play less stable than Coach mode.

### Coach

Coach mode preserves the existing workflow:

- normal opponent think time;
- normal animation;
- automatic Stockfish review after every human move.

## Current nominal opponent think times

Coach pace:

- Beginner: 220 ms
- Club: 400 ms
- Expert: 700 ms
- Master: 950 ms
- Maximum: 1300 ms

Fast pace uses roughly 35% of those values:

- Beginner: about 90 ms (minimum)
- Club: about 140 ms
- Expert: about 245 ms
- Master: about 333 ms
- Maximum: about 455 ms

The larger improvement comes from deferring the two 700 ms automatic review searches.

## Storage

`stockfish-coach.play-pace.v1`

The preference is included in JSON Backup / Restore.
