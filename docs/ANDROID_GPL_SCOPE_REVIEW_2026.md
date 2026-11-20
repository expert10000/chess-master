# GPLv3 release-scope assessment — Stockfish Coach Android (2026-11-20)

**Status: technical review prepared; legal determination pending.** This is not a legal opinion or publication approval.

## Evidence provided by the Windows qualification

The user reported `artifacts/stockfish-source-rebuild-evidence.json` returned `REPRODUCIBLE_EXACT` after an Emscripten 6.0.9 rebuild, matching both the npm Stockfish.js 19.0.1 JavaScript and WASM SHA-256 hashes. They also reported the generated source archive hash matches their archive and local attestation draft. A documented temporary Windows post-build alias change substitutes a byte-identical file copy for a symlink while leaving the source archive untouched.

The actual complete local report and archive have **not** been independently opened by this review. Preserve the report and exact full SHA-256 values; the abbreviated hashes in the user's message are not sufficient for automated acceptance.

## Corresponding-source inventory examined

The pinned source revision is `nmrugg/stockfish.js@0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6` (v19.0.1). Its source tree includes `build.js`, `Copying.txt`, `src/Makefile`, `scripts/net.sh`, `src/evaluate.h`, and `src/emscripten/wasm-makefile.mk`. The build requires Emscripten 6.0.9.

The lite build references `nn-61e7af4bb97d.nnue`. It is fetched by `scripts/net.sh`, rather than included in the bare Git tree. Our source-preparation script injects the network into a combined tarball after verifying its SHA-256 filename prefix. The release checker checks archive structure, NNUE hash, locked package version, source revision and attestation. A full binary reconstruction has now been reported on Windows, but the actual archive must still be independently inspected for omissions and readable source/build inputs before signing.

Relevant upstream source:
- https://github.com/nmrugg/stockfish.js/tree/0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6
- https://github.com/nmrugg/stockfish.js/blob/v19.0.1/build.js
- https://github.com/nmrugg/stockfish.js/blob/v19.0.1/scripts/net.sh
- https://www.gnu.org/licenses/gpl-3.0.html

## Android boundary actually implemented

`src/mobile/engine.ts` constructs a browser Web Worker from `engine/stockfish-19-lite-single.js`, sends standard UCI strings via `worker.postMessage`, and parses engine responses as UCI protocol lines. It uses `uci`, `position fen`, `go movetime`, `setoption`, and `stop`. The engine runs in a separate worker execution context with its own bundled JavaScript/WASM bytes.

`src/mobile/MobileApp.tsx` uses that engine adapter, `chess.js` for game rules, and React UI. The Stockfish engine is delivered *together with* those files in one signed Android App Bundle. A Worker boundary and standard protocol are supporting evidence for separate-program classification, but do not establish that distinction automatically. Consider distribution as a combined work as well as distribution of distinct programs.

## Required decisions before Android release

1. Determine whether the particular shipped Android worker/UI arrangement is mere aggregation/separate programs or a single GPL-covered combined work. The exact interface, coupling, packaging and runtime behavior should be assessed by qualified licensing counsel; do not infer an exemption solely from UCI or Web Worker.
2. If the app is a combined GPL-covered work, address GPLv3 conditions affecting the entire covered work; a top-level MIT `LICENSE` is not enough by itself. If separate, provide complete corresponding source for the distributed Stockfish.js engine with the required notices and terms.
3. Verify the source archive against the actual AAB (not simply the checkout). The AAB must contain the exact engine bytes, GPL text, source offer/archive and manifest, and the source route must work in the installed app. Preserve release identity and SHA-256 evidence.
4. Confirm notices and appropriate attribution for the 36 vetted SVGs and all other assets, native libraries and bundled SDKs; check the user-facing license UI and the exact zipped notice files.
5. Obtain technical source-completeness review and legal approval explicitly, with reviewer, date, archive hash and source-to-binary evidence. Only then change the local attestation from `false`, and retain that approval separately from the Android/Play acceptance.
6. Perform full signed AAB and installed-app testing, and independently review the reported npm dependency vulnerabilities.

## External guidance

GPLv3 Section 1 defines corresponding source to include source and build scripts. GPLv3 Section 6 deals with source accompanying object-code distribution. GNU GPL FAQ discusses when distinct communicating programs may be separate and emphasizes that the degree of coupling and communication semantics matter.

This assessment keeps production release, paid billing and Play publication **NO-GO** until all remaining gates are closed.
