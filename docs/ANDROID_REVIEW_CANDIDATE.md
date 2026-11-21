# Signed Android review candidate

This workflow produces a **local, unapproved** AAB for licensing and release review. It is not a Play upload procedure and does not change the normal `android:licenses:prepare` gate.

First qualify the current clean Git commit with `android:source:verify`, `android:source:review`, `android:complete-source:prepare`, `android:complete-source:verify`, and the isolated complete-source debug rebuild and review. Keep the generated reports and both source archives with the bundle.

`npm run android:review-candidate:prepare` checks the pinned engine bytes, reproducible rebuild report, source archive, complete app source ZIP, artwork inventory, and matching Git commit. It deliberately permits a blank reviewer name/date and `binaryMatchesSourceVerified: false`. It stages the source archives and a manifest marked `REVIEW_CANDIDATE_ONLY` and `legalApproval: false`, then syncs Android assets.

With the private upload-key environment configured, run `android/gradlew.bat bundleRelease` and immediately copy the signed output to an ignored review-only artifact path. Remove `android/app/build/outputs/bundle/release/app-release.aab` after copying to avoid confusing it with an approved upload. Verify the candidate with:

```powershell
python scripts/verify-android-aab.py --review-candidate artifacts/play-chess-review-candidate.aab
```

The standard `python scripts/verify-android-aab.py <aab>` must reject this candidate. Check its signature separately with `jarsigner -verify` and record its SHA-256. Provide the AAB, source ZIP, Stockfish tarball, technical reports, third-party notices, and exact commit to the licensing reviewer. The reviewer must record the legal scope, source-delivery method, findings, identity and date. Only then may the normal release gate and signed release acceptance run. Do not upload a review candidate to Play Console.
