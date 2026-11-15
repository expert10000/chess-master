# v1.1.1 — Adaptive Session Composer

The daily planner is now an adaptive session composer. It creates a 10-, 20-, 30-, or 45-minute position set from the learner evidence available at the moment it is opened.

## Inputs

- due spaced-repetition and repertoire review;
- recurring weaknesses and their severity;
- reviewed mistakes in the current game and recent stored examples;
- active goal and weekly-priority multipliers;
- historically effective intervention types, with the v1.0.9 exploration safeguard.

## Composition rules

Each available evidence source first receives a place in the session. Remaining places are allocated repeatedly to the source with the strongest remaining need. Due review has the highest weight and new material the lowest capped share; this preserves memory without turning a short session into only reviews.

Every selected position retains its source and an exact human-readable reason. The rationale list is deliberately part of the planner, so the learner can inspect the session before starting rather than treating it as a black box.
