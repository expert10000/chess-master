# Whole-app GPL source candidate — review instructions

The release engineering decision is to prepare complete source for the **whole Android app plus bundled Stockfish.js**. This is a conservative distribution policy, **not** a final legal ruling that the Web Worker and UI form one GPL-covered work, and not an authorization to publish.

## Evidence and order

1. Review the actual Windows `artifacts/stockfish-source-review.json`. The expected technical-only status is `TECHNICAL_PREFLIGHT_PASS_LEGAL_REVIEW_PENDING` with empty issues and the exact full SHA-256 source archive checksum matching the formal rebuild report. This file is on the developer workstation and was not provided through this chat.
2. Independently review `artifacts/stockfish-source-rebuild-evidence.json` and `release-sources/stockfish-corresponding-source.tar.gz`, including the single Windows post-build symlink-to-copy modification.
3. Run `npm run android:complete-source:prepare` from a clean tracked tree. The script refuses missing source preflight, mismatched source archive, tracked key/secrets and symlinks; it includes only tracked app source files plus the already reviewed Stockfish archive.
4. Run `npm run android:complete-source:verify`. Inspect `release-sources/chess-coach-complete-source-candidate.zip`, `artifacts/chess-coach-complete-source-candidate.json` and `artifacts/chess-coach-complete-source-verification.json`. The verifier requires an exact match between every tracked file in the current checkout and the ZIP, the expected Android build source, the nested Stockfish archive, and the formal source preflight. Passing means `COMPLETE_SOURCE_TECHNICAL_PASS_LEGAL_PENDING`, not publication authorization. Do not upload this archive publicly before rights and license review. It does not automatically include `node_modules` or the private local attestation draft.
5. Review all shipped native/JavaScript dependencies, MIT/Apache/BSD notices and artwork copyright texts. Determine additional corresponding-source requirements for dependencies and the complete distributed work. Confirm source recipients can actually install, rebuild and modify the relevant components.
6. Qualified legal/licensing review must sign off on the exact complete-source scope and availability arrangement (GPLv3 Sections 1, 5, 6). In particular, existing MIT license notices for individual code files must be preserved, while the complete covered distribution, if a combined work, must comply with GPLv3.
7. Only after recorded source-completeness and legal approval can the local attestation be finalized. That does **not** by itself complete Android acceptance: produce and hash a signed AAB, verify matching embedded source/license materials and install/test the app from a Play testing track.

## Local commands

```powershell
git fetch origin
git switch release/stockfish-source-asset-inventory
git pull --ff-only

npm run android:source:review
Get-Content .\artifacts\stockfish-source-review.json

npm run android:complete-source:prepare
npm run android:complete-source:verify
Get-Content .\artifacts\chess-coach-complete-source-verification.json
```

**Release remains NO-GO.** The candidate generator intentionally does not set `binaryMatchesSourceVerified`, does not mutate Android build outputs, and does not publish source files or the app.

## 2026-11-21 engineering gate expansion

The draft PR now chooses to *ship the entire corresponding-source candidate with the Android package* rather than relying on the Worker separation for source coverage. When the independent whole-source verifier and the eventual approved source attestation are available, `scripts/prepare-android-licenses.mjs` stages both `engine/source/chess-coach-complete-source.zip` and the exact Stockfish engine source tarball; the AAB verifier requires both with matching hashes. The in-app license page exposes links to both archives. **This does not replace a legal GPLv3 Section 6 distribution-method review.** The release remains blocked until technical archive verification, third-party notice review, legal sign-off and signed AAB acceptance.
