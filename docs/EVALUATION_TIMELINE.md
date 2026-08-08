# Evaluation timeline — v0.8.2

The timeline visualizes Stockfish evaluation throughout a reviewed game.

- Above zero means an advantage for White; below zero means an advantage for Black.
- Every reviewed ply is clickable and jumps the history board to that exact position.
- The currently viewed ply receives an active ring.
- The player's Inaccuracies, Mistakes, and Blunders are marked directly on the graph with `?!`, `?`, and `??`.
- Mate evaluations are pinned to the top/bottom of the graph while their original `M#` display value remains available in the point tooltip.
- The graph is compatible with live games, imported PGNs, multi-game PGN selections, branches, and historical navigation.
- If only part of a game has been reviewed, the panel offers **Complete review**.

Stockfish scores are stored normalized to White's point of view, so the graph does not flip vertically after every move.
