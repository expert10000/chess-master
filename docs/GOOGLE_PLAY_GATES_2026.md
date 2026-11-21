# Google Play release gates — audit of 2026-11-20

Scope: `expert10000/chess-master`, default branch observed with app manifest `1.15.4`, Android package `com.expert10000.stockfishcoach`. This is a **source inspection**, not evidence of a fresh compilation, Play installation, legal opinion, or signed artifact.

Gate states: PASS = reproducible evidence met; PARTIAL = prerequisites exist but missing acceptance evidence; BLOCKED = necessary issue unresolved; NOT STARTED = no implementation/evidence established.

## G1 — Licensing and dependencies — BLOCKED
- Root `LICENSE` is MIT; `chess.js@1.4.0` BSD-2-Clause; `stockfish@^19.0.1` GPLv3; resolved `@capacitor/android@7.6.10` is MIT per package-lock.
- `scripts/copy-mobile-engine.mjs` copies Stockfish 19 lite single JS/WASM and GPL license into mobile public assets. The previous third-party notice incorrectly implied the Android package shipped no binary; corrected on audit branch.
- Lichess CC0 puzzles and source/provenance described in `docs/PUZZLES.md`.
- **Blockers:** produce release SBOM with exact locked npm and Gradle runtime packages, engine SHA-256 and reproducible corresponding source archive, GPL architecture/legal determination, verified asset inventory (original/Staunton/Modern/Classic/Fantasy pieces, fonts, graphics), an accessible in-app license viewer, and package-level verification.

## G2 — Content ownership and data provenance — PARTIAL
- Bundled Lichess-derived puzzle corpus sourced from CC0 sample; explicit filter and transformation documentation exists.
- Record author/license and reuse permissions for artwork, copy, screenshots, named branding and external API material.
- Record puzzle sample input commit, generated output hash, selection rules, and no-app-specific claims of chess.com endorsement.
- Verify actual app network calls/requests, and Lichess terms/attribution guidelines independently of dataset CC0.

## G3 — Privacy, store policy and account — BLOCKED
- Android manifest declares INTERNET; `android:allowBackup="true"`; FileProvider used for share.
- Local data and on-demand online Lichess puzzle fetch described in README and docs/PUZZLES.md.
- **Missing confirmed publication artifacts:** publicly hosted privacy policy, in-app link, accurate Data Safety answers based on final APK/AAB and SDK inspection, age/content declarations, consumer/support contact details. Account-deletion requirement depends on whether accounts are actually offered.
- Audit actual network endpoints, backup inclusion, data deletion UX, third-party SDK behavior, and policy consistency. Do not claim zero collection until network and packaged SDK review are complete.

## G4 — Commercial / billing model — NOT STARTED
- Proposed model: meaningful Free tier plus one-time lifetime Pro non-consumable entitlement; pricing 39.99 PLN is a hypothesis, not a configured Play price.
- No verified Play Billing dependency or entitlement implementation in the inspected package.json and Gradle module. No Paywall / Billing test evidence.
- Implement approved billing architecture, restore purchases, cancellation/refund/revocation handling, airplane mode/cache behavior, entitlement security and test purchases. Do not lock original existing features or charge users before confirming product-market fit. Avoid subscriptions without genuinely recurring services.
- Verify Play payments policy and EEA-specific billing rules at launch.

## G5 — Release identity, build, storefront — PARTIAL
- `capacitor.config.json`: `com.expert10000.stockfishcoach`, app name `Stockfish Coach`.
- `android/app/build.gradle`: application ID matches; upload signing via four `CHESS_COACH_UPLOAD_*` environment variables; `versionCode 1`, `versionName 1.0`.
- `android/variables.gradle`: compile/target API 36; min API 23.
- `docs/GOOGLE_PLAY_RELEASE.md` documents AAB generation, signing, account setup, listing, and Play testing.
- **Missing:** app name/trademark check, real license/legal approval, verified Play Console identity/package name, private upload keystore, artifact hash/signature, screenshot/graphic rights, final listing copy and contact, correct final version alignment. Never commit secrets or keystores.
- Android manifest `allowBackup=true` needs documented behavior and data-deletion check.

## G6 — Tests / signed release acceptance — BLOCKED
- Existing release guide reports from 2026-11-20: 191 unit tests, build, static release QA and mobile/puzzle smoke passed; Galaxy A56 Android 16 debug test passed in both orientations.
- SAME GUIDE states repository-wide typecheck fails on existing TS errors; therefore `npm run release:qa` must be treated as failing.
- No independently verified signed AAB, Play internal/closed track installation, Play Billing purchases, license/source inside package, or artifact hash captured in this review.
- Run on a clean checkout with locked dependencies: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, `npm run release:static`, `npm run android:sync`, `cd android && ./gradlew bundleRelease`.
- Inspect release AAB/APK permission list, included assets/notices, native library/JS licenses and network traffic. Validate signature, source SHA, upload checksum, Play device installation, backup/delete, no-network mode, puzzle fetch, PGN share/import, game persistence, portrait/landscape, low-memory process recovery.
- Required closed test (if applicable): 12 opted-in testers / 14 consecutive days before production request, subject to live Play Console requirements.

## Decision and order
**NO-GO for paid or public production release yet.** Finish G1 and G3 first. Next, validate G2 assets and G5 identity, implement G4 billing behind a feature flag, then fully execute G6. Documentation or unrun tests alone do not close any gate.

## Source files reviewed
`README.md`, `package.json`, `package-lock.json` (initial segment), `LICENSE`, `THIRD_PARTY_NOTICES.md`, `docs/GOOGLE_PLAY_RELEASE.md`, `docs/PUZZLES.md`, `docs/ARCHITECTURE.md`, `scripts/copy-mobile-engine.mjs`, `scripts/release-qa.mjs`, `vite.mobile.config.ts`, `capacitor.config.json`, `android/app/build.gradle`, `android/variables.gradle`, `android/app/src/main/AndroidManifest.xml`, and beginning of `src/data/puzzles.json`.
