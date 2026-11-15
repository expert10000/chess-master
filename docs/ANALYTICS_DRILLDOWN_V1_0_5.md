# v1.0.5 — Analytics → Games Drill-Down + Comparison Explorer

v1.0.5 turns Game-Level Analytics from a passive report into a diagnostic workspace.

## Clickable analytics

Every primary numeric metric in the game analytics panel is now actionable:

- reviewed games;
- reviewed moves;
- average CPL;
- blunders/game;
- issues/game;
- White / Black metrics;
- Opening / Middlegame / Endgame metrics;
- per-opening games / moves / CPL / blunders.

Clicking a number creates an **Exact evidence** drill-down based on the same current 10 / 20 / 50-game window.

Example:

`Middlegame → Avg CPL 91 cp`

opens the reviewed middlegame moves that produced that number, sorted by CPL, with:

- saved game;
- exact ply and SAN move;
- verdict;
- CPL;
- phase;
- ECO/opening;
- **Open move** action.

## Evidence views

The drill-down has two views:

### Exact moves

Shows every contributing reviewed move and lets the user open the stored game directly at that historical ply.

### Games containing these moves

Groups evidence by saved game and shows:

- matching move count;
- average CPL for the selected evidence;
- blunder count;
- issue count;
- **Open game** action.

For a blunder drill-down the game-group action is explicitly labeled:

**Show games containing these blunders**

## Comparison explorer

Four comparison modes are included.

### Last N vs previous N

Compares the selected current 10 / 20 / 50 reviewed games with the previous same-size window.

### White vs Black

Compares the student's reviewed performance as White against Black.

### Opening vs opening

Any two classified openings in the current selected window can be compared. This supports comparisons such as:

- French vs Sicilian;
- Italian vs Ruy Lopez;
- one repertoire branch vs another.

### Opening / Middlegame / Endgame

Puts all three phase summaries side-by-side.

Every metric inside the comparison explorer is also clickable and opens its own exact evidence set.

## Library integration

The analytics evidence layer uses v1.0.4 persistent saved games. Model games and archived games remain excluded from personal performance analytics, exactly as in v1.0.4.

Opening a move from analytics reconstructs the stored game and opens the review workspace at the exact historical ply with the saved review loaded.

## No new persistence schema

v1.0.5 does not add another local-storage key. Drill-down and comparison state are transient UI state derived from the persistent game library.
