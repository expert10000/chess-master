#!/usr/bin/env python3
"""Offline verification of the actual Android App Bundle against its release manifest.

Run only after the licensing gate and Android bundle build. Python 3.9+ stdlib.
This checks included bytes and artifact consistency, not signature or license legality.
"""
import argparse
import hashlib
import json
import sys
import zipfile
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--review-candidate', action='store_true', help='Accept only an explicitly unapproved review-only bundle')
p.add_argument("aab", nargs="?", default="android/app/build/outputs/bundle/release/app-release.aab")
args = p.parse_args()
bundle = Path(args.aab)
if not bundle.is_file():
    sys.exit(f"FAIL: no AAB found at {bundle}. No bundle acceptance was performed.")
failures = []
def digest(data):
    return hashlib.sha256(data).hexdigest()

with zipfile.ZipFile(bundle) as archive:
    names = set(archive.namelist())
    root = "base/assets/public/"
    manifest_path = root + "engine/source/compliance-manifest.json"
    required = [
        "licenses.html",
        "engine/Stockfish-GPL-3.0.txt",
        "engine/stockfish-19-lite-single.js",
        "engine/stockfish-19-lite-single.wasm",
        "engine/source/stockfish-corresponding-source.tar.gz",
        "engine/source/chess-coach-complete-source.zip",
        "engine/source/compliance-manifest.json",
    ]
    for path in required:
        if root + path not in names:
            failures.append("Missing AAB asset: " + path)
    if any("illustrated-sheet.png" in name for name in names):
        failures.append("Unlicensed Staunton illustrated sheet is still included in AAB")
    if manifest_path in names:
        try:
            manifest = json.loads(archive.read(manifest_path))
            expected_status = 'REVIEW_CANDIDATE_ONLY' if args.review_candidate else 'LEGAL_ATTESTATION_RECORDED'
            if manifest.get('releaseStatus') != expected_status or manifest.get('legalApproval') is not (not args.review_candidate):
                failures.append('AAB release status does not match the requested acceptance mode')
            entries = list(manifest.get("bundledFiles", [])) + list(manifest.get("assets", [])) + list(manifest.get("artworkNoticeFiles", []))
            source = manifest.get("correspondingSource", {})
            if source:
                entries.append({"path": "mobile/public/" + source.get("path", ""), "sha256": source.get("sha256"), "sizeBytes": source.get("sizeBytes")})
            else:
                failures.append("Missing corresponding-source manifest entry")
            complete = manifest.get("completeApplicationSource", {})
            if complete:
                entries.append({
                    "path": "mobile/public/" + complete.get("path", ""),
                    "sha256": complete.get("sha256"),
                    "sizeBytes": complete.get("sizeBytes"),
                })
            else:
                failures.append("Missing complete-application source manifest entry")
            if not entries:
                failures.append("Empty release inventory")
            for item in entries:
                relpath = item.get("path", "")
                if not relpath.startswith("mobile/public/"):
                    failures.append("Unexpected manifest asset path: " + relpath)
                    continue
                in_bundle = root + relpath.removeprefix("mobile/public/")
                if in_bundle not in names:
                    failures.append("Manifest file missing from AAB: " + in_bundle)
                    continue
                body = archive.read(in_bundle)
                if len(body) != item.get("sizeBytes"):
                    failures.append("Size mismatch: " + in_bundle)
                if digest(body) != item.get("sha256"):
                    failures.append("SHA-256 mismatch: " + in_bundle)
        except Exception as exc:
            failures.append("Invalid release manifest: " + str(exc))

print("AAB:", bundle)
print("AAB SHA-256:", digest(bundle.read_bytes()))
print("AAB assets inspected:", len(names))
if failures:
    for failure in failures:
        print("FAIL:", failure)
    sys.exit(1)
print("PASS: AAB contains required Stockfish source, engine/license bytes and license page; recorded payload hashes match.")
if args.review_candidate:
    print("REVIEW CANDIDATE ONLY: legal approval is pending; do not upload this bundle to Play.")
print("NOT VERIFIED: Google Play signing, GPL source completeness, copyright rights, or runtime functionality.")
