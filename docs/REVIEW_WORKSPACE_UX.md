# v0.9.5.1 — Review Workspace UX

This refinement addresses a usability problem visible after long full-game reviews.

## Problem

At widths around 1100–1300 px the previous responsive breakpoint collapsed the application into one large vertical column:

1. board at the top;
2. many opening/training dashboards;
3. full-game summary/timeline;
4. move history;
5. selected move explanation.

That meant a user clicking a move in history updated the historical board correctly, but the board was far above the current viewport.

It also made **Review all moves** feel as if it had no obvious result because the Full Game Review dashboard could be several panels away.

## v0.9.5.1 changes

### Review-first ordering

The side column is now ordered:

1. Position tools
2. Full Game Review
3. Evaluation Timeline
4. Move History
5. Selected move / Coach
6. Opening Explorer
7. Repertoire
8. Weakness Profile
9. Spaced Repetition
10. Training Analytics

Game-review information is therefore adjacent to the controls that generate it.

### Auto-reveal after Review all

When a batch review finishes, the app smoothly reveals the **Full Game Review** dashboard.

### Selected move on the dashboard

Selecting a historical move now updates a compact Selected Move area in the Full Game Review dashboard with:

- move number/SAN;
- verdict;
- centipawn loss;
- Stockfish best move;
- played evaluation;
- link to the full explanation.

The Move History panel also shows a compact selected-move strip so the user does not have to guess which review is active.

### Board stays visible on normal desktop windows

The two-column layout now remains active down to 1000 px instead of collapsing at 1320 px. The board column uses a viewport-aware maximum size and becomes sticky on sufficiently tall desktop windows.

This means that at common ~1100 px application widths, clicking a move in history updates a board that is still visible beside the review panel.

Below 1000 px the app returns to the existing single-column responsive layout.
