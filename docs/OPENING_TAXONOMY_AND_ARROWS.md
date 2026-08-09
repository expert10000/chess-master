# v0.9.2.1 — Opening Taxonomy + Explicit Arrow Semantics

This refinement makes two previously ambiguous parts of the UI explicit.

## Opening taxonomy

The Opening Explorer now shows four classification fields:

- **Type** — Open game, Semi-open game, Closed game, Indian defense, or Flank opening;
- **Family** — e.g. King's Pawn Opening or Queen's Pawn Game;
- **Branch** — the recognized opening/defense name;
- **Variation** — the recognized variation, or `—` when the current book prefix has no more specific variation.

Examples:

```text
C00 · French Defense
Type       Semi-open game
Family     King's Pawn Opening
Branch     French Defense
Variation  —
```

```text
B90 · Sicilian Defense · Najdorf
Type       Semi-open game
Family     King's Pawn Opening
Branch     Sicilian Defense
Variation  Najdorf
```

```text
D30 · Queen's Gambit Declined
Type       Closed game
Family     Queen's Pawn Game
Branch     Queen's Gambit Declined
```

The taxonomy is deterministic and educational. It is not intended to replace a full ECO reference database.

## Board-arrow semantics

The Board Inspector legend now separates sources:

### Engine

- **solid green** — Stockfish best move;
- orange — played issue;
- red — tactical idea.

### Opening

- **blue dashed** — highest-weight continuation in the bundled local opening book;
- **gold dashed** — user's saved repertoire move.

Opening arrows appear only when the displayed board is itself at a recognized local-book node. They are not projected onto a post-deviation position, which would be misleading.

If the top book move and repertoire move are the same, both arrows remain visible using small opposite perpendicular offsets. This makes it possible to see that the same move is supported by two different sources.

## Important distinction

A blue or gold arrow is **not an engine recommendation**.

- green = calculation;
- blue = bundled opening knowledge;
- gold = personal repertoire memory.

Clicking any of these arrows in Inspect Board mode explains that exact source.
