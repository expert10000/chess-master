# v1.3.0 — Endgame Curriculum + Syzygy

The endgame curriculum has four modules: king+pawn, rook, queen, and minor-piece endings. Its evidence counts come from the learner’s reviewed endgame moves. Exercises are generated only from that learner’s actual endgame inaccuracies, mistakes, and blunders, so conversion problems are surfaced as specific positions.

For a legal 3–7 piece current position, the Syzygy lookup returns exact WDL and DTZ information from the Lichess tablebase service. A move is labelled **only optimal** only when exactly one move has the best tablebase outcome and DTZ; otherwise the UI reports that no unique optimum was found. This avoids conflating engine preference with tablebase proof.

The lookup is on-demand and will show a clear error if the service is unavailable. Positions outside the 3–7-piece range are not sent to the tablebase.
