#!/usr/bin/env python3
"""Prepare a conservative whole-application source archive for offline legal review.

Never ships anything automatically and never modifies the GPL attestation.
Requires clean Git checkout. Selects tracked files only; no node_modules, keys,
credentials, generated outputs, private local files or developer workspace.
Adds the separately prepared exact Stockfish corresponding-source tarball.
"""
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "release-sources/chess-coach-complete-source-candidate.zip"
SOURCE = ROOT / "release-sources/stockfish-corresponding-source.tar.gz"
REVIEW = ROOT / "artifacts/stockfish-source-review.json"
RESULT = ROOT / "artifacts/chess-coach-complete-source-candidate.json"
IGNORED = {
    "compliance/stockfish-source-attestation.json",
}
REQUIRED = [
    "LICENSE", "THIRD_PARTY_NOTICES.md", "package.json", "package-lock.json",
    "vite.mobile.config.ts", "capacitor.config.json", "android/app/build.gradle",
    "src/mobile/MobileApp.tsx", "src/mobile/engine.ts",
    "scripts/copy-mobile-engine.mjs", "scripts/prepare-android-licenses.mjs",
    "docs/ANDROID_COMPLETE_SOURCE_DISTRIBUTION_POLICY.md",
]
DENY_SEGMENTS = {"node_modules", ".git", "dist-mobile", "dist-electron", "artifacts", "release-sources"}
DENY_ENDINGS = (".keystore", ".jks", ".p12", ".pem", ".key")
def sha(data):
    return hashlib.sha256(data).hexdigest()
def git(*args):
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True)
    if p.returncode:
        raise RuntimeError("git " + " ".join(args) + ": " + p.stderr.decode(errors="replace"))
    return p.stdout

def main():
    if git("status", "--porcelain", "--untracked-files=no").strip():
        raise RuntimeError("Tracked files changed; commit or revert before creating candidate source archive.")
    tracked = [v.decode() for v in git("ls-files", "-z").split(b"\0") if v]
    if not set(REQUIRED).issubset(tracked):
        raise RuntimeError("Required source paths missing from tracked snapshot.")
    source = SOURCE.read_bytes()
    review = json.loads(REVIEW.read_text(encoding="utf8"))
    if (review.get("status") != "TECHNICAL_PREFLIGHT_PASS_LEGAL_REVIEW_PENDING"
        or review.get("sourceArchiveSha256") != sha(source) or review.get("issues")):
        raise RuntimeError("Source review missing or inconsistent. Run npm run android:source:review first.")
    blobs = []
    for relative in sorted(tracked):
        path = Path(relative)
        if path.is_absolute() or ".." in path.parts or any(x in DENY_SEGMENTS for x in path.parts):
            raise RuntimeError("Unsafe tracked path: " + relative)
        if (relative in IGNORED or path.suffix.lower() in DENY_ENDINGS
            or path.name in {"google-services.json", "key.properties"}
            or path.name.startswith(".env")):
            raise RuntimeError("Sensitive tracked input requires review: " + relative)
        full = ROOT / path
        if full.is_symlink():
            raise RuntimeError("Tracked symlink requires manual review: " + relative)
        data = full.read_bytes()
        blobs.append((relative, data))
    manifest = {
        "status": "SOURCE_CANDIDATE_ONLY_NOT_LEGAL_APPROVAL",
        "gitCommit": git("rev-parse", "HEAD").decode().strip(),
        "stockfishSourceSha256": sha(source),
        "technicalReviewStatus": review["status"],
        "trackedFileCount": len(blobs),
        "files": [{"path": p, "sha256": sha(b), "sizeBytes": len(b)} for p,b in blobs],
    }
    ARCHIVE.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for rel, data in blobs:
            z.writestr("chess-coach-source/" + rel, data)
        z.writestr("chess-coach-source/upstream/stockfish-corresponding-source.tar.gz", source)
        z.writestr("chess-coach-source/SOURCE_MANIFEST.json",
                   (json.dumps(manifest, indent=2) + "\n").encode())
    report = {
        "status": "CANDIDATE_CREATED_LEGAL_REVIEW_REQUIRED",
        "sourceArchivePath": str(ARCHIVE.relative_to(ROOT)).replace("\\", "/"),
        "sourceArchiveSha256": sha(ARCHIVE.read_bytes()),
        "stockfishSourceSha256": sha(source),
        "gitCommit": manifest["gitCommit"],
        "trackedFileCount": len(blobs),
        "isApprovedForPublicRelease": False
    }
    RESULT.parent.mkdir(parents=True, exist_ok=True)
    RESULT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf8")
    print(json.dumps(report, indent=2))

if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, ValueError, KeyError, json.JSONDecodeError) as exc:
        sys.exit("SOURCE CANDIDATE FAILED: " + str(exc))
