# v1.5.0 — Time-Control Awareness

Performance is grouped using the PGN `TimeControl` header: under 3 minutes is bullet, under 10 minutes blitz, under 60 minutes rapid, and longer controls classical. The increment is included conservatively when estimating the practical control.

Each profile reports reviewed-game count, average CPL, blunders per game, and phase CPL. Games with missing or unparseable time-control data remain **unknown** and do not enter any comparison. This prevents a good rapid profile from masking an unrelated blitz blunder problem.
