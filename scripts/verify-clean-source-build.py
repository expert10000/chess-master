#!/usr/bin/env python3
"""Exercise the *verified* complete-source ZIP in an isolated temporary checkout.

No signing, Play upload, source publication, or changes to the user's current
working tree. Builds a debug Android APK, not a release AAB. External toolchains
and npm/Gradle caches must be configured on the qualification machine.
"""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ZIP = ROOT / "release-sources/chess-coach-complete-source-candidate.zip"
VERIFICATION = ROOT / "artifacts/chess-coach-complete-source-verification.json"
OUTPUT = ROOT / "artifacts/chess-coach-clean-source-build.json"
PREFIX = "chess-coach-source/"
RESULTS = []
def digest(data):
    return hashlib.sha256(data).hexdigest()
def run(args,cwd):
    command = " ".join(args)
    print("RUN:", command, flush=True)
    p=subprocess.run(args,cwd=cwd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
                     text=True,errors="replace",shell=False)
    lines=p.stdout.splitlines()
    RESULTS.append({"command":command,"exitCode":p.returncode,
                    "tail":lines[-35:]})
    for line in lines[-20:]:
        print(line, flush=True)
    if p.returncode:
        raise RuntimeError(command+" failed with exit "+str(p.returncode))

def main():
    if not ZIP.is_file() or not VERIFICATION.is_file():
        raise RuntimeError("Missing complete source ZIP or formal ZIP verification")
    prior=json.loads(VERIFICATION.read_text(encoding="utf8"))
    if prior.get("status")!="COMPLETE_SOURCE_TECHNICAL_PASS_LEGAL_PENDING" or prior.get("errors") or prior.get("archiveSha256")!=digest(ZIP.read_bytes()):
        raise RuntimeError("Full-source ZIP verification is stale or failed")
    if os.name=="nt":
        npm="npm.cmd"
    else:
        npm="npm"
    with tempfile.TemporaryDirectory(prefix="chess-coach-whole-source-") as temp:
        destination=Path(temp)
        with zipfile.ZipFile(ZIP) as z:
            seen=set()
            for item in z.infolist():
                p=PurePosixPath(item.filename)
                if (p.is_absolute() or ".." in p.parts or "\\" in item.filename
                    or not item.filename.startswith(PREFIX) or item.filename in seen):
                    raise RuntimeError("Unsafe ZIP member: "+item.filename)
                seen.add(item.filename)
                target=destination.joinpath(*p.parts)
                if item.is_dir():
                    target.mkdir(parents=True,exist_ok=True)
                    continue
                target.parent.mkdir(parents=True,exist_ok=True)
                with z.open(item) as src, target.open("wb") as dst:
                    shutil.copyfileobj(src,dst)
        app=destination / "chess-coach-source"
        run([npm,"ci"],app)
        run([npm,"run","build:mobile"],app)
        run([npm,"exec","--","cap","sync","android"],app)
        gradle=app/"android"/("gradlew.bat" if os.name=="nt" else "gradlew")
        cmd=[str(gradle),"assembleDebug"]
        if os.name!="nt":
            cmd=["sh",str(gradle),"assembleDebug"]
        run(cmd,app/"android")
        apk=app/"android/app/build/outputs/apk/debug/app-debug.apk"
        if not apk.is_file():
            raise RuntimeError("Android Gradle finished but debug APK was not found")
        result={
            "status":"CLEAN_SOURCE_DEBUG_BUILD_PASS_NOT_RELEASE_APPROVAL",
            "qualifiedSourceZipSha256":digest(ZIP.read_bytes()),
            "baselineCommit":prior.get("gitCommit"),
            "debugApkSha256":digest(apk.read_bytes()),
            "debugApkBytes":apk.stat().st_size,
            "commands":RESULTS,
            "legalApproval":False,
            "signedReleaseAabAccepted":False,
        }
        OUTPUT.parent.mkdir(parents=True,exist_ok=True)
        OUTPUT.write_text(json.dumps(result,indent=2)+"\n",encoding="utf8")
        print("PASS: isolated complete-source debug Android rebuild. No release bundle signed or distributed.")
        print("Evidence:",OUTPUT)
if __name__=="__main__":
    try:
        main()
    except (OSError,ValueError,KeyError,subprocess.SubprocessError,RuntimeError,zipfile.BadZipFile) as e:
        OUTPUT.parent.mkdir(parents=True,exist_ok=True)
        OUTPUT.write_text(json.dumps({"status":"BLOCKED","error":str(e),"commands":RESULTS,
                                     "legalApproval":False,"signedReleaseAabAccepted":False},indent=2)+"\n",encoding="utf8")
        sys.exit("CLEAN SOURCE REBUILD FAILED: "+str(e))
