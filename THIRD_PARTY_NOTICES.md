# Third-party notices and distribution status

This file covers the desktop source and the Android distribution; they use Stockfish differently.

## Stockfish.js (Android — bundled)

The Android build copies `stockfish-19-lite-single.js` and `stockfish-19-lite-single.wasm` from the installed `stockfish` npm package into `mobile/public/engine/`, alongside the `Copying.txt` GNU GPL version 3 license text. The current package manifest requests `stockfish@^19.0.1`; the exact resolved version and SHA-256 hashes MUST be recorded from the release build before publication.

Stockfish.js and the bundled engine are GPL-3.0. Selling a package containing them is permitted subject to the GPL's terms. Distributors must provide the applicable license, copyright notices, and complete corresponding source for the precise binaries (including applicable build scripts and engine network inputs). Do not treat a general upstream homepage or license text by itself as proof of complete compliance.

Upstream project and sources: https://github.com/nmrugg/stockfish.js
Corresponding release candidate: https://github.com/nmrugg/stockfish.js/releases/tag/v19.0.1
Upstream engine: https://github.com/official-stockfish/Stockfish

**RELEASE BLOCKER:** Verify the exact binary-to-source match, preserve a durable source archive/build instructions, publish the source-delivery mechanism, and review whether the Android app and Worker-based UCI protocol are separate programs or a combined GPL-covered work. That determination requires architecture-specific legal review. An MIT declaration for our own code does not waive third-party GPL obligations.

## Stockfish (desktop — separately supplied executable)

The desktop program selects an existing locally installed native Stockfish executable or can copy one provided by the user. This repository does not itself ship a native Stockfish executable in its source tree. If a future desktop installer bundles it, the distributor must also satisfy GPLv3 source and license obligations for the specific build.

## chess.js

`chess.js` is BSD-2-Clause licensed. Retain its copyright and license notices in distributed third-party materials.

## React, Capacitor, Electron, Vite and other dependencies

Retain the license terms and attribution notices for the versions actually shipped. Capacitor packages in our current npm lockfile are MIT licensed; do not assume a single license for the entire transitive or native dependency tree. Generate and review an SBOM/license report from the locked dependency graph and Gradle release runtime graph.

## Lichess puzzles

The bundled puzzle corpus is derived from the Lichess standard puzzle database (CC0): https://database.lichess.org/#puzzles. The repository's `docs/PUZZLES.md` records the sample provenance, filtering and data transformation. API delivery and branding must be checked separately from the dataset license.

## Chess-piece sets, images, fonts, audio and store graphics

**RELEASE BLOCKER:** Record origin, author, URL, exact license, and required credit for each shipped asset, including the original board set and Modern, Classic, and Fantasy variants. The original illustrated Staunton PNG was removed from the proposed commercial Android release because its redistribution rights were not verified. The store icon/feature image/screenshot rights must also be established. No license is inferred from a filename or an asset being present in a repository.

## Ollama (desktop optional, not bundled)

Ollama and models installed independently by desktop users are not redistributed by this application; review individual model licenses if that changes.

See `docs/GOOGLE_PLAY_GATES_2026.md` for the release acceptance ledger.
