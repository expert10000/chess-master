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

It records a new **debug-only** Android APK SHA-256 in `artifacts/chess-coach-clean-source-build.json`, and saves the actual APK as `artifacts/chess-coach-clean-source-debug.apk`. It checks the debug APK contains Stockfish JS/WASM, the GPL text, license page and 36 inventoried SVGs, and rejects the excluded Staunton sheet. Run `npm run android:complete-source:rebuild:review` for a second independent ZIP/hash/report inspection, which writes `artifacts/chess-coach-clean-source-acceptance.json`. It does not need your Play signing key and does not publish anything. A pass indicates that the *archived source* is capable of a clean debug Android build in that environment; it does not establish signed AAB parity, legal license compatibility or user installation rights.

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

## E. Exact Windows execution without modifying local `main` / A56 changes

The original accepted 371-file source ZIP and report are ignored local files in the existing repository checkout. Do NOT switch the `main` working tree to PR #3 or regenerate the qualified ZIP on PR #3: that would change the baseline and invalidate the full-source identity.

In PowerShell, from the *existing* Chess Coach repository checkout (even if `main` has uncommitted A56 work), set up a detached additional Git worktree:

```powershell
$repo = (git rev-parse --show-toplevel).Trim()
$gate = Join-Path (Split-Path $repo -Parent) 'chess-coach-clean-rebuild-gate'
git fetch origin release/source-delivery-clean-rebuild-gate
if (Test-Path $gate) { throw "Worktree path already exists: $gate" }
git worktree add --detach $gate origin/release/source-delivery-clean-rebuild-gate
New-Item -ItemType Directory -Force -Path (Join-Path $gate 'release-sources'), (Join-Path $gate 'artifacts') | Out-Null
Copy-Item -LiteralPath (Join-Path $repo 'release-sources/chess-coach-complete-source-candidate.zip') -Destination (Join-Path $gate 'release-sources/chess-coach-complete-source-candidate.zip')
Copy-Item -LiteralPath (Join-Path $repo 'artifacts/chess-coach-complete-source-verification.json') -Destination (Join-Path $gate 'artifacts/chess-coach-complete-source-verification.json')
Set-Location $gate
python scripts/verify-clean-source-build.py
python scripts/review-clean-source-build.py
Get-Content .\artifacts\chess-coach-clean-source-acceptance.json
```

This worktree uses a **different directory**. It neither stashes nor resets the original `main` worktree. The copied ZIP retains the original `1d3d85d` source commit identity; the verifier requires exactly 371 tracked files and matching archive hashes. It does not regenerate or overwrite the ZIP.

Expected successful states:

- `artifacts/chess-coach-clean-source-build.json`: `CLEAN_SOURCE_DEBUG_BUILD_PASS_NOT_RELEASE_APPROVAL`.
- `artifacts/chess-coach-clean-source-acceptance.json`: `CLEAN_SOURCE_DEBUG_ACCEPTED_GPL_PENDING` with `errors: []`.
- Preserved `artifacts/chess-coach-clean-source-debug.apk` SHA-256 must match both reports. This is a **debug APK**, not a signed release AAB or Play artifact.

**Failure policy:** an error in npm, Vite, Capacitor, Android SDK or Gradle must remain a blocker. Retain the failure report and do not mark technical source acceptance passed. Legal clearance, final source delivery, signing and distribution continue to be separate gates.
