# v1.0.3 — Game-Level Analytics + Phase Statistics

v1.0.3 adds a new persistent-library analytics panel based on saved reviewed games.

## Windows

The panel summarizes the last:

- 10 reviewed games
- 20 reviewed games
- 50 reviewed games

The current window is compared against the previous window of the same size whenever enough reviewed history exists.

## Metrics

Overall metrics:

- reviewed games
- reviewed human moves
- average CPL
- blunders per game
- issues per game (Inaccuracy/Mistake/Blunder)

## White / Black split

Performance is separated by the student's side:

- games
- reviewed moves
- average CPL
- blunders per game

## Phase statistics

Each reviewed move is heuristically assigned to one of:

- Opening
- Middlegame
- Endgame

### Current phase heuristic

- `ply <= 20` → Opening
- otherwise, inspect material from the pre-move FEN:
  - low non-pawn material,
  - few remaining pieces,
  - or queen-light low-material positions
  → Endgame
- everything else → Middlegame

This is an educational heuristic, not a strict engine/game-database phase classifier.

For each phase the panel shows:

- reviewed moves
- average CPL
- blunders per game
- strength label
- trend vs previous same-size window

### Strength labels

- Strong
- Good
- Developing
- Needs work
- No data

### Trend labels

- Improving
- Declining
- Stable
- No prior window

## Opening performance

The panel aggregates the most frequent openings in the selected window and shows:

- ECO
- name / variation
- games
- reviewed moves
- average CPL
- blunders per game

## Board themes

v1.0.3 also adds three checkerboard themes:

- Current
- Brown
- Green

The selected board theme is stored locally under:

`stockfish-coach.ui-board-theme.v1`

and is included in JSON backup/restore.

Text size controls remain:

- Small
- Regular
- Large

with the larger v1.0.2 sizing retained.
