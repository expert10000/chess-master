# Interactive board explanations — v0.8.4

## Goal

Turn the v0.8.3 board overlays into teaching objects rather than passive decoration.

## Workflow

1. Analyze a position or select a reviewed move.
2. Keep **Board ideas** visible.
3. Choose **Inspect ideas**.
4. Click a highlighted square or one of the arrows.
5. The coach displays a dedicated **Board explanation** card.
6. Optionally choose **Ask conversational coach about this** for a deeper Stockfish-grounded answer.
7. Choose **Exit inspect** to resume normal board interaction.

## Safety of interaction

Inspection mode locks move input. It therefore cannot accidentally alter the game, variation, history cursor, PGN, or training state. Principal-variation playback exits inspection automatically.

## Explainable items

- Stockfish best-move arrows.
- Played-move issue arrows.
- MultiPV candidate arrows.
- Tactical arrows created from fork, pin, skewer, discovered-attack, and line motifs.
- Tactical, positional, pawn-structure, king-safety, and material square highlights.

## Grounding

The first explanation comes from deterministic metadata already attached to the board idea. A deeper follow-up uses the existing conversational-coach pipeline, which is grounded by Stockfish analysis and deterministic board concepts. Ollama is optional and is not allowed to replace engine evidence.
