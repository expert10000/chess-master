# Source-delivery and clean Android rebuild qualification — follow-on gate

**Branch:** `release/source-delivery-clean-rebuild-gate`, based on immutable qualified source baseline `1d3d85d6f3e889beda0a97c4f59e29f51902f9c2`.

This is an **engineering-only follow-on proposal**. The source archive validated at `1d3d85d` remains unchanged; this branch modifies verification tooling and MUST trigger a fresh source-package qualification if its changes are included in a future distributable Android build.

## A. Clean rebuild from the actual complete-source candidate

Run `npm run android:complete-source:rebuild` on a Windows host with Node 22+, Python 3, Android SDK/Java and Gradle. The script requires the previously accepted ZIP verification JSON and exact ZIP SHA, extracts the actual source archive into an isolated temporary directory, then runs:

```
npm ci
npm run build:mobile
npm exec -- cap sync android
android/gradlew.bat assembleDebug
```

It records a new **debug-only** Android APK SHA-256 in `artifacts/chess-coach-clean-source-build.json`. It does not need your Play signing key and does not publish anything. A pass indicates that the *archived source* is capable of a clean debug Android build in that environment; it does not establish signed AAB parity, legal license compatibility or user installation rights.

Do not use `npm run android:release:prepare` here while legal approval remains unresolved.

## B. Proposed GPLv3 §6(d) source-delivery check

The in-AAB source archive is a useful additional delivery mechanism, but the legal reviewer should confirm whether a version-specific **free public download** linked near the Google Play object-code offer is needed for the chosen GPLv3 §6 path.

Only after a qualified reviewer and release owner explicitly authorize publication, copy `compliance/source-delivery-plan.example.json` to the ignored `compliance/source-delivery-plan.local.json` and fill:

- Exact `sourceCommit`, `androidVersionCode`, `androidVersionName`.
- Full SHA-256 for the exact complete-source ZIP.
- **Actual** public HTTPS source archive URL; do not use an unreviewed or imaginary destination.
- Exact proposed Play listing/source instructions including that URL.
- Separate formal legal approval record.

Then `npm run android:source:delivery:verify` retrieves the candidate public source (without uploading anything), checks the complete ZIP checksum against the locally qualified archive, records HTTP status, URL and full hashes in `artifacts/chess-coach-source-delivery-verification.json`, and returns `SOURCE_DELIVERY_TECHNICAL_PASS_LEGAL_PENDING` only on an exact match. Public accessibility and download integrity alone are **not** legal approval and do not establish obligations of long-term availability.

The source-delivery verification must **not** be run by prematurely publishing files solely to satisfy this gate. It is designed to validate a location *after* explicit legal and release authorization.

## C. Handoff to qualified licensing reviewer

Review `docs/ANDROID_GPL_LEGAL_REVIEW_RECORD.md`, `docs/ANDROID_COMPLETE_SOURCE_DISTRIBUTION_POLICY.md`, the exact 371-file candidate source ZIP and all Windows reports. Record:

1. Whether the Worker/UCI engine and React Android app form a combined covered work; the conservative engineering source package does not answer the legal classification.
2. GPLv3 §1, §5 and §6 obligations, the source-delivery route and acceptable Play-facing directions.
3. Whether §6 Installation Information is applicable, and installation/modification feasibility under Android signing.
4. Appropriate licensing and MIT, Apache-2.0, BSD, GPL notices plus other asset/dependency rights and remaining npm vulnerability triage.
5. Reviewer identity, date, exact commit, full ZIP/tar/AAB SHA-256, decision and conditions.

**Do not set the source attestation to true, sign/submit an AAB, publish code, activate billing, merge the release PR or touch local uncommitted Galaxy A56 changes on `main` until these gates are explicitly cleared.**

## D. Current acceptance

- Engine JS/WASM reproducibility — PASS (user-reported formal report).
- Stockfish source preflight — PASS (user-reported, zero issues).
- Complete source ZIP — PASS at `1d3d85d` (user-reported, 371 tracked files).
- Whole-app clean debug build from source ZIP — **NOT RUN**.
- Proposed public source download verification — **NOT RUN; no hosting authorized**.
- GPL legal approval, signed release AAB, Play-installed test, commercial publication — **BLOCKED**.

Primary references: [GPLv3 §6](https://www.gnu.org/licenses/gpl-3.0.html); [Google Play Developer Distribution Agreement](https://play.google/developer-distribution-agreement.html).
