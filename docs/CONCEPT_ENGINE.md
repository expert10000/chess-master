# Chess Concept Engine

`src/lib/chessConcepts.ts` is a deterministic feature extractor used by the local coach.

## Design rule

Stockfish decides whether a move is good. The concept engine only names verifiable board structures that may explain *why*. It does not replace engine search.

## Tactical detectors

- attacked and undefended (hanging) pieces
- lower-value-piece pressure
- forks / double attacks created by the move
- absolute pins
- relative pins / skewers where geometry is sufficiently clear
- overloaded sole defenders
- removal of a sole defender
- newly opened slider attacks (discovered line attacks)
- check, mate and material gain

## Positional detectors

- doubled, isolated and passed pawns
- supported knight outposts not challengeable by enemy pawns
- open / semi-open files occupied by heavy pieces
- bishop pair
- development lead
- central influence
- castled king and attacked king-ring squares

## Confidence

Each concept is marked `high` or `medium`. High-confidence labels come from direct geometry or material facts. Medium-confidence labels represent useful positional/tactical signals that still require Stockfish validation.

## LLM grounding

When Ollama is enabled, detected concepts are inserted into the evidence packet. The model is explicitly forbidden to invent additional motifs or alter Stockfish evaluations and principal variations.
