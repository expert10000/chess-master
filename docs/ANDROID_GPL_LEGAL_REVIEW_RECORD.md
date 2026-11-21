# GPLv3 distribution-scope review for Stockfish Coach Android
**Review date:** 2026-11-21
**Release status:** NO-GO — technical source reconstruction reported, legal clearance NOT given
**Engineering choice:** publish complete corresponding source for the Android app and Stockfish together, unless a later documented legal determination establishes a different compliant scope.

## 1. Material examined
- `src/mobile/engine.ts` uses a Web Worker running the shipped Stockfish.js/WASM engine and UCI string messages (`uci`, `position fen`, `go`, `setoption`, `stop`).
- `src/mobile/MobileApp.tsx`, `vite.mobile.config.ts`, `capacitor.config.json` and Android Gradle sources make a single downloadable app bundle.
- Root `LICENSE` grants MIT rights to the project contributors' code.
- Stockfish.js 19.0.1 is GPL-3.0, pinned to commit `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`, with lite NNUE file `nn-61e7af4bb97d.nnue`.
- User-reported formal rebuild status `REPRODUCIBLE_EXACT`; the complete formal JSON and local source tarball were not made accessible to this review session.
- Existing SVG license inventory: MIT for spatial/fantasy; Apache-2.0 for chessnut. Unverified Staunton PNG was excluded.

## 2. Scope alternatives considered

**A — Separate programs / mere aggregation.** The Worker is a separately executed engine receiving standard UCI strings. This is evidence favoring independent-program treatment. But the engine is distributed in the same Android package and designed specifically for this app. The Worker's isolation and text protocol alone do *not* prove that the combined distribution is mere aggregation.

**B — Complete covered application.** Treat the distributed Android software conservatively for source-delivery purposes: provide app React/TypeScript/CSS, Capacitor Android and Gradle sources, build scripts, lockfiles, bundled assets/licensed notices, Stockfish.js and full engine corresponding source, plus an exact-version manifest. This avoids depending on the uncertain separation claim for the source boundary. It is the chosen engineering route, NOT a legal determination of derivative-work status.

GPLv3 explicitly allows commercial sale; price alone is not the obstacle. Existing MIT code may be included under GPL-compatible terms while preserving its original MIT copyright/permission notices. Do not falsely imply all third-party materials can be relicensed or that ownership has transferred.

## 3. Outstanding legal checks — no sign-off

A qualified licensing reviewer must decide, for the actual signed Android artifact:

- Whether the Worker and frontend are separate programs or a combined GPL-covered work under applicable law and GPL terms.
- If combined, the exact covered scope and appropriate GPLv3 licensing notices for the whole app while preserving MIT/Apache/BSD notices and attribution.
- Whether recipients have practical access to the entire **Corresponding Source** needed to generate, install, run, and modify the covered object code (GPLv3 §1), not merely the Stockfish engine, including generated components, interface definitions, scripts and any required build network inputs.
- Which GPLv3 §6 source-conveyance route will be used with Google Play distribution, and how every recipient gets enduring source access without extra restrictive terms. A bundled archive is an implementation candidate, not an automatic legal compliance conclusion.
- Whether GPLv3 §6 Installation Information obligations arise for the distributed software/device arrangement; document why or why not.
- Whether store policies, app signing, update procedures, DRM, and any commercial EULA introduce further restrictions inconsistent with recipients' GPL rights.
- Whether bundled dependencies, artwork, fonts, native code, notices and provenance are complete and commercially redistributable.
- Whether a publicly accessible durable archive is appropriate in addition to a bundled ZIP, given Android in-app access and practical retrieval of the source.

## 4. Technical gates for reviewer evidence

`npm run android:source:review` must produce `TECHNICAL_PREFLIGHT_PASS_LEGAL_REVIEW_PENDING`.

`npm run android:complete-source:prepare` must create `release-sources/chess-coach-complete-source-candidate.zip` and its manifest, without local secrets.

`npm run android:complete-source:verify` must produce `COMPLETE_SOURCE_TECHNICAL_PASS_LEGAL_PENDING` and an empty errors array. Verify complete source ZIP against the actual signed AAB and installed application after legal sign-off.

The reviewer should inspect the actual artifacts and exact full SHA-256 values. **No access to a user's `C:\Users\...` path is available through GitHub or chat, and no full local report was independently opened in this review.** The reported exact rebuild is supporting evidence, not a substituted archive inspection.

## 5. Decision record

| Decision | State |
| --- | --- |
| Source coverage engineering policy | COMPLETE-SOURCE CANDIDATE selected |
| Stockfish JS/WASM reproducibility | User-reported `REPRODUCIBLE_EXACT`; technical evidence pending independent review |
| Complete-source ZIP verified | PENDING actual local run |
| Complete work GPLv3 obligations | UNRESOLVED — requires legal reviewer |
| Sign-off identity and date | NOT RECORDED |
| `binaryMatchesSourceVerified` attestation | MUST REMAIN FALSE until technical and legal approval |
| Google Play upload | PROHIBITED by current release policy |

**Legal approval cannot be issued by this repository file.** Record a legal reviewer, review date, exact app commit, ZIP SHA-256, AAB SHA-256, findings and disposition in a separate approved release record. Do not flip flags or merge a draft PR as a surrogate.

## References
- GPLv3: https://www.gnu.org/licenses/gpl-3.0.html
- GNU GPL FAQ: https://www.gnu.org/licenses/gpl-faq.html
- Stockfish.js: https://github.com/nmrugg/stockfish.js
