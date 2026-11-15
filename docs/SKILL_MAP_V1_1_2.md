# v1.1.2 — Skill Map / Chess Curriculum Graph

The Skill Map is the first persistent learner model in Stockfish Coach. It makes eight durable curriculum skills visible rather than reducing learning to an undifferentiated count of mistakes.

| Skill | Main current evidence | Recommended route |
|---|---|---|
| Opening development | Development and opening-deviation observations; opening phase | Repertoire memory |
| King safety | King-safety observations | Weakness training |
| Tactical vision | Missed-tactics observations | Weakness training |
| Calculation | Tactics plus loose-piece observations | Today’s plan |
| Pawn structure | Structural observations | Weakness training |
| Piece activity | Reviewed middlegame performance | Game analytics |
| Endgames | Reviewed endgame performance | Game analytics |
| Conversion | Reviewed endgame performance | Game analytics |

Confidence is low below four relevant observations, emerging from four to eleven, and grounded at twelve or more. Phase trends use the existing reviewed-game comparison and remain **collecting** where a comparison does not yet exist. This makes the model honest about limited evidence and creates the foundation for later curriculum sequencing.
