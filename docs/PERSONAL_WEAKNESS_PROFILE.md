# v0.9.3 — Personal Weakness Profile + Targeted Training

v0.9.3 turns reviewed games into a persistent cross-game training profile.

## Persistent categories

The profile currently tracks six explicit areas:

1. **Hanging pieces**
   - hanging-piece concepts;
   - overloaded/undefended-piece evidence;
   - grounded review language about dropping material.

2. **Missed tactics**
   - forks/double attacks;
   - pins and skewers;
   - discovered attacks;
   - removal of defender;
   - forcing checks/checkmates;
   - a large tactical-pressure advantage for Stockfish's move over the played move.

3. **King safety**
   - exposed king-zone evidence;
   - review warnings about king safety;
   - a clear king-safety advantage for Stockfish's move in the v0.9.2 positional profile.

4. **Pawn structure**
   - doubled/isolated pawn concepts;
   - structural review warnings;
   - a clear pawn-structure advantage for Stockfish's alternative.

5. **Poor development**
   - review evidence about development;
   - a clear development-profile advantage for Stockfish's move.

6. **Opening deviations**
   - the first move that leaves the bundled local opening book.

## What is aggregated

For each category the app stores:

- number of observations;
- cumulative severity;
- average Stockfish centipawn loss;
- last-seen time;
- up to 24 recent training snapshots.

The profile also stores the total number of reviewed player moves.

A move can contribute to more than one category. For example, one blunder can both hang a bishop and miss a tactical fork.

## Priority

The UI's weakness priority is a teaching score combining:

- recurrence/frequency;
- Stockfish verdict severity;
- centipawn loss.

It is not an Elo estimate and it is not a Stockfish evaluation.

## Train my weakest area

The highest-priority category with stored examples exposes:

**Train my weakest area**

This builds a targeted set of up to 12 recent positions from previous reviewed games.

Examples are stored with enough information to recreate the position:

- FEN before the mistake;
- original move/verdict/loss;
- Stockfish best move;
- category label.

The move is hidden in Training mode. Stockfish re-evaluates the user's attempted answer as usual.

Opening-deviation examples preserve their local book candidates and continue to use the existing opening-training acceptance rule.

## Persistence

The profile is stored locally under:

`stockfish-coach.weakness-profile.v1`

Starting a new game or importing another PGN clears only temporary observation guards and current targeted sets. It does not erase the persistent profile.

Within one loaded game, a reviewed move is counted once even if the UI rerenders or the user navigates backward and forward through history.
