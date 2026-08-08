# v0.8.5 — Any-square inspection

## Goal

Make the chessboard itself a query surface. A learner should not need Stockfish to pre-highlight an object before asking about it.

## Interaction

1. Click **Inspect board**.
2. Normal move input is temporarily locked.
3. Click any piece or empty square.
4. The Coach panel shows deterministic board facts: occupant, White attackers, Black attackers, defenders, side to move, legal moves for the selected side-to-move piece, and matching detected concepts.
5. Use the contextual question buttons for deeper Stockfish-grounded analysis.
6. Click a precomputed highlight ring or arrow to inspect that specific v0.8.4 idea instead.
7. Click **Exit inspect** to restore normal play.

## Grounding

The immediate square card is computed directly from the FEN and board geometry. It does not ask an LLM to infer attacks or defenders. Questions such as “where should this bishop go?” are intentionally delegated to the existing Stockfish-backed conversational coach. Ollama remains optional wording only.

## Example questions

- Why is the knight on f3 good or bad here?
- Who attacks and defends d5?
- Is the pawn on e4 weak?
- Where should the bishop on c1 go?
- Can I safely occupy e5?
