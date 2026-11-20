# Stockfish source delivery and chess-piece clearance

## Scope
This gate applies to the **Android distribution**, where scripts/copy-mobile-engine.mjs bundles Stockfish.js single-thread lite JavaScript + WASM. The desktop app can use a user-supplied executable, and has different redistribution considerations.

A commercial app may distribute GPLv3 software, but the source materials, licenses and obligations for the **combined application** still require assessment. This tooling provides verifiable records and ships the attested engine source archive; it does NOT issue a legal opinion or prove that an arbitrary archive corresponds to a binary.

## Source-delivery workflow

1. Run `npm ci` from the repository root. Confirm the exact resolved stockfish package in `package-lock.json`.
2. Run `npm run android:source:fetch` to download the source candidate for the exact locked version. The upstream `v19.0.1` tag resolves to `0d5dd7944f88c817c07a26bc4fb1905d5f9c46d6`. The downloaded tarball alone does **not** prove source-to-binary correspondence.\n3. Obtain and verify the **complete corresponding source** for the precise shipped Stockfish.js engine, including any necessary generator/build scripts and relevant network files. Verify exact revisions against the JS/WASM artifacts. Merely downloading an unrelated upstream source tree does not suffice.
4. Put a redistributable archive of that material in `release-sources/stockfish-corresponding-source.tar.gz`. Do not add this generated archive to source control unless its contents and size have been reviewed.
5. SHA-256 hash that archive, and create `compliance/stockfish-source-attestation.json` from `compliance/stockfish-source-attestation.example.json`. Complete all fields truthfully, including who verified that binaries correspond to the archive. If not verified, leave `binaryMatchesSourceVerified` false and the gate will fail.
6. Fill in license rights for each set in `compliance/piece-assets.json`. For any set we cannot clear, remove it from the shipped app AND from the inventory only after checking all runtime references and build artifacts, or obtain a proper license.
7. Run `npm run android:release:prepare`. This runs the normal mobile build to stage engine binaries, audits all referenced piece files, copies the corresponding-source tarball to the bundled `engine/source/` directory, produces `engine/source/compliance-manifest.json` with hashes, and rebuilds/syncs Android so the source archive is included.
8. Produce the **signed release AAB**. Inspect its contents to confirm `engine/source/stockfish-corresponding-source.tar.gz`, `engine/source/compliance-manifest.json` and `engine/Stockfish-GPL-3.0.txt` were actually packaged. Independently verify the manifest SHA-256 checksums against the final package.
9. Expose a visible **Open-source licenses / Stockfish source** entry in-app, linking to the embedded source and license or a durable public download for the exact shipped engine. Validate the link in the Play-installed build. The archiving mechanism alone does not implement this UI requirement.
10. Perform an architecture-specific GPL legal review to determine whether any additional portions of the app must be offered as corresponding source. The engine protocol or Worker boundary does not by itself guarantee separate-work status.

**Release gate must remain blocked** if there is any missing source attestation, unapproved chess-piece set, missing content in the AAB, inaccurate third-party notices, missing in-app discoverability, or unresolved GPL architectural obligations.

## Asset inventory

The Android code in `src/mobile/MobileApp.tsx` offers:

| Display style | Runtime source | License record |
| --- | --- | --- |
| Desktop original | `src/lib/pieceGlyphs.ts` Unicode characters rendered in device fonts | No redistributed font binary in this implementation; check the final bundle |
| Staunton | `mobile/public/pieces/illustrated-sheet.png` | UNVERIFIED |
| Modern | `mobile/public/pieces/spatial/{w,b}{P,N,B,R,Q,K}.svg` | Verified 12/12 upstream MIT Git blobs |
| Classic | `mobile/public/pieces/chessnut/{w,b}{P,N,B,R,Q,K}.svg` | Replaced all 12 with byte-identical Apache-2.0 upstream files |
| Fantasy | `mobile/public/pieces/fantasy/{w,b}{P,N,B,R,Q,K}.svg` | Verified 12/12 upstream MIT Git blobs |

The script expands the three SVG patterns into 12 expected files each, audits the sprite sheet, records SHA-256 hashes, and detects unlisted art files beneath `mobile/public/pieces`.

**Do not infer an asset license from its style name or from its inclusion in Git.** Record authors, sources, license proof, and commercial permissions before setting `commercialUseApproved` to true. Any icons, screenshots or branding not under that asset folder require a separate release-wide audit.

## Limitations and acceptance

This first implementation is intentionally **fail-closed** and has not been run against a clean Android build in this review. The archive and attestation are not in Git, so the release command is expected to fail until the actual licensed source and asset evidence exist. No Google Play purchase, store listing or production release is authorized by this branch.

The corresponding source is delivered inside the Android asset bundle rather than merely offering an unverified link. A later optimization can publish a durable, verified source archive externally and ship the exact URL with the release manifest; that requires its own availability checks and source-offer compliance review.

## Update after first user-run release gate

The first attempt successfully built the mobile app, then stopped at licensing (no Android sync). After that run, the branch was updated: all 12 Classic/Chessnut SVGs were replaced with exact upstream Lichess originals and their hashes pinned. All 24 Modern/Fantasy SVGs also match upstream Lichess; the script verifies these 36 hashes. The script now inventories and SHA-256 hashes existing `.txt`/`.md` credit/license documents under the pieces directory instead of misclassifying them as artwork, but **only graphics require per-set commercial-use attestation**. These text documents must still be inspected for attribution requirements. Other unlisted artwork still blocks release.

Staunton remains UNVERIFIED. `src/mobile/illustratedPieces.ts` calls the sprite sheet 'user-provided', which is not proof of copyright ownership or a commercial license. Obtain provenance or substitute a proven open-license design before marking it cleared.

The generated `compliance/stockfish-source-attestation.json` is not checked into Git. After fetching and inspecting corresponding source, copy `compliance/stockfish-source-attestation.example.json` to that path and populate the exact archive hash, tag revision, source URL, build instructions, review identity/date and true evidence of binary correspondence. Never set `binaryMatchesSourceVerified=true` merely to bypass a failing script.

Current status: the script and asset fixes are committed on the draft branch. This review has **not** executed a clean end-to-end Android AAB build, nor independently verified source-to-binary reproduction.
