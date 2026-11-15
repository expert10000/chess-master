# v1.11.0 — Game Prediction / Pre-Move Risk Coach

The Pre-Move Risk Coach does not predict moves or evaluate an opponent. During a training exercise only, it compares the current position with the player's own reviewed history.

- Structural similarity uses game phase, side to move, material, and kingside-pawn state.
- It requires at least three comparable reviewed positions and one prior issue.
- It shows the comparable count, historical error rate, dominant recurring risk, and links to exact historical examples.
- The panel is disabled outside training, including live play, to preserve fair rated games.

This is a personal-history warning rather than a chess-engine truth claim. It is intentionally conservative and should be read as a prompt to slow down and check the position.
