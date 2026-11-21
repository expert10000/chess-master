#!/usr/bin/env python3
"""Independently inspect an isolated complete-source Android debug rebuild.

Only a debug APK and technical report are checked; never authorizes GPL
attestation, source distribution, signing, or Play publication.
"""
import hashlib
import argparse
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
REPORT=ROOT/"artifacts/chess-coach-clean-source-build.json"
APK=ROOT/"artifacts/chess-coach-clean-source-debug.apk"
VERIFIED=ROOT/"artifacts/chess-coach-complete-source-verification.json"
SOURCE=ROOT/"release-sources/chess-coach-complete-source-candidate.zip"
OUTPUT=ROOT/"artifacts/chess-coach-clean-source-acceptance.json"
PARSER=argparse.ArgumentParser()
PARSER.add_argument('--release-commit', help='Explicit current Git commit for a newly qualified release snapshot')
ARGS=PARSER.parse_args()
EXPECTED_COMMIT=ARGS.release_commit or "1d3d85d6f3e889beda0a97c4f59e29f51902f9c2"
REQUIRED=[
    "assets/public/licenses.html",
    "assets/public/engine/Stockfish-GPL-3.0.txt",
    "assets/public/engine/stockfish-19-lite-single.js",
    "assets/public/engine/stockfish-19-lite-single.wasm",
]
for variant in ("spatial","fantasy","chessnut"):
    for side in ("w","b"):
        for piece in ("P","N","B","R","Q","K"):
            REQUIRED.append(f"assets/public/pieces/{variant}/{side}{piece}.svg")
def digest(data): return hashlib.sha256(data).hexdigest()
errors=[]
if ARGS.release_commit:
    if not re.fullmatch(r'[0-9a-f]{40}', EXPECTED_COMMIT):
        errors.append('Release commit must be a full lowercase Git SHA-1')
    else:
        try:
            current=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT).decode().strip()
            if current!=EXPECTED_COMMIT:
                errors.append('Requested release commit differs from current checkout')
            if subprocess.check_output(['git','status','--porcelain','--untracked-files=no'],cwd=ROOT).strip():
                errors.append('Tracked checkout is not clean')
        except (OSError,subprocess.CalledProcessError):
            errors.append('Cannot verify current Git release commit')
try:
    report=json.loads(REPORT.read_text(encoding="utf8"))
    prior=json.loads(VERIFIED.read_text(encoding="utf8"))
    apk=APK.read_bytes()
    archive=SOURCE.read_bytes()
    if report.get("status")!="CLEAN_SOURCE_DEBUG_BUILD_PASS_NOT_RELEASE_APPROVAL":
        errors.append("Clean source debug build report does not say PASS")
    if report.get("baselineCommit")!=EXPECTED_COMMIT or prior.get("gitCommit")!=EXPECTED_COMMIT:
        errors.append("Build source baseline does not match selected release commit")
    if report.get("qualifiedSourceZipSha256")!=digest(archive) or prior.get("archiveSha256")!=digest(archive):
        errors.append("Source ZIP SHA-256 mismatch")
    if report.get("debugApkSha256")!=digest(apk) or report.get("debugApkBytes")!=len(apk):
        errors.append("Preserved APK SHA-256/size mismatch")
    if report.get("engineMatchesInstalledNpmPackage") is not True:
        errors.append("Build report does not confirm APK engine JS/WASM/GPL bytes match npm")
    if report.get("requiredAssetCount") != len(REQUIRED):
        errors.append("Build report required-asset count does not match expected inventory")
    if report.get("legalApproval") is not False or report.get("signedReleaseAabAccepted") is not False:
        errors.append("Debug evidence incorrectly claims licensing/release acceptance")
    commands=report.get("commands",[])
    for required in ("ci","build:mobile","sync","assembleDebug"):
        if not any(required in str(x.get("command","")) and x.get("exitCode")==0 for x in commands):
            errors.append("Missing successful command evidence: "+required)
    with zipfile.ZipFile(APK) as z:
        names=set(z.namelist())
        missing=sorted(set(REQUIRED)-names)
        if missing:
            errors.append("APK missing required assets: "+", ".join(missing[:10]))
        if any(p.endswith("illustrated-sheet.png") for p in names):
            errors.append("APK contains excluded Staunton image")
        for name in REQUIRED[:4]:
            if name in names and report.get("packagedAssetSha256",{}).get(name)!=digest(z.read(name)):
                errors.append("APK asset hash does not match original build report: "+name)
except (OSError,ValueError,KeyError,TypeError,zipfile.BadZipFile) as exc:
    errors.append("Unable to inspect build evidence: "+str(exc))
result={
    "status":"CLEAN_SOURCE_DEBUG_ACCEPTED_GPL_PENDING" if not errors else "BLOCKED",
    "baselineCommit":EXPECTED_COMMIT,
    "sourceZipSha256":digest(SOURCE.read_bytes()) if SOURCE.is_file() else None,
    "debugApkSha256":digest(APK.read_bytes()) if APK.is_file() else None,
    "checkedAssetCount":len(REQUIRED),
    "errors":errors,
    "legalApproval":False,
    "signedReleaseAccepted":False,
}
OUTPUT.parent.mkdir(parents=True,exist_ok=True)
OUTPUT.write_text(json.dumps(result,indent=2)+"\n",encoding="utf8")
print(json.dumps(result,indent=2))
sys.exit(1 if errors else 0)
