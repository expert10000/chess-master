# Offline puzzle pack

The app bundles a curated subset of Lichess community puzzles. The [Lichess puzzle database](https://database.lichess.org/#puzzles) is released under CC0. Its CSV supplies FEN positions, UCI solution lines, ratings and tactical themes. The bundled subset comes from the [stratified sample](https://github.com/imec-ailabs/Automatic-Prompt-Optimization-with-Chess) at commit `58d2617d24217f595b5bf2d37ca6328e2e6ca370`.

Run `python scripts/build-puzzle-corpus.py` to rebuild `src/data/puzzles.json`. The script keeps puzzles with popularity at least 70 and at least 100 plays, and currently omits promotion lines until the puzzle board supports promotion choice. Each FEN is **before** the opponent setup move (`Moves[0]`). After applying it, the player solves moves 1, 3, 5, etc.; the app plays the intervening opponent replies.

Ratings estimate puzzle difficulty, not engine playing strength. A puzzle line is one published solution; other moves may also be good chess moves. Mate-in-one alternatives are accepted when they checkmate.

The pack is available in the desktop **Puzzles** mode and the mobile **Puzzles** tab. Choose a level and theme, select a puzzle, play its line, request a source or destination hint, retry, reveal the solution, and replay it move by move on the board. Solved puzzle IDs are stored locally on each device. Run `npx vitest run tests/puzzles.test.ts` for corpus/logic validation and `npm run test:puzzles` after building desktop and mobile for UI smoke tests.
