# Android licensing policy decision — complete corresponding-source publication

**Decision for release engineering:** Prepare and distribute the entire covered application source, not merely the Stockfish worker. **This is a conservative compliance approach, not a court ruling that the programs are legally one work.** Legal counsel and rights holders must still confirm the final licensing and release.

## 1. What has been reviewed

- `src/mobile/engine.ts` starts `stockfish-19-lite-single.js` in a Web Worker and exchanges standard UCI strings via `postMessage`. This supports an argument that Stockfish and the React frontend are distinct programs, but the complete app is shipped together and coupled to that Worker. No definitive standalone-program determination has been made.
- The application source repository has an MIT `LICENSE` identifying Stockfish Coach contributors. Stockfish.js is GPLv3; their full GPLv3 license and complete engine source must remain available. The MIT terms of individual contributions do not automatically vanish when a combined work is distributed under GPLv3.
- 36 shipped piece SVGs: 24 MIT (Spatial / Fantasy) and 12 Apache-2.0 (Chessnut), previously matched to exact upstream blobs. Keep author credits and applicable license/notice documents.
- Staunton raster sprite has been excluded from the commercial Android branch because its rights could not be established.
- The Windows exact JS/WASM rebuild is reported `REPRODUCIBLE_EXACT` with a documented post-build symlink-to-copy workaround. Source archive and full local JSON must still pass independent preflight on the release machine.

## 2. Adopted compliance-oriented distribution model

We will **prepare complete corresponding source for the Android app and Stockfish engine together**. Release materials should include:

1. All editable mobile React/TypeScript/HTML/CSS, chess logic, asset transforms, and bundled original artwork with rights;
2. Capacitor Android project and Gradle configuration, source build scripts and pinned dependency lockfiles;
3. Exact Stockfish.js 19.0.1 source revision, embedded lite NNUE `nn-61e7af4bb97d.nnue`, GNU GPLv3 license and version-matched build instructions;
4. Copyright notices and licenses for MIT/BSD/Apache dependencies and visual assets, plus code/provenance identifiers;
5. A machine-readable manifest with SHA-256 values and an accessible delivery method tied to the *same* app version;
6. A complete-source archive accessible to every recipient under conditions meeting GPLv3 Section 6, plus clear user-facing instructions.

Publishing the source does **not** imply releasing code under a false license or removing author notices. MIT-licensed individual files stay MIT where authored that way; if the complete distributed app is determined to be a combined GPL-covered work, the complete work's distribution must satisfy GPLv3. The project's notice page needs to disclose that relationship accurately.

## 3. What is not decided

- No legal ruling is made that the Web Worker is a GPL-independent program.
- No claim is made that merely uploading source files discharges all applicable GPL obligations. Determine what parts of the delivered binary constitute a covered work and verify applicable source scripts and third-party terms.
- No consent by any external rights holder is assumed beyond their actual license grant.
- No release, Play store listing, monetization, or payment integration is approved.

## 4. Release acceptance

**BLOCKED** until the local `npm run android:source:review` report is attached and reviewed, the source archive is assembled and independently inspected, the source distribution/combination licensing is approved by qualified counsel, all required third-party notices and licenses are included, and the final signed AAB is validated.

Only after those checks can the signed Android bundle and a public source-delivery location be published.

Primary references:
- https://www.gnu.org/licenses/gpl-3.0.html (Sections 1, 5, 6)
- https://www.gnu.org/licenses/gpl-faq.html (mere aggregation / communicating programs; exact corresponding source)
