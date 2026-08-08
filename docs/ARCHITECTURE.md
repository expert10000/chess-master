# Architecture

## Process boundary

```text
React renderer
  │  typed IPC exposed by preload
  ▼
Electron main process
  │  UCI text protocol over stdin/stdout
  ▼
Native Stockfish executable
```

The renderer has no Node.js access. `contextIsolation` is enabled and
`nodeIntegration` is disabled. The preload exposes only three operations:
engine status, executable selection, and position analysis.

## Engine lifecycle

`StockfishService`:

1. resolves a configured or bundled executable;
2. starts one hidden native process;
3. performs the `uci` / `isready` handshake;
4. serializes searches so output from separate requests cannot interleave;
5. parses `info` and `bestmove` lines;
6. normalizes scores to White's point of view;
7. shuts down the process when Electron exits.

## Coaching pipeline

For a reviewed move the renderer requests two searches:

1. unrestricted MultiPV analysis of the original position;
2. analysis constrained by `searchmoves` to the move actually played.

The difference becomes centipawn loss. A deterministic explanation layer then
adds human-readable reasons based on the reconstructed move: check, capture,
development, castling, promotion, central occupation and the principal
variation. This is intentionally auditable and does not invent facts through a
language model.

## Future extension

A conversational layer can be added after the deterministic report. It should
receive only structured engine results and verified board features, while
Stockfish remains the source of tactical truth.
