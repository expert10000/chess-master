# v0.8.7 — Full Principal-Variation Study Controls

Stockfish lines are now a controllable study sequence rather than a fire-and-forget animation.

## Transport controls

While a principal variation is open:

- `|◀` — jump to the starting position
- `◀` — step back one ply
- `▶ / ⏸` — play or pause
- `▶` — step forward one ply
- `▶|` — jump to the final PV position
- **Restart** — return to move 0 and pause
- **0.5× / 1× / 2×** — change automatic playback speed
- **Return** — close the PV and restore the exact original game/history position

## Keyboard

- `Space` — play / pause
- `Left Arrow` — previous ply
- `Right Arrow` — next ply
- `Home` — start
- `End` — end
- `Escape` — close PV preview

Keyboard PV controls take priority over normal history navigation while a PV is open.

## State safety

The PV remains a read-only sandbox. Manual stepping, jumping, pausing, restarting, and changing speed rebuild only the temporary PV board. They never mutate:

- live game state
- imported PGN
- move history
- variation tree
- stored reviews or training data

The board can therefore be used like a small variation explorer without risking the game being studied.
