# v1.7.0 — Cross-Game Pattern Mining + Motif Memory

Motif Memory is a layer above broad weakness labels. It clusters reviewed mistakes into concrete recurring patterns using Stockfish review explanations, move context, phase, and piece configuration. Current motif families include unprotected pieces after pawn advances, back-rank tactics, minor-piece exchanges, premature queen development, isolated-pawn defense, open-file use, and rook-ending transitions.

A motif is shown only after at least two matching reviewed mistakes. It reports total frequency, occurrences in the latest 20 saved games, average centipawn loss, trend versus the preceding 20 games, and example moves. Training opens the exact positions that produced that motif.
