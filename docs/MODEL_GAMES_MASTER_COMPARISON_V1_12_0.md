# v1.12.0 — Model Games / Master Comparison

For a training position, the Model Games panel answers a human chess question alongside the engine reference: *what do the strong reference games in this library normally do in a comparable position?*

- **Your games** count comparable personal decisions and show their reviewed average CPL.
- **Strong model games** use only imported/saved games explicitly marked **Model game** in the library. They show the most common continuation and direct links to examples.
- **Stockfish** shows the existing best move for the training exercise.

The comparison is intentionally transparent. It matches phase, side to move, and material, and reports the player's saved model-game collection—not an external or universal opening database.
