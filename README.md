# Stockfish Coach

A local desktop chess trainer built with Electron, React, TypeScript,
`chess.js`, and a native Stockfish process.

It already supports:

- playing White or Black against selectable engine strength;
- Beginner, Club, Expert, Master and unrestricted modes;
- click-to-move and drag-and-drop board input with legal targets, capture rings, drag hover feedback, and promotion selection;
- native Stockfish through the UCI protocol;
- MultiPV position analysis with board arrows for best moves and candidate moves;
- highlighted tactical/positional concept squares and line motifs directly on the board;
- interactive board-idea inspection: click highlighted squares or arrows for contextual explanations;
- animated principal-variation playback for best, played, alternative, and candidate engine lines;
- move classification from Best through Blunder;
- “why was this move good/bad?” explanations;
- deterministic tactical and positional concept detection: hanging pieces, forks, pins, skewers, overloaded defenders, discovered line attacks, pawn weaknesses, passed pawns, outposts, open files, bishop pair, development, central influence, and king-zone pressure;
- best-line and played-line comparison;
- full move-history browser with start/previous/next/latest navigation, clickable plies, undo, board flip, and PGN copy;
- PGN/FEN import with local `.pgn` file loading, student-color selection, optional immediate full-game review, and FEN copy;
- full-game review summary with verdict counts, average centipawn loss, and first-issue navigation;
- separate Training mode that turns reviewed moves and personal mistakes into scored best-move exercises without changing the live game;
- local-only operation with a restricted Electron preload bridge.

## Requirements

- Windows 11, Linux, or macOS;
- Node.js 22.12 or newer;
- a native Stockfish executable.
- optional: Ollama for richer local natural-language wording. A GPU is not required.

The project is configured for Electron 43, React 19.2, Vite 8, and Stockfish 18.

## v0.8.4 — Interactive board explanations

- Enter **Inspect ideas** mode without changing the game.
- Click a highlighted tactical/positional square to get a dedicated coach explanation.
- Click best-move, played-issue, candidate, and tactical arrows to explain what the arrow means.
- Keep the selected board idea visually emphasized while reading its explanation.
- Send the selected idea directly into the Stockfish-grounded conversational coach for a deeper follow-up.
- Normal piece movement is locked while inspection is active so teaching clicks cannot alter the game.

See `docs/INTERACTIVE_BOARD_EXPLANATIONS.md` for details.

## v0.8.3 — Board ideas + principal-variation player

- Draw the current best move directly on the board.
- Show an orange arrow for a played issue and blue dashed arrows for MultiPV alternatives.
- Highlight squares involved in forks, pins, skewers, hanging pieces, king safety, pawn structure, outposts, material gains, and other detected concepts.
- Draw tactical line arrows for pins, skewers, discovered attacks, and forks.
- Toggle board ideas without changing the underlying position.
- Play Stockfish principal variations as a read-only animated board preview, then return to the exact position you were reviewing.
- Play the best line, played-move line, alternative best line, or any candidate line from position analysis.

See `docs/BOARD_IDEAS_AND_PV.md` for details.

## v0.8.2 — Evaluation timeline

- Plot White/Black Stockfish evaluation across reviewed plies.
- Mark inaccuracies, mistakes and blunders on the timeline.
- Click a graph point to navigate directly to that historical position.

See `docs/EVALUATION_TIMELINE.md` for details.

## v0.8.1 — Multi-game PGN collections

- Detect player/tournament PGN files containing many games.
- Choose one game from the collection before importing and reviewing it.

See `docs/PGN_COLLECTIONS.md` for details.

## v0.8.0 — PGN/FEN import + full game review

- Import a complete Chess.com/Lichess `.pgn` file or paste PGN text.
- Choose whether you are reviewing the game as White or Black.
- Optionally run a complete Stockfish review immediately after import.
- Import a standalone FEN position and continue playing or analyze it locally.
- Full-game summary counts Best, Excellent, Good, Inaccuracy, Mistake and Blunder moves, plus average centipawn loss and issue navigation.
- Imported games feed directly into history navigation, variations, conversational coaching and Training mode.

See `docs/GAME_IMPORT_REVIEW.md` for details.

## Quick start on Windows

### 1. Install packages

```powershell
npm install
```

### 2. Add Stockfish

Download an official Windows Stockfish build, extract it, then run:

```powershell
npm run stockfish:add -- "C:\Users\YOUR_NAME\Downloads\stockfish\stockfish-windows-x86-64-avx2.exe"
```

Verify the UCI handshake:

```powershell
npm run stockfish:check
npm run ollama:check
```

You may skip the copy command and choose the executable from the app instead.
The selected path is saved in Electron's user-data settings.

### 3. Start development mode

```powershell
npm run dev
```

The first TypeScript compilation may take a few seconds. Electron starts after
both the Vite server and `dist-electron/main.js` are ready.

## Production build

```powershell
npm run build
npm start
```

This creates the compiled renderer and Electron main process. An installer is
not configured in this initial repository; the source is ready for adding
Electron Builder or Electron Forge after the application identity and icons are
chosen.

## How the explanation works

For each reviewed move, the app asks Stockfish for:

1. the best continuations from the position before the move;
2. a second evaluation restricted to the move actually played.

The difference is converted to centipawn loss. The coach then reconstructs the
move with `chess.js` and explains verified features such as checks, captures,
development, castling, promotion, central control, and the engine's principal
variation.

The deterministic explanation layer remains the authority for chess facts. v0.6.2 enriches that evidence with named tactical and positional concepts; Ollama can optionally improve only the wording. If Ollama is disabled, unavailable, or fails, the deterministic answer is used unchanged.

## Repository map

```text
electron/
  main.ts                     Electron window and validated IPC
  preload.ts                  restricted renderer bridge
  stockfish/StockfishService  UCI process lifecycle and parser
  ollama/OllamaService        localhost-only optional LLM adapter
src/
  App.tsx                     game and analysis workflow
  components/                 board, move list and coach UI
  lib/chessCoach.ts           verdict and explanation logic
  lib/ollamaPrompt.ts         verified evidence packet / anti-hallucination prompt
scripts/
  add-stockfish.mjs           copy a local engine into resources
  check-stockfish.mjs         verify the UCI handshake
  check-ollama.mjs            verify local Ollama and list installed models
docs/
  ARCHITECTURE.md
  ROADMAP.md
```

## Useful commands

```powershell
npm run typecheck
npm test
npm run build
npm run stockfish:check
```

## Licensing

The application source is MIT licensed. Stockfish is GPLv3 and is deliberately
not included in this ZIP. Read `THIRD_PARTY_NOTICES.md` before distributing a
combined application package containing Stockfish.


## v0.2.0 — Move Experience, step 1

- Adds native drag-and-drop piece movement while keeping click-to-move.
- Selecting or dragging a piece immediately shows all legal destinations.
- Empty legal destinations use move dots; occupied legal destinations use capture rings.
- The drag source fades and the current legal drop square gets a clear hover outline.
- Illegal drops cancel cleanly without changing the position.
- Clicking the selected piece again cancels selection; clicking another friendly piece switches selection.
- Includes the equal-row board geometry fix so occupied ranks cannot resize the grid.

## v0.2.1 — Board-state feedback, step 2

- Distinguishes last-move source and destination squares.
- Strengthens the selected-square and legal move/capture feedback hierarchy.
- Highlights a checked king and gives checkmate a stronger terminal state.
- Shows a dedicated Stockfish-thinking status and keeps board squares visually stable while input is locked.
- Animates Stockfish moves across the board before committing the new position.
- Keeps all 64 board cells equal-sized at every supported layout width.


## v0.2.2 — Robust game-state and engine cancellation, step 3

- Introduces explicit game phases for player turn, Stockfish thinking, promotion, review, game over, and missing-engine states.
- Adds a session token so results from an older game can never modify a newly started or undone position.
- Adds a renderer-to-main-process cancellation command that sends UCI `stop` to Stockfish.
- Invalidates queued analysis work when New Game, side change, Undo, engine replacement, or shutdown makes it stale.
- New Game and side-change controls remain available while Stockfish is thinking, so a long search can be safely abandoned.
- Undo restores the exact position before the player's most recent move, including when the engine has not yet replied.
- Move-history review is temporarily locked while another engine operation owns the engine queue.
- The board now distinguishes `Stockfish thinking…` from `Reviewing your move…` instead of appearing available while review work is still running.


## v0.3.0 — Interactive move-history navigation

- Adds start / previous / next / latest controls above the move list.
- Clicking any SAN move renders the exact board position after that ply without mutating the live game.
- Historical positions are read-only and clearly marked with a History mode banner.
- The selected historical move is highlighted and its source/destination squares remain visible on the board.
- Moving through history automatically requests the coach review for the selected ply; a newer navigation request cancels stale analysis.
- Arrow Left/Right step through plies, Home jumps to the starting position, and End or Escape returns to the live board.
- Analyze position now analyzes the board currently being viewed, including historical positions.
- Returning to Latest restores the live game instantly; history browsing never rewrites the actual game.

## v0.4.0 — Persistent automatic coaching

- Student moves are reviewed automatically after Stockfish replies.
- Review verdicts are stored on the move record instead of disappearing when you navigate away.
- Historical moves reuse cached reviews immediately; an unreviewed historical move is analyzed once and then cached.
- `Review all moves` fills the cache for every remaining unreviewed ply, including Stockfish moves.
- Move chips display compact verdict markers for Best, Excellent, Good, Inaccuracy, Mistake, and Blunder.
- Previous/Next mistake navigation jumps between Inaccuracy, Mistake, and Blunder moves.
- Review progress shows how many plies have cached coaching and how many issues have been found.
- Variation snapshots preserve cached move reviews.

Keyboard: `[` previous mistake, `]` next mistake.

## v0.5.0 interactive trainer

The coach panel now supports targeted local questions for reviewed moves: **Why this move?**, **Why is best stronger?**, **What is the threat?**, and **Show calculation**. A **Why not another move?** field accepts SAN or UCI (for example `Nf3` or `g1f3`) and asks Stockfish to compare that legal alternative against the best move in the same position. No online service or language model is required; explanations are grounded in the stored Stockfish evaluations and principal variations.


## v0.6.0 — Conversational coach

- Adds a free-text coach box directly below the move/position explanation panel.
- Accepts ordinary questions such as `What is the plan?`, `What is the threat?`, `Why is the best move stronger?`, `What is the material balance?`, and `What if Nf3?`.
- Detects SAN/UCI move mentions and uses Stockfish `searchmoves` to compare the candidate against best play.
- Supports unambiguous natural capture phrases such as `Why can't I take the bishop?` when exactly one legal bishop capture exists.
- General position questions are answered from MultiPV engine analysis plus verified board facts (material, check state, castling rights, captures, checks, development, and central control).
- Each answer displays a grounding note with the Stockfish engine/depth used.
- Keeps the prose deterministic and local; no cloud LLM is required, so it cannot invent an illegal variation outside the engine lines it was given.
- Chat history keeps the most recent questions in the current game and is cleared on New Game.

The conversational layer is intentionally modular. A later optional adapter can send the same Stockfish-grounded facts to a local Ollama model for richer wording while preserving deterministic engine evidence.


## v0.6.1 — Optional local Ollama explanation mode

Stockfish remains the chess authority. Ollama is only an optional natural-language layer.

- Electron checks only `http://127.0.0.1:11434`; the renderer is not given unrestricted network access.
- The app lists models already installed in Ollama and lets the user choose one from the coach panel.
- **Use Ollama** is opt-in. Rules-only deterministic coaching remains the default and works exactly as before.
- Before Ollama is called, Stockfish/chess.js create a verified evidence packet containing the question, FEN, deterministic answer, verified facts, and principal line.
- The system prompt explicitly forbids inventing moves, evaluations, material counts, checks, mates, or variations, and forbids changing engine numbers.
- If Ollama fails or times out, the same chat turn falls back to deterministic wording rather than failing the chess explanation.
- The selected model and opt-in preference are stored locally in browser storage.
- CPU-only Ollama is supported; NVIDIA is not required.

### Optional Ollama setup

Install and start Ollama separately, then pull any chat/instruct model you prefer. Example:

```powershell
ollama pull qwen3:8b
npm run ollama:check
npm run dev
```

Inside **Conversational coach**, click **Refresh**, choose the detected model, and enable **Use Ollama**.

The architecture is deliberately asymmetric:

```text
chess.js + Stockfish -> verified chess evidence -> optional Ollama wording
                         ^ authoritative           ^ presentation only
```


## v0.6.2 — Tactical and positional concept engine

The coach now extracts named chess ideas directly from board geometry before producing an explanation. These concepts are displayed as compact chips in move reviews and conversational answers, and are also included in the verified evidence packet sent to Ollama.

High-confidence detections include:

- hanging pieces and lower-value-piece pressure;
- knight/piece forks and double attacks created by a move;
- absolute pins to the king and selected relative pins/skewers;
- overloaded sole defenders and removal of a sole defender;
- discovered line attacks opened by a move;
- checks, mates, material gain and castling;
- doubled, isolated and passed pawns;
- supported knight outposts not challengeable by an enemy pawn;
- open and semi-open files occupied by rooks/queens;
- bishop pair, development lead, central influence and exposed king zones.

Ask the conversational coach questions such as:

```text
What tactical motifs are here?
Is anything hanging?
Are there any pins or forks?
What pawn weaknesses are here?
Do I have an outpost?
Which files are open?
What are the positional weaknesses?
```

The detector is intentionally conservative. A label is board-geometry evidence, not a claim that the motif is necessarily winning; Stockfish evaluation and principal variations remain the final authority.


## v0.7.0 — Training mode

Training is an additional top-level mode; **Play & Coach is preserved unchanged**. Switching modes never rewrites the live game, history, saved variations, or cached coaching.

- **My mistakes** builds exercises from the student’s reviewed Inaccuracy, Mistake, and Blunder moves.
- **All reviewed moves** can train any reviewed student position, including positions where the original move was already strong.
- The best move is hidden until the student plays an answer or explicitly reveals it.
- Move input uses the same click/drag board and promotion workflow as normal play.
- Stockfish evaluates every attempt against unrestricted best play and returns the same Best/Excellent/Good/Inaccuracy/Mistake/Blunder scale.
- Best or Excellent counts as solved.
- Progressive hints reveal the idea, then the piece, then the destination; **Show answer** reveals the exact SAN/UCI move.
- Hints reduce the score. Retry keeps the current hints so the student can calculate again with the same assistance.
- Session statistics track attempts, unique solved exercises, and best score per exercise.
- Previous/Next cycles through the current exercise source.
- Returning to **Play & Coach** restores the existing live position immediately.

See `docs/TRAINING_MODE.md` for the scoring and state-isolation design.


## v0.8.1 — Multi-game PGN collections

Large downloadable PGN files often contain hundreds or thousands of games. The import dialog now detects these collections, shows the number of games, and lets you choose one game before importing/reviewing it. This fixes the chess.js parse error that previously appeared at the `[` starting game 2.


## v0.8.2 — Evaluation timeline

Reviewed games now include a clickable Stockfish evaluation graph. The line is always shown from White's point of view, player inaccuracies/mistakes/blunders are marked directly on the timeline, and clicking any reviewed point opens that exact historical position. The v0.8.1 multi-game PGN selector remains included.


## v0.8.4 — interactive board explanations

Board ideas can now be inspected instead of only viewed. Turn on **Inspect ideas** in the board toolbar, then click a highlighted square or an arrow. The coach opens a grounded explanation describing what the marker means, why the square or move matters, and how it was derived. The selected marker is emphasized on the board.

The explanation card also offers **Ask conversational coach about this**, which sends a position-specific follow-up into the existing Stockfish-grounded conversational coach. Ollama remains optional and only improves wording.

Inspection mode deliberately locks normal piece movement while active so a teaching click can never be mistaken for a chess move. Exit inspection to resume normal play.
