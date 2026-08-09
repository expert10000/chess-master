# v0.9.2 — Positional Before / After Comparison

v0.9.2 adds an explanatory layer between raw Stockfish evaluation and named tactical/positional concepts.

For every reviewed move, the coach can compare the mover's position immediately before the move with the position immediately after it.

## Six teaching dimensions

Each dimension is shown on a transparent 0–10 heuristic scale:

1. **Development**
   - minor pieces off original squares;
   - limited credit for queen/rook activation.

2. **King safety**
   - castled king;
   - local pawn shield;
   - direct enemy attack rays around the king;
   - penalties for an exposed/central king.

3. **Central control**
   - direct attacks on d4/e4/d5/e5;
   - occupation of those four core center squares;
   - relative control compared with the opponent.

4. **Pawn structure**
   - doubled pawns;
   - isolated pawns;
   - simple geometric passed-pawn bonus.

5. **Piece activity**
   - weighted geometric mobility for knights, bishops, rooks, and queen.

6. **Tactical pressure**
   - enemy pieces currently attacked;
   - locally over-attacked targets;
   - direct attacks on the enemy king.

## Played move vs best move

The panel has:

- **Your move**
- **Best move**

so the user can see whether Stockfish's recommendation improves different structural features, not only the numerical evaluation.

Example:

```text
Your move: Nf3

Development       0.0 → 2.0   +2.0
King safety       6.2 → 6.2    0.0
Central control   5.0 → 5.7   +0.7
Pawn structure    8.1 → 8.1    0.0
Piece activity    3.9 → 4.5   +0.6
Tactical pressure 2.0 → 2.0    0.0
```

Each row can expand **Why?** to show the concrete ingredients used before and after.

## Important interpretation rule

These scores are **not engine evaluations** and are not presented as chess truth.

They are deterministic teaching heuristics designed to answer questions such as:

- “What did this move improve?”
- “Why does castling help?”
- “Did I damage my pawn structure?”
- “Did this move increase activity?”
- “Why is Stockfish's move positionally easier to understand?”

Stockfish score and PV remain authoritative for tactical correctness.

## Conversational coach bridge

**Ask coach about these positional changes** sends a focused question into the existing Stockfish-grounded conversational coach. This lets deterministic structural measurements become supporting evidence rather than a replacement for engine analysis.
