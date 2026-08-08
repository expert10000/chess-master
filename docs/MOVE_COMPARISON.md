# v0.8.8 — Compare Two Moves Visually

The move-review panel now presents the played move and Stockfish's best move as a direct two-column comparison.

## What is compared

Each side shows:

- SAN move
- Stockfish evaluation
- principal variation
- concepts unique to that move where the deterministic concept engine finds them
- an independent **Study this line** button

The center summary shows exact centipawn loss and its pawn-equivalent value. A small visual bar is only a 0-to-3+ pawn scale; it does not replace the exact Stockfish score.

## Board focus

The comparison header can switch the main board among:

- **Both arrows**
- **Your move**
- **Best move**

When one move is isolated, unrelated concept highlights are hidden so the geometry stays clear. Returning to **Both arrows** restores the normal review overlay.

## PV study

Both move cards launch the existing v0.8.7 principal-variation player, so the user can independently pause, step, jump, restart, or change speed for either continuation.

The PV remains read-only and does not mutate the live game, imported PGN, history, variations, reviews, or training data.

## Concept caveat

Named concepts are heuristic labels. A move can be stronger for concrete calculation even when there is no unique named positional or tactical concept. Stockfish's evaluation and PV remain authoritative.
