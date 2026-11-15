# v1.2.0 — Repertoire Builder 2.0

The Repertoire Builder turns saved local-book choices into White and Black trees. A node represents the learner’s preferred move at a position; its continuation is linked to the next saved position whenever it exists.

- **Weak** means the position has a linked remembered deviation whose latest Stockfish verdict was Mistake or Blunder.
- **Forgotten** means it has never been recalled, or recall is below 60% after at least two attempts.
- **Transpose** marks a saved position reached by more than one saved predecessor.
- **Alternatives** and the displayed deviation count are from actual remembered game deviations, directly joining repertoire structure to played-game history.

**Train branch** creates ordered opening-recall exercises from a selected node through its saved continuation, up to ten positions. This is the foundation for v1.2.1 preparation packs.
