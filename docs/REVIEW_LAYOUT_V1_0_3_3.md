# v1.0.3.3 — Review Layout Polish

This hotfix/polish release makes the review workspace more controllable after v1.0.3.2 fixed board clipping.

## Layout presets

Position Tools now exposes three desktop review layouts:

- **Board** — emphasizes the checkerboard and uses a narrower review sidebar.
- **Balanced** — the default v1.0-style balance.
- **Details** — gives more width to review panels and slightly reduces the checkerboard.

## Pin / unpin board

- **Board pinned** keeps the left board column sticky and internally scrollable on desktop.
- **Pin board** off returns the board column to normal document flow.

This is useful on small-height monitors or when the user wants ordinary page scrolling instead of two independently scrollable columns.

## Compact review headers

Compact mode reduces vertical review chrome:

- History mode becomes a smaller one-line strip.
- Board Inspector hides the full arrow legend while keeping the inspector actions.
- Player strips and avatars are slightly compressed.

The setting is on by default for review sessions.

## Follow selection

When enabled, selecting a move from the timeline/history automatically returns the pinned board column to its top so the selected historical board remains visible immediately.

`Focus selected` can do the same manually.

## Persistence

Review layout preferences are stored under:

`stockfish-coach.ui-review-layout.v1`

and are included in JSON Backup / Restore.
