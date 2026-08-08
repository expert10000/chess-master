# v0.8.6 — Visual Attack / Defense Overlay

The board inspector can now show control geometry rather than only describe it.

## Workflow

1. Enter **Inspect board**.
2. Click any occupied or empty square.
3. The Coach panel shows **Visual control** buttons.
4. Switch among:
   - **All control**
   - **Attackers** / **Defenders** for an occupied square
   - **White control** / **Black control** for an empty square
   - **Legal moves** when the selected piece belongs to the side to move

## Board notation

- cyan arrows: White direct control
- violet arrows: Black direct control
- green dashed arrows: legal destinations of the selected piece

The selected square remains boxed. Existing Stockfish best-move, played-move, MultiPV, and tactical-idea arrows can remain visible at the same time.

## Important semantics

The overlay shows direct geometric control, not a complete static-exchange evaluation. A pinned piece can still geometrically attack a square even when moving it would be illegal. The conversational coach and Stockfish remain the deeper authority for whether a capture or occupation is actually safe.

For an occupied square, a same-color controller is described as a **defender**, while an opposite-color controller is an **attacker**. For an empty square the UI instead labels the sides as White control and Black control.

The overlay is read-only and never changes the live game, PGN, history, or variation tree.
