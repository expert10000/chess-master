# Open-source chess explanation options reviewed for v0.6.0

The v0.6.0 conversational layer does **not copy code** from the projects below. It keeps the current Electron/TypeScript architecture and uses them as architectural references only.

## CHONSE2

- Repository: https://github.com/ICARUS-2/chonse2/
- Project/site: https://chonse2.com/ and https://icarus-2.github.io/chonse2/
- Interesting idea: deterministic, browser-side natural-language game review without an LLM.
- Why it is relevant: this is closest to Stockfish Coach's current goal—explanations tied to verifiable board/engine facts instead of unconstrained language generation.
- Integration decision: no source was copied. Before directly reusing code, verify the repository license in the source checkout.

## EZ-Chess

- Repository: https://github.com/AnubhavChoudhery/EZ-Chess
- License: MIT (as documented by the project).
- Architecture: Python SDK combining Stockfish with natural-language explanations; supports Groq and local Ollama.
- Why it is relevant: it provides a good reference for a future optional local-LLM adapter.
- Integration decision: do not add a Python sidecar to v0.6.0 yet. Keep deterministic local answers first; optionally add Ollama as a separate provider later.

## ChessCoach

- Repository: https://github.com/chrisbutner/ChessCoach
- License: GPLv3-or-later (as documented by the project).
- Architecture: separate neural chess engine plus a trained natural-language commentary network.
- Why it is relevant: it demonstrates that commentary can be learned rather than templated.
- Caveat: its own README notes that commentary is often wrong, and it is a substantially heavier TensorFlow/GPU stack than this app needs.

## v0.6.0 decision

Use a hybrid deterministic architecture:

1. `chess.js` verifies board facts and legal moves.
2. Stockfish supplies best move, MultiPV alternatives, evaluations and principal variations.
3. A local intent parser recognizes questions about plans, threats, material, king safety, development, calculations, and candidate moves.
4. Candidate moves are forced through Stockfish `searchmoves`, so comparisons are based on actual engine calculations.
5. The prose generator only describes facts extracted from the board and engine output.

This provides a safe foundation for a later optional Ollama mode. In that mode, the LLM should receive the deterministic evidence packet and be allowed to improve wording, but not invent moves or evaluations.


## v0.6.1 implementation

The optional Ollama adapter is now implemented directly in the Electron/TypeScript application; no Python sidecar or third-party explainer code is copied.

- Ollama is contacted only through the Electron main process at `127.0.0.1:11434`.
- The renderer receives a narrow IPC surface for status/model discovery and generation.
- Stockfish and chess.js first produce a deterministic answer and evidence packet.
- Ollama receives that packet under a strict "rewrite only, do not invent chess facts" system prompt.
- Generation failure falls back to deterministic prose.

This follows the useful architectural idea seen in projects such as EZ-Chess (Stockfish plus optional local Ollama) while preserving this repository's own implementation and deterministic evidence layer.
