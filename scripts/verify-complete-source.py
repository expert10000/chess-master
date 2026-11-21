#!/usr/bin/env python3
"""Fail-closed verification of the actual complete-source release candidate.

It checks every tracked-file hash/size, the included Stockfish corresponding-
source tarball, and exact Git commit against the current checkout. Passing is
TECHNICAL only and does not confer GPL legal approval.
"""
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parent.parent
CANDIDATE = ROOT / "release-sources/chess-coach-complete-source-candidate.zip"
STOCKFISH = ROOT / "release-sources/stockfish-corresponding-source.tar.gz"
PRECHECK = ROOT / "artifacts/stockfish-source-review.json"
OUTPUT = ROOT / "artifacts/chess-coach-complete-source-verification.json"
PREFIX = "chess-coach-source/"
EXPECTED = {
    "LICENSE", "THIRD_PARTY_NOTICES.md", "package.json", "package-lock.json",
    "android/app/build.gradle", "capacitor.config.json", "vite.mobile.config.ts",
    "src/mobile/MobileApp.tsx", "src/mobile/engine.ts",
    "scripts/copy-mobile-engine.mjs", "scripts/prepare-android-licenses.mjs",
    "docs/ANDROID_COMPLETE_SOURCE_DISTRIBUTION_POLICY.md",
    "docs/ANDROID_GPL_SCOPE_REVIEW_2026.md",
}
def sha(data):
    return hashlib.sha256(data).hexdigest()
def git(*args):
    result = subprocess.run(["git",*args],cwd=ROOT,capture_output=True,check=True)
    return result.stdout
def fail(errors, status="BLOCKED"):
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    result = {"status":status,"legalApproval":False,"errors":errors}
    OUTPUT.write_text(json.dumps(result,indent=2)+"\n",encoding="utf8")
    print(json.dumps(result,indent=2))
    sys.exit(1 if errors else 0)

errors = []
try:
    archive_bytes = CANDIDATE.read_bytes()
    engine_bytes = STOCKFISH.read_bytes()
    source_review = json.loads(PRECHECK.read_text(encoding="utf8"))
    if source_review.get("status")!="TECHNICAL_PREFLIGHT_PASS_LEGAL_REVIEW_PENDING" or source_review.get("issues"):
        errors.append("Stockfish preflight not accepted")
    if source_review.get("sourceArchiveSha256")!=sha(engine_bytes):
        errors.append("Stockfish source archive mismatch with technical preflight")
    commit=git("rev-parse","HEAD").decode().strip()
    if git("status","--porcelain","--untracked-files=no").strip():
        errors.append("Tracked tree is not clean")
    tracked={v.decode() for v in git("ls-files","-z").split(b"\0") if v}
    with zipfile.ZipFile(CANDIDATE) as z:
        entries=z.namelist()
        if len(entries)!=len(set(entries)):
            errors.append("Duplicate ZIP member names")
        for name in entries:
            p=PurePosixPath(name)
            if p.is_absolute() or ".." in p.parts or not name.startswith(PREFIX) or "\\" in name:
                errors.append("Unsafe ZIP name: "+name)
        metadata=PREFIX+"SOURCE_MANIFEST.json"
        nested=PREFIX+"upstream/stockfish-corresponding-source.tar.gz"
        if metadata not in entries or nested not in entries:
            errors.append("Required complete-source manifests/archive missing")
            fail(errors)
        manifest=json.loads(z.read(metadata))
        if manifest.get("gitCommit")!=commit:
            errors.append("Commit identity does not match checkout")
        if manifest.get("stockfishSourceSha256")!=sha(engine_bytes):
            errors.append("Stockfish archive hash mismatch in ZIP manifest")
        if z.read(nested)!=engine_bytes:
            errors.append("Actual nested Stockfish archive differs from approved technical source")
        records=manifest.get("files",[])
        paths=[x.get("path") for x in records]
        if len(paths)!=len(set(paths)):
            errors.append("Duplicate tracked file entries in manifest")
        if set(paths)!=tracked:
            errors.append("Incomplete or extra tracked-file coverage")
        if not EXPECTED.issubset(set(paths)):
            errors.append("Required Android source/build inputs missing")
        expected_members={PREFIX+x for x in tracked}|{metadata,nested}
        if set(entries)!=expected_members:
            errors.append("ZIP does not match exactly tracked files plus engine and manifest")
        for item in records:
            path=item.get("path","")
            if path not in tracked: continue
            try:
                packaged=z.read(PREFIX+path)
                current=(ROOT/path).read_bytes()
                if packaged!=current or sha(packaged)!=item.get("sha256") or len(packaged)!=item.get("sizeBytes"):
                    errors.append("Tracked file mismatch: "+path)
            except (KeyError,OSError,ValueError) as e:
                errors.append("Cannot verify: "+path+": "+str(e))
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    report={
        "status":"COMPLETE_SOURCE_TECHNICAL_PASS_LEGAL_PENDING" if not errors else "BLOCKED",
        "archivePath":str(CANDIDATE.relative_to(ROOT)).replace("\\","/"),
        "archiveSha256":sha(archive_bytes),
        "stockfishSourceSha256":sha(engine_bytes),
        "gitCommit":commit,
        "trackedFileCount":len(tracked),
        "legalApproval":False,
        "errors":errors
    }
    OUTPUT.write_text(json.dumps(report,indent=2)+"\n",encoding="utf8")
    print(json.dumps(report,indent=2))
    sys.exit(1 if errors else 0)
except (OSError,ValueError,KeyError,zipfile.BadZipFile,subprocess.CalledProcessError) as exc:
    fail(errors+["Verification exception: "+str(exc)])
